import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parents[1] / "data" / "funds.db"


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

    def aggregate_by_holding_count(self, stock_codes: list[str]) -> tuple[dict[str, float], str]:
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
        }, "mapped_from_stock_industry_map"

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
