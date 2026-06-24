import json
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
from app.services.rule_config import load_rule_config
from app.services.stock_industry_mapper import StockIndustryMapper


DB_PATH = Path(__file__).resolve().parents[1] / "data" / "funds.db"

@dataclass(frozen=True)
class FundCandidate:
    code: str
    name: str
    fund_type: str


class FundDataProviderError(RuntimeError):
    pass


class EastmoneyFundDataProvider:
    source = "Eastmoney fundcode_search.js + pingzhongdata + fundgz"

    def __init__(self) -> None:
        self.stock_industry_mapper = StockIndustryMapper()

    def sync(self, *, limit: int, enrich_limit: int, keywords: list[str]) -> FundSyncResponse:
        """
        Two-phase sync:
          1. Fast bulk insert — filter candidates by keywords, write 3000+ base rows to SQLite.
          2. Parallel enrichment — fetch per-fund detail/quote for the top N funds in a thread pool.
        """
        default_keywords = load_rule_config().fund_sync["default_keywords"]
        active_keywords = [item.strip() for item in keywords if item.strip()] or default_keywords
        candidates = self._fetch_candidates()
        filtered = self._filter_candidates(candidates, active_keywords)
        selected = filtered[:limit]

        if not selected:
            raise FundDataProviderError("No real fund candidates matched the provided keywords")

        # ---- Phase 1: bulk insert base rows (fast, no per-fund HTTP) ----
        base_rows = [self._base_row(candidate) for candidate in selected]
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        self._write_sqlite(base_rows)
        self.stock_industry_mapper.ensure_table()

        # ---- Phase 2: parallel enrichment (thread pool) ----
        enrich_candidates = selected[:enrich_limit]
        enriched_count = 0
        if enrich_candidates:
            enriched_rows = self._enrich_parallel(enrich_candidates)
            enriched_count = len(enriched_rows)
            # Merge enriched fields back into the DB
            if enriched_rows:
                self._merge_enriched(enriched_rows)

        return FundSyncResponse(
            source=self.source,
            saved_path=str(DB_PATH),
            total_candidates=len(filtered),
            synced_count=len(selected),
            enriched_count=enriched_count,
            keywords=active_keywords,
            updated_at=datetime.now(UTC).isoformat(timespec="seconds"),
            message=(
                f"SQLite 基金池已更新：{len(selected)} 只基础基金，"
                f"{enriched_count} 只已增强（经理/收益/持仓/风险等级）。"
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
            "suitable_clients": _suitable_clients_for_risk(risk_level),
            "latest_nav": "",
            "estimated_growth": "",
            "data_source": self.source,
            "data_updated_at": now,
            "is_enriched": "0",
        }

    def _positioning(self, candidate: FundCandidate) -> list[str]:
        tags = [candidate.fund_type]
        text = f"{candidate.name} {candidate.fund_type}"
        for keyword in load_rule_config().fund_sync["default_keywords"]:
            if keyword.lower() in text.lower():
                tags.append(keyword)
        return list(dict.fromkeys(tags))

    # ------------------------------------------------------------------
    # Phase 2: parallel enrichment
    # ------------------------------------------------------------------

    def _enrich_parallel(self, candidates: list[FundCandidate]) -> list[dict[str, str]]:
        """Fetch fund details in parallel using a thread pool (10 workers)."""
        enriched: list[dict[str, str]] = []
        max_workers = min(10, len(candidates))

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
                except Exception:
                    # Single fund failure should not block the whole batch
                    pass

        return enriched

    def _enrich_one(self, candidate: FundCandidate) -> dict[str, str] | None:
        """Fetch detail + quote for a single fund. Returns merged row or None on failure."""
        try:
            details = self._fetch_detail(candidate.code)
            quote = self._fetch_quote(candidate.code)
        except Exception:
            return None

        # Manager
        manager = "未知"
        manager_payload = self._extract_json_var(details, "Data_currentFundManager")
        if isinstance(manager_payload, list) and manager_payload:
            manager = "、".join(
                str(item.get("name", "")).strip() for item in manager_payload if item.get("name")
            ) or "未知"

        # Top holdings (stock codes)
        stock_codes = self._extract_json_var(details, "stockCodesNew")
        if not isinstance(stock_codes, list):
            stock_codes = []

        # Returns
        one_year_return = self._extract_string_var(details, "syl_1n")

        # Volatility & max drawdown from net worth trend
        net_worth = self._extract_json_var(details, "Data_netWorthTrend")
        volatility, max_drawdown = self._risk_metrics(
            net_worth if isinstance(net_worth, list) else []
        )

        # Prefer real stock-code industry mappings when the optional mapping table is available.
        industry_allocation, industry_allocation_source = self._derive_industry_allocation(
            candidate.name, candidate.fund_type, stock_codes
        )

        # Asset allocation (stock/bond/cash ratio)
        asset_alloc = self._extract_json_var(details, "Data_assetAllocation")
        stock_ratio = self._latest_stock_ratio(asset_alloc)

        # Risk level
        risk_level = _derive_risk_level(candidate.fund_type)

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
            "suitable_clients": _suitable_clients_for_risk(risk_level),
            "positioning": self._enriched_positioning(candidate, stock_ratio),
            "latest_nav": quote.get("dwjz", ""),
            "estimated_growth": self._percent(quote.get("gszzl", "")),
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
            "suitable_clients",
            "latest_nav",
            "estimated_growth",
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
                    suitable_clients TEXT,
                    latest_nav TEXT,
                    estimated_growth TEXT,
                    data_source TEXT,
                    data_updated_at TEXT,
                    is_enriched INTEGER DEFAULT 0
                )
                """
            )
            self._ensure_column(connection, "funds", "industry_allocation_source", "TEXT")
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
            "suitable_clients",
            "positioning",
            "latest_nav",
            "estimated_growth",
            "data_updated_at",
            "is_enriched",
        ]
        set_clause = ",".join(f"{col}=?" for col in enrich_columns)

        with sqlite3.connect(DB_PATH) as connection:
            self._ensure_column(connection, "funds", "industry_allocation_source", "TEXT")
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
