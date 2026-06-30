import json
import logging
import math
import re
import sqlite3
import statistics
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.schemas import FundSyncResponse
from app.services.fund_universe import FUND_COMPANY_PREFIX, FUND_UNIVERSE_LABEL, is_in_fund_universe
from app.services.rule_config import load_rule_config
from app.services.stock_industry_importer import StockIndustryImporter
from app.services.stock_industry_mapper import StockIndustryMapper


DB_PATH = Path(__file__).resolve().parents[1] / "data" / "funds.db"
LOGGER = logging.getLogger(__name__)

# ------------------------------------------------------------------
# fund_holdings table DDL (kept DRY with _write_sqlite / _ensure_column)
# ------------------------------------------------------------------
FUND_HOLDINGS_DDL = """
CREATE TABLE IF NOT EXISTS fund_holdings (
    fund_code TEXT NOT NULL,
    stock_code TEXT NOT NULL,
    stock_name TEXT,
    holding_weight REAL,
    report_date TEXT,
    source TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (fund_code, stock_code, report_date)
)
"""

FUND_HOLDINGS_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_holdings_fund ON fund_holdings(fund_code)",
    "CREATE INDEX IF NOT EXISTS idx_holdings_stock ON fund_holdings(stock_code)",
    "CREATE INDEX IF NOT EXISTS idx_holdings_fund_report ON fund_holdings(fund_code, report_date)",
]


@dataclass(frozen=True)
class FundCandidate:
    code: str
    name: str
    fund_type: str


@dataclass(frozen=True)
class EnrichmentFailure:
    candidate: FundCandidate
    reason: str


class FundDataProviderError(RuntimeError):
    pass


class EastmoneyFundDataProvider:
    source = f"{FUND_UNIVERSE_LABEL} / Eastmoney fundcode_search.js + pingzhongdata + fundgz"

    def __init__(self) -> None:
        self.stock_industry_mapper = StockIndustryMapper()
        self.stock_industry_importer = StockIndustryImporter()

    def sync(self, *, limit: int, enrich_limit: int, keywords: list[str]) -> FundSyncResponse:
        """
        Two-phase sync:
          1. Fast bulk insert — keep the E Fund universe and write base rows to SQLite.
          2. Parallel enrichment — fetch per-fund detail/quote for the top N funds in a thread pool.
        """
        default_keywords = load_rule_config().fund_sync["default_keywords"]
        active_keywords = [item.strip() for item in keywords if item.strip()] or default_keywords
        candidates = self._fetch_candidates()
        universe_candidates = [
            candidate for candidate in candidates if is_in_fund_universe(candidate.name)
        ]
        filtered = self._filter_candidates(universe_candidates, active_keywords)
        selected = filtered[:limit]

        if not selected:
            raise FundDataProviderError(
                f"No {FUND_COMPANY_PREFIX} fund candidates matched the provided keywords"
            )

        # ---- Phase 1: bulk insert base rows (fast, no per-fund HTTP) ----
        base_rows = [self._base_row(candidate) for candidate in selected]
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        self._write_sqlite(base_rows)
        self.stock_industry_mapper.ensure_table()

        # ---- Phase 2: parallel enrichment (thread pool) ----
        enriched_count = 0
        if enrich_limit > 0:
            enriched_rows = self._enrich_until_target(selected, enrich_limit)
            enriched_count = len(enriched_rows)
            # Merge enriched fields back into the DB
            if enriched_rows:
                self._merge_enriched(enriched_rows)

        # ---- Phase 3: refresh real stock-industry mapping (fast, skips cached) ----
        industry_imported = 0
        try:
            result = self.stock_industry_importer.refresh()
            industry_imported = result.imported
        except Exception:
            LOGGER.warning("Stock industry import failed, continuing with keyword fallback", exc_info=True)

        return FundSyncResponse(
            source=self.source,
            saved_path=str(DB_PATH),
            total_candidates=len(filtered),
            synced_count=len(selected),
            enriched_count=enriched_count,
            keywords=active_keywords,
            updated_at=datetime.now(UTC).isoformat(timespec="seconds"),
            message=(
                f"SQLite {FUND_UNIVERSE_LABEL}已更新：{len(selected)} 只基础基金，"
                f"{enriched_count} 只已增强（经理/收益/持仓/风险等级）。"
                + (f" 已为 {industry_imported} 只持仓股票同步申万行业分类。" if industry_imported else "")
            ),
        )

    # ------------------------------------------------------------------
    # Phase 1 helpers
    # ------------------------------------------------------------------

    def _fetch_candidates(self) -> list[FundCandidate]:
        text = self._http_text("https://fund.eastmoney.com/js/fundcode_search.js")
        match = re.search(r"var\s+r\s*=\s*(\[.*\]);?", text, flags=re.S)
        if match is None:
            raise FundDataProviderError("Could not parse Eastmoney fund code list")

        raw_items = json.loads(match.group(1))
        candidates: list[FundCandidate] = []
        for item in raw_items:
            if len(item) < 4:
                continue
            candidates.append(FundCandidate(code=str(item[0]), name=str(item[2]), fund_type=str(item[3])))
        return candidates

    def _filter_candidates(self, candidates: list[FundCandidate], keywords: list[str]) -> list[FundCandidate]:
        deduped: dict[str, FundCandidate] = {}
        for candidate in candidates:
            text = f"{candidate.name} {candidate.fund_type}"
            if any(keyword.lower() in text.lower() for keyword in keywords):
                deduped[candidate.code] = candidate
        return list(deduped.values())

    def _base_row(self, candidate: FundCandidate) -> dict[str, str]:
        now = datetime.now(UTC).isoformat(timespec="seconds")
        risk_level = _derive_risk_level(candidate.fund_type)
        return {
            "fund_code": candidate.code,
            "fund_name": candidate.name,
            "fund_type": candidate.fund_type,
            "manager": "未知",
            "positioning": ";".join(self._positioning(candidate)),
            "top_holdings": "",
            "industry_allocation": "",
            "industry_allocation_source": "",
            "one_year_return": "",
            "volatility": "",
            "max_drawdown": "",
            "risk_level": risk_level,
            "risk_level_source": "inferred_from_fund_type",
            "suitable_clients": _suitable_clients_for_risk(risk_level),
            "latest_nav": "",
            "estimated_growth": "",
            "fund_size": "",
            "inception_date": "",
            "management_fee": "",
            "custody_fee": "",
            "sales_service_fee": "",
            "official_risk_level": "",
            "manager_tenure": "",
            "sharpe_ratio": "",
            "calmar_ratio": "",
            "peer_rank": "",
            "data_source": self.source,
            "data_updated_at": now,
            "is_enriched": "0",
        }

    def _positioning(self, candidate: FundCandidate) -> list[str]:
        tags = [candidate.fund_type]
        text = f"{candidate.name} {candidate.fund_type}"
        keywords = load_rule_config().fund_sync.get("positioning_keywords", [])
        for keyword in keywords:
            if keyword.lower() in text.lower():
                tags.append(keyword)
        return list(dict.fromkeys(tags))

    # ------------------------------------------------------------------
    # Phase 2: parallel enrichment
    # ------------------------------------------------------------------

    def _enrich_until_target(
        self,
        candidates: list[FundCandidate],
        target_count: int,
    ) -> list[dict[str, str]]:
        """Keep trying candidates until the requested number is enriched or the pool is exhausted."""
        enriched: list[dict[str, str]] = []
        attempted_count = 0
        failure_count = 0

        while len(enriched) < target_count and attempted_count < len(candidates):
            remaining = target_count - len(enriched)
            batch = candidates[attempted_count:attempted_count + remaining]
            attempted_count += len(batch)
            rows, failures = self._enrich_parallel(batch)
            enriched.extend(rows)
            failure_count += len(failures)
            for failure in failures:
                LOGGER.warning(
                    "Fund enrichment failed: code=%s name=%s reason=%s",
                    failure.candidate.code,
                    failure.candidate.name,
                    failure.reason,
                )

        if failure_count:
            LOGGER.info(
                "Fund enrichment completed with retries: target=%s successful=%s attempted=%s failed=%s",
                target_count,
                len(enriched),
                attempted_count,
                failure_count,
            )

        return enriched[:target_count]

    def _enrich_parallel(self, candidates: list[FundCandidate]) -> tuple[list[dict[str, str]], list[EnrichmentFailure]]:
        """Fetch fund details in parallel using a thread pool (10 workers)."""
        enriched: list[dict[str, str]] = []
        failures: list[EnrichmentFailure] = []
        max_workers = min(10, len(candidates))

        if max_workers <= 0:
            return enriched, failures

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {
                executor.submit(self._enrich_one, candidate): candidate
                for candidate in candidates
            }
            for future in as_completed(future_map):
                candidate = future_map[future]
                try:
                    row = future.result()
                    if row:
                        enriched.append(row)
                    else:
                        failures.append(EnrichmentFailure(candidate, "no detail or quote response"))
                except Exception as exc:
                    failures.append(EnrichmentFailure(candidate, f"{type(exc).__name__}: {exc}"))

        return enriched, failures

    def _enrich_one(self, candidate: FundCandidate) -> dict[str, str] | None:
        """Fetch detail + quote for a single fund. Returns merged row or None on failure."""
        try:
            details = self._fetch_detail(candidate.code)
            quote = self._fetch_quote(candidate.code)
        except Exception as exc:
            raise FundDataProviderError(f"detail fetch failed: {exc}") from exc

        if not details and not quote:
            return None

        # Manager
        manager = "未知"
        manager_payload = self._extract_json_var(details, "Data_currentFundManager")
        if isinstance(manager_payload, list) and manager_payload:
            manager = "、".join(
                str(item.get("name", "")).strip() for item in manager_payload if item.get("name")
            ) or "未知"

        # Manager tenure (from first manager record)
        manager_tenure = ""
        if isinstance(manager_payload, list) and manager_payload:
            tenure_raw = manager_payload[0].get("tenureDays", "") if isinstance(manager_payload[0], dict) else ""
            if tenure_raw:
                days = int(tenure_raw)
                years = days / 365.25
                manager_tenure = f"{years:.1f}年"

        # Top holdings (stock codes) — extract code + name + weight from Data_fundSharesPositions
        stock_codes_raw = self._extract_json_var(details, "stockCodesNew")
        if not isinstance(stock_codes_raw, list):
            stock_codes_raw = []

        # Extract holding weights from Data_fundSharesPositions
        holdings_data = self._extract_holdings(details, candidate.code)

        # Derive stock codes list from holdings if available, else fall back to stockCodesNew
        if holdings_data:
            stock_codes = [h["stock_code"] for h in holdings_data]
        else:
            stock_codes = [str(item) for item in stock_codes_raw[:10]]

        # Returns
        one_year_return = self._extract_string_var(details, "syl_1n")

        # Volatility & max drawdown from net worth trend
        net_worth = self._extract_json_var(details, "Data_netWorthTrend")
        volatility, max_drawdown = self._risk_metrics(
            net_worth if isinstance(net_worth, list) else []
        )

        # Fund metadata fields
        fund_size = self._extract_fund_meta(details, "Data_fundScale")
        inception_date = self._extract_fund_meta(details, "clrq")
        management_fee = self._extract_fund_meta(details, "fund_Rate")
        custody_fee = self._extract_fund_meta(details, "fund_TrusteeRate")

        # Official risk level from F10 detail if available
        official_risk_level = self._extract_official_risk_level(details)

        # Asset allocation (stock/bond/cash ratio)
        asset_alloc = self._extract_json_var(details, "Data_assetAllocation")
        stock_ratio = self._latest_stock_ratio(asset_alloc)

        # Risk level with source tracking
        risk_level = _derive_risk_level(candidate.fund_type)
        risk_level_source = "inferred_from_fund_type"
        if official_risk_level:
            risk_level = official_risk_level
            risk_level_source = "official"

        # Prefer weight-based industry allocation when holdings data exists
        industry_allocation: dict[str, float] = {}
        industry_allocation_source = ""
        if holdings_data:
            industry_allocation, industry_allocation_source = (
                self.stock_industry_mapper.aggregate_by_holding_weight(
                    fund_code=candidate.code,
                    holdings=holdings_data,
                )
            )
        if not industry_allocation:
            # Fall back to count-based or keyword-based
            industry_allocation, industry_allocation_source = self._derive_industry_allocation(
                candidate.name, candidate.fund_type,
                [self.stock_industry_mapper._normalize_code(str(item)) for item in stock_codes_raw[:20]],
            )

        # Write holdings to DB for future use
        self._write_holdings(candidate.code, holdings_data)

        return {
            "fund_code": candidate.code,
            "manager": manager,
            "top_holdings": ";".join(str(item) for item in stock_codes[:10]),
            "industry_allocation": ";".join(
                f"{industry}:{weight:.1f}%"
                for industry, weight in sorted(
                    industry_allocation.items(), key=lambda kv: kv[1], reverse=True
                )[:8]
            ),
            "industry_allocation_source": industry_allocation_source,
            "one_year_return": self._percent(one_year_return),
            "volatility": self._percent(volatility),
            "max_drawdown": self._percent(max_drawdown),
            "risk_level": risk_level,
            "risk_level_source": risk_level_source,
            "suitable_clients": _suitable_clients_for_risk(risk_level),
            "positioning": self._enriched_positioning(candidate, stock_ratio),
            "latest_nav": quote.get("dwjz", ""),
            "estimated_growth": self._percent(quote.get("gszzl", "")),
            "fund_size": fund_size,
            "inception_date": inception_date,
            "management_fee": management_fee,
            "custody_fee": custody_fee,
            "sales_service_fee": "",
            "official_risk_level": official_risk_level,
            "manager_tenure": manager_tenure,
            "sharpe_ratio": "",
            "calmar_ratio": "",
            "peer_rank": "",
            "data_updated_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "is_enriched": "1",
        }

    # ------------------------------------------------------------------
    # HTTP helpers
    # ------------------------------------------------------------------

    def _fetch_detail(self, code: str) -> str:
        try:
            return self._http_text(
                f"https://fund.eastmoney.com/pingzhongdata/{code}.js?v={int(datetime.now().timestamp())}"
            )
        except (urllib.error.URLError, TimeoutError):
            return ""

    def _fetch_quote(self, code: str) -> dict[str, Any]:
        try:
            text = self._http_text(
                f"https://fundgz.1234567.com.cn/js/{code}.js?rt={int(datetime.now().timestamp() * 1000)}"
            )
        except (urllib.error.URLError, TimeoutError):
            return {}
        match = re.search(r"jsonpgz\((.*)\);?", text, flags=re.S)
        if match is None:
            return {}
        return json.loads(match.group(1))

    def _http_text(self, url: str) -> str:
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 ProjectA/0.1",
                "Accept": "*/*",
            },
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.read().decode("utf-8-sig", errors="replace")

    # ------------------------------------------------------------------
    # Parsing helpers
    # ------------------------------------------------------------------

    def _extract_string_var(self, text: str, var_name: str) -> str:
        match = re.search(rf"var\s+{re.escape(var_name)}\s*=\s*\"([^\"]*)\"", text)
        return match.group(1) if match else ""

    def _extract_json_var(self, text: str, var_name: str) -> Any:
        pattern = rf"var\s+{re.escape(var_name)}\s*=\s*(.*?);(?=/\*|var\s|$)"
        match = re.search(pattern, text, flags=re.S)
        if match is None:
            return None
        raw = match.group(1).strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    # ------------------------------------------------------------------
    # Risk metrics
    # ------------------------------------------------------------------

    def _risk_metrics(
        self, net_worth: list[dict[str, Any]]
    ) -> tuple[float | None, float | None]:
        points = [
            float(item["y"])
            for item in net_worth[-260:]
            if isinstance(item, dict) and item.get("y") is not None
        ]
        if len(points) < 30:
            return None, None

        returns = [
            (points[index] / points[index - 1]) - 1
            for index in range(1, len(points))
            if points[index - 1] > 0
        ]
        volatility = (
            statistics.stdev(returns) * math.sqrt(252) * 100 if len(returns) >= 2 else None
        )

        peak = points[0]
        max_drawdown = 0.0
        for value in points:
            peak = max(peak, value)
            drawdown = (value / peak - 1) * 100
            max_drawdown = min(max_drawdown, drawdown)

        return volatility, max_drawdown

    # ------------------------------------------------------------------
    # Holdings extraction (fund_holdings table)
    # ------------------------------------------------------------------

    # Eastmoney F10 fund holdings endpoint (returns HTML table)
    F10_HOLDINGS_URL = (
        "https://fundf10.eastmoney.com/FundArchivesDatas.aspx"
        "?type=jjcc&code={code}&topline=10&year=&month=&rt={rt}"
    )

    def _extract_holdings(
        self, details: str, fund_code: str
    ) -> list[dict[str, str]]:
        """
        Extract stock holdings with weights from Eastmoney F10 API.

        Fetches the fund's top-10 stock holdings from the F10 holdings page
        (FundArchivesDatas.aspx?type=jjcc), parses the HTML table to extract
        stock_code, stock_name, holding_weight (占净值比例), and report_date.

        Falls back gracefully if the API is unreachable or returns no data.
        """
        try:
            html = self._fetch_f10_holdings(fund_code)
        except (urllib.error.URLError, TimeoutError, Exception):
            LOGGER.debug("F10 holdings fetch failed for %s", fund_code)
            return []

        if not html:
            return []

        # Extract report date from header: "截止至：<font class='px12'>2026-03-31</font>"
        report_date = ""
        date_match = re.search(r"截止至：.*?(\d{4}-\d{2}-\d{2})", html)
        if date_match:
            report_date = date_match.group(1)

        # Extract holding rows: each <tr> contains seq, code, name, ..., weight%, ...
        # Pattern: <tr><td>seq</td><td>...>code</a></td><td class='tol'>...>name</a></td>...<td class='tor'>weight%</td>
        row_pattern = re.compile(
            r"<tr><td>\d+</td>"
            r"<td>.*?>(.*?)</a></td>"
            r"<td[^>]*>.*?>(.*?)</a></td>"
            r"(?:.*?<td[^>]*>.*?</td>){3}"  # skip price, change%, nav links
            r"<td[^>]*>(.*?)%</td>",
            re.DOTALL,
        )

        holdings: list[dict[str, str]] = []
        for match in row_pattern.finditer(html):
            stock_code = match.group(1).strip()
            stock_name = match.group(2).strip()
            weight_str = match.group(3).strip()

            if not stock_code:
                continue

            normalized = self.stock_industry_mapper._normalize_code(stock_code)
            if not normalized or len(normalized) < 6:
                continue

            weight = None
            try:
                weight = float(weight_str)
            except (ValueError, TypeError):
                pass

            holdings.append({
                "stock_code": normalized,
                "stock_name": stock_name or normalized,
                "holding_weight": str(weight) if weight is not None else "",
                "report_date": report_date,
                "source": "Eastmoney F10 FundArchivesDatas.aspx?type=jjcc",
            })

        return holdings

    def _fetch_f10_holdings(self, code: str) -> str:
        """Fetch fund holdings HTML from Eastmoney F10."""
        rt = str(int(datetime.now().timestamp() * 1000))
        url = self.F10_HOLDINGS_URL.format(code=code, rt=rt)
        try:
            request = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 ProjectA/0.1",
                    "Accept": "*/*",
                    "Referer": "https://fundf10.eastmoney.com/",
                },
            )
            with urllib.request.urlopen(request, timeout=20) as response:
                raw = response.read().decode("utf-8", errors="replace")
                # Extract content from: var apidata={ content:"...",arryear:...};
                prefix = 'content:"'
                start = raw.find(prefix)
                if start < 0:
                    return raw
                start += len(prefix)
                # Find the closing quote before the next field (",arryear or ",curyear)
                end_match = re.search(r'",\s*(?:arryear|curyear)', raw[start:])
                if end_match:
                    end = start + end_match.start()
                else:
                    return ""
                html = raw[start:end]
                # JS string unescaping
                html = html.replace('\\"', '"').replace("\\\\", "\\").replace("\\/", "/")
                return html
        except (urllib.error.URLError, TimeoutError):
            return ""

    def _write_holdings(
        self, fund_code: str, holdings: list[dict[str, str]]
    ) -> None:
        """Persist fund holdings to the fund_holdings table."""
        if not holdings:
            return

        now = datetime.now(UTC).isoformat(timespec="seconds")
        with sqlite3.connect(DB_PATH) as connection:
            # Ensure table exists (may have been created by _write_sqlite already)
            connection.execute(FUND_HOLDINGS_DDL)
            for index_ddl in FUND_HOLDINGS_INDEXES:
                try:
                    connection.execute(index_ddl)
                except sqlite3.OperationalError:
                    pass

            # Delete old holdings for this fund to prevent stale/encoding-broken rows
            connection.execute(
                "DELETE FROM fund_holdings WHERE fund_code = ?",
                (fund_code,),
            )

            # Insert fresh holdings
            for h in holdings:
                connection.execute(
                    """
                    INSERT INTO fund_holdings
                        (fund_code, stock_code, stock_name, holding_weight, report_date, source, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        fund_code,
                        h["stock_code"],
                        h.get("stock_name", h["stock_code"]),
                        float(h["holding_weight"]) if h.get("holding_weight") else None,
                        h.get("report_date", ""),
                        h.get("source", "Eastmoney F10"),
                        now,
                    ),
                )

    # ------------------------------------------------------------------
    # Fund metadata extraction
    # ------------------------------------------------------------------

    def _extract_fund_meta(self, details: str, var_name: str) -> str:
        """Extract a fund metadata field by variable name."""
        # Try string var first
        value = self._extract_string_var(details, var_name)
        if value:
            return value
        # Try JSON var
        json_val = self._extract_json_var(details, var_name)
        if isinstance(json_val, str):
            return json_val
        if isinstance(json_val, (int, float)):
            return str(json_val)
        return ""

    def _extract_official_risk_level(self, details: str) -> str:
        """Try to extract official risk level from fund detail data."""
        # In pingzhongdata, risk level may appear as a data variable
        risk = self._extract_string_var(details, "Data_riskLevel")
        if risk:
            return risk
        # Try JSON-based risk info
        risk_json = self._extract_json_var(details, "Data_fundRiskInfo")
        if isinstance(risk_json, dict):
            level = risk_json.get("riskLevel", "") or risk_json.get("risk_level", "")
            if level:
                return str(level)
        return ""

    # ------------------------------------------------------------------
    # Industry allocation derivation
    # ------------------------------------------------------------------

    def _derive_industry_allocation(
        self, fund_name: str, fund_type: str, stock_codes: list[str]
    ) -> tuple[dict[str, float], str]:
        """
        Derive industry allocation from fund name, type, and known theme keywords.
        This is an approximation — for production use, cross-reference stock codes
        with Shenwan industry classification data.
        """
        mapped_alloc, mapped_source = self.stock_industry_mapper.aggregate_by_holding_count(stock_codes)
        if mapped_alloc:
            return mapped_alloc, mapped_source

        alloc: dict[str, float] = {}
        text = f"{fund_name} {fund_type}"

        for rule in load_rule_config().industry_keyword_rules:
            keyword = str(rule["keyword"])
            industry = str(rule["industry"])
            base_weight = float(rule["weight"])
            if keyword.lower() in text.lower():
                alloc[industry] = alloc.get(industry, 0) + base_weight

        # If we have stock codes, adjust based on count
        if stock_codes and alloc:
            total = sum(alloc.values())
            if total > 0:
                alloc = {k: min(v, 45.0) for k, v in alloc.items()}

        return alloc, "keyword_inferred" if alloc else ""

    def _latest_stock_ratio(self, asset_alloc: Any) -> float | None:
        """Extract the latest stock ratio from asset allocation data."""
        if not isinstance(asset_alloc, dict):
            return None
        series_list = asset_alloc.get("series", [])
        for series in series_list:
            if isinstance(series, dict) and series.get("name") == "股票占净比":
                data = series.get("data", [])
                if isinstance(data, list) and data:
                    last = data[-1]
                    if isinstance(last, (int, float)):
                        return float(last)
        return None

    def _enriched_positioning(
        self, candidate: FundCandidate, stock_ratio: float | None
    ) -> str:
        """Build richer positioning tags after enrichment."""
        tags = self._positioning(candidate)
        risk_level = _derive_risk_level(candidate.fund_type)
        tags.append(risk_level)
        if stock_ratio is not None:
            if stock_ratio >= 80:
                tags.append("高仓位")
            elif stock_ratio >= 60:
                tags.append("中高仓位")
            elif stock_ratio >= 30:
                tags.append("中等仓位")
            else:
                tags.append("低仓位")
        return ";".join(list(dict.fromkeys(tags)))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _percent(self, value: str | float | None) -> str:
        if value in {None, ""}:
            return ""
        try:
            return f"{float(value):.2f}%"
        except (ValueError, TypeError):
            return ""

    # ------------------------------------------------------------------
    # SQLite persistence
    # ------------------------------------------------------------------

    def _write_sqlite(self, rows: list[dict[str, str]]) -> None:
        """Create/overwrite the funds table with the given rows."""
        columns = [
            "fund_code",
            "fund_name",
            "fund_type",
            "manager",
            "positioning",
            "top_holdings",
            "industry_allocation",
            "industry_allocation_source",
            "one_year_return",
            "volatility",
            "max_drawdown",
            "risk_level",
            "risk_level_source",
            "suitable_clients",
            "latest_nav",
            "estimated_growth",
            "fund_size",
            "inception_date",
            "management_fee",
            "custody_fee",
            "sales_service_fee",
            "official_risk_level",
            "manager_tenure",
            "sharpe_ratio",
            "calmar_ratio",
            "peer_rank",
            "data_source",
            "data_updated_at",
            "is_enriched",
        ]

        with sqlite3.connect(DB_PATH) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS funds (
                    fund_code TEXT PRIMARY KEY,
                    fund_name TEXT NOT NULL,
                    fund_type TEXT NOT NULL,
                    manager TEXT,
                    positioning TEXT,
                    top_holdings TEXT,
                    industry_allocation TEXT,
                    industry_allocation_source TEXT,
                    one_year_return TEXT,
                    volatility TEXT,
                    max_drawdown TEXT,
                    risk_level TEXT,
                    risk_level_source TEXT DEFAULT 'inferred_from_fund_type',
                    suitable_clients TEXT,
                    latest_nav TEXT,
                    estimated_growth TEXT,
                    fund_size TEXT,
                    inception_date TEXT,
                    management_fee TEXT,
                    custody_fee TEXT,
                    sales_service_fee TEXT,
                    official_risk_level TEXT,
                    manager_tenure TEXT,
                    sharpe_ratio TEXT,
                    calmar_ratio TEXT,
                    peer_rank TEXT,
                    data_source TEXT,
                    data_updated_at TEXT,
                    is_enriched INTEGER DEFAULT 0
                )
                """
            )
            # Ensure all new columns exist for DBs created before this migration
            self._ensure_column(connection, "funds", "industry_allocation_source", "TEXT")
            self._ensure_column(connection, "funds", "risk_level_source", "TEXT DEFAULT 'inferred_from_fund_type'")
            self._ensure_column(connection, "funds", "fund_size", "TEXT")
            self._ensure_column(connection, "funds", "inception_date", "TEXT")
            self._ensure_column(connection, "funds", "management_fee", "TEXT")
            self._ensure_column(connection, "funds", "custody_fee", "TEXT")
            self._ensure_column(connection, "funds", "sales_service_fee", "TEXT")
            self._ensure_column(connection, "funds", "official_risk_level", "TEXT")
            self._ensure_column(connection, "funds", "manager_tenure", "TEXT")
            self._ensure_column(connection, "funds", "sharpe_ratio", "TEXT")
            self._ensure_column(connection, "funds", "calmar_ratio", "TEXT")
            self._ensure_column(connection, "funds", "peer_rank", "TEXT")

            # Create fund_holdings table
            connection.execute(FUND_HOLDINGS_DDL)
            for index_ddl in FUND_HOLDINGS_INDEXES:
                connection.execute(index_ddl)

            connection.execute("DELETE FROM funds")
            placeholders = ",".join("?" for _ in columns)
            connection.executemany(
                f"INSERT INTO funds ({','.join(columns)}) VALUES ({placeholders})",
                [[row.get(column, "") for column in columns] for row in rows],
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_funds_name ON funds(fund_name)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_funds_type ON funds(fund_type)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_funds_positioning ON funds(positioning)"
            )

    def _merge_enriched(self, enriched_rows: list[dict[str, str]]) -> None:
        """Update enriched fields for existing rows using simple UPDATE statements."""
        enrich_columns = [
            "manager",
            "top_holdings",
            "industry_allocation",
            "industry_allocation_source",
            "one_year_return",
            "volatility",
            "max_drawdown",
            "risk_level",
            "risk_level_source",
            "suitable_clients",
            "positioning",
            "latest_nav",
            "estimated_growth",
            "fund_size",
            "inception_date",
            "management_fee",
            "custody_fee",
            "sales_service_fee",
            "official_risk_level",
            "manager_tenure",
            "sharpe_ratio",
            "calmar_ratio",
            "peer_rank",
            "data_updated_at",
            "is_enriched",
        ]
        set_clause = ",".join(f"{col}=?" for col in enrich_columns)

        with sqlite3.connect(DB_PATH) as connection:
            # Ensure all new columns exist
            for col_def in [
                ("industry_allocation_source", "TEXT"),
                ("risk_level_source", "TEXT DEFAULT 'inferred_from_fund_type'"),
                ("fund_size", "TEXT"),
                ("inception_date", "TEXT"),
                ("management_fee", "TEXT"),
                ("custody_fee", "TEXT"),
                ("sales_service_fee", "TEXT"),
                ("official_risk_level", "TEXT"),
                ("manager_tenure", "TEXT"),
                ("sharpe_ratio", "TEXT"),
                ("calmar_ratio", "TEXT"),
                ("peer_rank", "TEXT"),
            ]:
                self._ensure_column(connection, "funds", col_def[0], col_def[1])

            connection.executemany(
                f"UPDATE funds SET {set_clause} WHERE fund_code=?",
                [
                    [row.get(col, "") for col in enrich_columns] + [row["fund_code"]]
                    for row in enriched_rows
                ],
            )

    def _ensure_column(
        self,
        connection: sqlite3.Connection,
        table: str,
        column: str,
        definition: str,
    ) -> None:
        columns = {row[1] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}
        if column not in columns:
            connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


# ------------------------------------------------------------------
# Module-level helpers
# ------------------------------------------------------------------

def _derive_risk_level(fund_type: str) -> str:
    """Derive risk level (R1-R5) from configured ordered partial-match rules."""
    for rule in load_rule_config().risk_level_rules:
        if rule["contains"] in fund_type:
            return rule["risk_level"]
    return "R3"


def _suitable_clients_for_risk(risk_level: str) -> str:
    mapping = load_rule_config().suitable_clients_by_risk
    return mapping.get(risk_level, "需结合产品说明书和销售适当性规则确认")
