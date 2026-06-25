"""
Fetches real Shenwan (申万) industry classifications for A-share stocks from
Eastmoney F10 APIs and writes them into the local stock_industry_map table.

When this table is populated, FundDataProvider._derive_industry_allocation()
will prefer real stock-code-level industry mappings over keyword inference,
and the frontend will display the source as "持仓代码行业映射" instead of "规则推导".
"""

import json
import logging
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.services.stock_industry_mapper import StockIndustryMapper

LOGGER = logging.getLogger(__name__)

# Eastmoney F10 Company Survey API — returns Shenwan industry via the `sshy` field.
F10_API = (
    "https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/"
    "CompanySurveyAjax?code={exchange}{code}"
)

REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 ProjectA/0.1",
    "Referer": "https://quote.eastmoney.com/",
}

MAX_WORKERS = 8


@dataclass(frozen=True)
class ImportResult:
    total_codes: int
    imported: int
    failed: int
    skipped: int  # already in table
    elapsed_seconds: float


class StockIndustryImporter:
    """
    Collects all stock codes from fund holdings in the local SQLite fund pool,
    fetches Shenwan industry classifications from Eastmoney F10, and persists
    them into stock_industry_map.
    """

    def __init__(self) -> None:
        self.mapper = StockIndustryMapper()

    def refresh(self, *, force: bool = False) -> ImportResult:
        """
        Refresh the stock-industry mapping table from live data.

        If *force* is False, only fetch codes not already present in the table.
        """
        started = datetime.now(UTC)
        existing: set[str] = set()
        if not force:
            existing = self.mapper.known_codes()

        codes = self._collect_fund_holding_codes()
        pending = [code for code in codes if code not in existing]
        if not pending:
            return ImportResult(
                total_codes=len(codes),
                imported=0,
                failed=0,
                skipped=0,
                elapsed_seconds=0.0,
            )

        imported = 0
        failed = 0
        with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(pending))) as executor:
            future_map = {
                executor.submit(self._fetch_industry, code): code
                for code in pending
            }
            for future in as_completed(future_map):
                try:
                    row = future.result()
                    if row:
                        written = self.mapper.import_stocks([row])
                        imported += written
                    else:
                        failed += 1
                except Exception:
                    failed += 1

        elapsed = (datetime.now(UTC) - started).total_seconds()
        LOGGER.info(
            "Stock industry import finished: total=%d imported=%d failed=%d elapsed=%.1fs",
            len(pending),
            imported,
            failed,
            elapsed,
        )
        return ImportResult(
            total_codes=len(pending),
            imported=imported,
            failed=failed,
            skipped=len(existing),
            elapsed_seconds=elapsed,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _collect_fund_holding_codes(self) -> list[str]:
        """Extract unique stock codes from the top_holdings column of enriched funds."""
        import sqlite3
        from app.services.stock_industry_mapper import DB_PATH

        if not DB_PATH.exists():
            return []

        codes: set[str] = set()
        with sqlite3.connect(DB_PATH) as connection:
            rows = connection.execute(
                "SELECT top_holdings FROM funds WHERE is_enriched = 1 AND top_holdings != ''"
            ).fetchall()

        for (raw,) in rows:
            for token in raw.split(";"):
                code = self.mapper._normalize_code(token.strip())
                if code and len(code) == 6 and code.isdigit():
                    codes.add(code)

        return sorted(codes)

    def _fetch_industry(self, code: str) -> dict[str, str] | None:
        """Query Eastmoney F10 for one stock.  Returns a row dict or None."""
        exchange = "SH" if code.startswith("6") else "SZ"
        url = F10_API.format(exchange=exchange, code=code)
        try:
            req = urllib.request.Request(url, headers=REQUEST_HEADERS)
            with urllib.request.urlopen(req, timeout=10) as resp:
                payload: dict[str, Any] = json.loads(
                    resp.read().decode("utf-8", errors="replace")
                )
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            LOGGER.debug("F10 fetch failed for %s: %s", code, exc)
            return None

        jbzl = payload.get("jbzl")
        if not isinstance(jbzl, dict):
            return None

        industry = str(jbzl.get("sshy", "")).strip()
        name = str(jbzl.get("agjc", "")).strip()
        if not industry or industry == "--":
            return None

        return {
            "stock_code": code,
            "stock_name": name or code,
            "industry": industry,
            "source": "eastmoney_f10",
            "updated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        }
