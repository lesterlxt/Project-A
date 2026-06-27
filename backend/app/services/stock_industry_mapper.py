import logging
import sqlite3
from datetime import UTC, datetime
from pathlib import Path


DB_PATH = Path(__file__).resolve().parents[1] / "data" / "funds.db"
LOGGER = logging.getLogger(__name__)


class StockIndustryMapper:
    """
    Reads optional real stock industry mappings from SQLite.

    Expected table:

        stock_industry_map(
            stock_code TEXT PRIMARY KEY,
            stock_name TEXT,
            industry TEXT NOT NULL,
            source TEXT,
            updated_at TEXT
        )

    The table is intentionally not auto-filled with demo data. When it is absent
    or incomplete, callers should keep the industry field marked as inferred.
    """

    def ensure_table(self) -> None:
        """Create the optional real industry mapping table without seed rows."""
        if not DB_PATH.exists():
            return

        with sqlite3.connect(DB_PATH) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS stock_industry_map (
                    stock_code TEXT PRIMARY KEY,
                    stock_name TEXT,
                    industry TEXT NOT NULL,
                    source TEXT,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                "DELETE FROM stock_industry_map WHERE source = 'manual_seed'"
            )

    def count(self) -> int:
        """Return the number of real industry mappings currently stored."""
        if not DB_PATH.exists():
            return 0
        try:
            with sqlite3.connect(DB_PATH) as connection:
                row = connection.execute(
                    "SELECT COUNT(*) FROM stock_industry_map WHERE COALESCE(source, '') != 'manual_seed'"
                ).fetchone()
            return int(row[0]) if row else 0
        except sqlite3.OperationalError:
            return 0

    def import_stocks(self, rows: list[dict[str, str]]) -> int:
        """
        Bulk-insert or replace real stock industry mappings.

        Each row should contain: stock_code, stock_name, industry, source, updated_at.
        Returns the number of rows written.
        """
        if not rows or not DB_PATH.exists():
            return 0

        self.ensure_table()
        now = datetime.now(UTC).isoformat(timespec="seconds")

        with sqlite3.connect(DB_PATH) as connection:
            count = 0
            for row in rows:
                code = self._normalize_code(row.get("stock_code", ""))
                if not code:
                    continue
                name = str(row.get("stock_name", "")).strip() or code
                industry = str(row.get("industry", "")).strip()
                if not industry or industry == "--":
                    continue
                source = str(row.get("source", "eastmoney_f10"))
                updated_at = row.get("updated_at", now)
                connection.execute(
                    """
                    INSERT OR REPLACE INTO stock_industry_map
                        (stock_code, stock_name, industry, source, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (code, name, industry, source, updated_at),
                )
                count += 1
            return count

    def known_codes(self) -> set[str]:
        """Return the set of stock codes that already have real industry mappings."""
        if not DB_PATH.exists():
            return set()
        try:
            with sqlite3.connect(DB_PATH) as connection:
                rows = connection.execute(
                    """
                    SELECT stock_code FROM stock_industry_map
                    WHERE COALESCE(source, '') != 'manual_seed'
                    """
                ).fetchall()
            return {str(row[0]) for row in rows}
        except sqlite3.OperationalError:
            return set()

    def aggregate_by_holding_count(self, stock_codes: list[str]) -> tuple[dict[str, float], str]:
        """
        Count-based industry aggregation (fallback when holding weights are unavailable).

        Source marker: 'mapped_from_holding_count'
        """
        normalized_codes = [self._normalize_code(code) for code in stock_codes]
        normalized_codes = [code for code in normalized_codes if code]
        if not normalized_codes or not self._table_exists():
            return {}, ""

        placeholders = ",".join("?" for _ in normalized_codes)
        with sqlite3.connect(DB_PATH) as connection:
            rows = connection.execute(
                f"""
                SELECT industry, COUNT(*) AS holding_count
                FROM stock_industry_map
                WHERE stock_code IN ({placeholders})
                  AND industry IS NOT NULL
                  AND industry != ''
                  AND COALESCE(source, '') != 'manual_seed'
                GROUP BY industry
                """,
                normalized_codes,
            ).fetchall()

        total = sum(int(row[1]) for row in rows)
        if total <= 0:
            return {}, ""

        return {
            str(row[0]): round(int(row[1]) / total * 100, 1)
            for row in rows
        }, "mapped_from_holding_count"

    def aggregate_by_holding_weight(
        self,
        fund_code: str = "",
        holdings: list[dict[str, str]] | None = None,
    ) -> tuple[dict[str, float], str]:
        """
        Weight-based industry aggregation using fund_holdings table.

        Joins fund_holdings with stock_industry_map, sums holding_weight
        per industry, and returns percentage breakdown.

        If holdings param is provided (from fresh enrichment), use those directly.
        Otherwise falls back to DB query.

        Source marker: 'mapped_from_holding_weight'
        """
        if holdings:
            return self._aggregate_from_holdings_list(holdings)

        # Fall back to database query
        if not fund_code or not self._table_exists():
            return {}, ""

        if not self._holdings_table_exists():
            return {}, ""

        with sqlite3.connect(DB_PATH) as connection:
            rows = connection.execute(
                """
                SELECT sim.industry, SUM(fh.holding_weight) AS total_weight
                FROM fund_holdings fh
                JOIN stock_industry_map sim ON fh.stock_code = sim.stock_code
                WHERE fh.fund_code = ?
                  AND sim.industry IS NOT NULL
                  AND sim.industry != ''
                  AND COALESCE(sim.source, '') != 'manual_seed'
                GROUP BY sim.industry
                ORDER BY total_weight DESC
                """,
                (fund_code,),
            ).fetchall()

        total = sum(float(row[1]) for row in rows if row[1] is not None)
        if total <= 0:
            return {}, ""

        return {
            str(row[0]): round(float(row[1]) / total * 100, 1)
            for row in rows
            if row[1] is not None
        }, "mapped_from_holding_weight"

    def _aggregate_from_holdings_list(
        self, holdings: list[dict[str, str]]
    ) -> tuple[dict[str, float], str]:
        """Aggregate industry allocation from an in-memory holdings list."""
        if not holdings or not self._table_exists():
            return {}, ""

        codes = [h["stock_code"] for h in holdings]
        code_weight: dict[str, float] = {}
        for h in holdings:
            w = h.get("holding_weight", "")
            if w:
                try:
                    code_weight[h["stock_code"]] = float(w)
                except (ValueError, TypeError):
                    code_weight[h["stock_code"]] = 0.0
            else:
                code_weight[h["stock_code"]] = 0.0

        placeholders = ",".join("?" for _ in codes)
        with sqlite3.connect(DB_PATH) as connection:
            rows = connection.execute(
                f"""
                SELECT stock_code, industry
                FROM stock_industry_map
                WHERE stock_code IN ({placeholders})
                  AND industry IS NOT NULL
                  AND industry != ''
                  AND COALESCE(source, '') != 'manual_seed'
                """,
                codes,
            ).fetchall()

        industry_weight: dict[str, float] = {}
        for stock_code, industry in rows:
            w = code_weight.get(stock_code, 0)
            industry_weight[industry] = industry_weight.get(industry, 0) + w

        total = sum(industry_weight.values())
        if total <= 0:
            return {}, ""

        return {
            industry: round(weight / total * 100, 1)
            for industry, weight in industry_weight.items()
        }, "mapped_from_holding_weight"

    def _holdings_table_exists(self) -> bool:
        if not DB_PATH.exists():
            return False
        with sqlite3.connect(DB_PATH) as connection:
            row = connection.execute(
                """
                SELECT name
                FROM sqlite_master
                WHERE type='table' AND name='fund_holdings'
                """
            ).fetchone()
        return row is not None

    def _table_exists(self) -> bool:
        if not DB_PATH.exists():
            return False
        with sqlite3.connect(DB_PATH) as connection:
            row = connection.execute(
                """
                SELECT name
                FROM sqlite_master
                WHERE type='table' AND name='stock_industry_map'
                """
            ).fetchone()
        return row is not None

    def _normalize_code(self, code: str) -> str:
        cleaned = code.strip()
        if not cleaned:
            return ""
        parts = cleaned.split(".")
        return parts[-1] if parts else cleaned
