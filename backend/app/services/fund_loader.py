import sqlite3
from dataclasses import dataclass
from pathlib import Path


DB_PATH = Path(__file__).resolve().parents[1] / "data" / "funds.db"


@dataclass(frozen=True)
class Fund:
    fund_code: str
    fund_name: str
    fund_type: str
    manager: str
    positioning: list[str]
    top_holdings: list[str]
    industry_allocation: dict[str, float]
    industry_allocation_source: str
    one_year_return: float | None
    volatility: float | None
    max_drawdown: float | None
    risk_level: str
    suitable_clients: str
    latest_nav: str
    estimated_growth: str
    data_source: str
    data_updated_at: str
    is_enriched: bool


def _split_semicolon(value: str) -> list[str]:
    return [item.strip() for item in value.split(";") if item.strip()]


def _parse_percent(value: str) -> float | None:
    cleaned = value.strip().replace("%", "")
    if not cleaned or cleaned in {"未知", "暂无", "None", "null"}:
        return None
    return float(cleaned)


def _parse_industry_allocation(value: str) -> dict[str, float]:
    allocation: dict[str, float] = {}
    for item in _split_semicolon(value):
        if ":" not in item:
            continue
        name, percent = item.split(":", 1)
        parsed = _parse_percent(percent)
        if parsed is not None:
            allocation[name.strip()] = parsed
    return allocation


class FundLoader:
    def load(self) -> list[Fund]:
        if not DB_PATH.exists():
            raise FileNotFoundError(
                "No SQLite fund pool found. Run POST /api/funds/sync to create funds.db first."
            )

        return self._load_sqlite()

    def _load_sqlite(self) -> list[Fund]:
        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(funds)").fetchall()
            }
            industry_source_expr = (
                "industry_allocation_source"
                if "industry_allocation_source" in columns
                else "'' AS industry_allocation_source"
            )
            rows = connection.execute(
                f"""
                SELECT
                    fund_code,
                    fund_name,
                    fund_type,
                    manager,
                    positioning,
                    top_holdings,
                    industry_allocation,
                    {industry_source_expr},
                    one_year_return,
                    volatility,
                    max_drawdown,
                    risk_level,
                    suitable_clients,
                    latest_nav,
                    estimated_growth,
                    data_source,
                    data_updated_at,
                    is_enriched
                FROM funds
                """
            ).fetchall()
        return [self._row_to_fund(dict(row)) for row in rows]

    def status(self) -> dict[str, str | int | bool | None]:
        if not DB_PATH.exists():
            return {
                "available": False,
                "storage": "SQLite",
                "source": "",
                "total_count": 0,
                "enriched_count": 0,
                "latest_updated_at": None,
                "db_path": str(DB_PATH),
            }

        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            row = connection.execute(
                """
                SELECT
                    COUNT(*) AS total_count,
                    COALESCE(SUM(is_enriched), 0) AS enriched_count,
                    MAX(data_updated_at) AS latest_updated_at,
                    MAX(data_source) AS source
                FROM funds
                """
            ).fetchone()

        return {
            "available": True,
            "storage": "SQLite",
            "source": row["source"] or "",
            "total_count": int(row["total_count"] or 0),
            "enriched_count": int(row["enriched_count"] or 0),
            "latest_updated_at": row["latest_updated_at"],
            "db_path": str(DB_PATH),
        }

    def summary(self) -> dict[str, object]:
        if not DB_PATH.exists():
            return {
                "available": False,
                "source": "",
                "total_count": 0,
                "enriched_count": 0,
                "fund_type_distribution": [],
                "risk_level_distribution": [],
            }

        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            status_row = connection.execute(
                """
                SELECT
                    COUNT(*) AS total_count,
                    COALESCE(SUM(is_enriched), 0) AS enriched_count,
                    MAX(data_source) AS source
                FROM funds
                """
            ).fetchone()
            fund_type_rows = connection.execute(
                """
                SELECT COALESCE(NULLIF(fund_type, ''), '未知') AS label, COUNT(*) AS count
                FROM funds
                GROUP BY COALESCE(NULLIF(fund_type, ''), '未知')
                ORDER BY count DESC
                LIMIT 8
                """
            ).fetchall()
            risk_level_rows = connection.execute(
                """
                SELECT COALESCE(NULLIF(risk_level, ''), '未知') AS label, COUNT(*) AS count
                FROM funds
                GROUP BY COALESCE(NULLIF(risk_level, ''), '未知')
                ORDER BY label
                """
            ).fetchall()

        return {
            "available": True,
            "source": status_row["source"] or "",
            "total_count": int(status_row["total_count"] or 0),
            "enriched_count": int(status_row["enriched_count"] or 0),
            "fund_type_distribution": [
                {"label": row["label"], "count": int(row["count"] or 0)}
                for row in fund_type_rows
            ],
            "risk_level_distribution": [
                {"label": row["label"], "count": int(row["count"] or 0)}
                for row in risk_level_rows
            ],
        }

    def _row_to_fund(self, row: dict[str, str]) -> Fund:
        return Fund(
            fund_code=row["fund_code"],
            fund_name=row["fund_name"],
            fund_type=row["fund_type"],
            manager=row["manager"],
            positioning=_split_semicolon(row["positioning"]),
            top_holdings=_split_semicolon(row["top_holdings"]),
            industry_allocation=_parse_industry_allocation(row["industry_allocation"]),
            industry_allocation_source=str(row.get("industry_allocation_source") or ""),
            one_year_return=_parse_percent(row["one_year_return"]),
            volatility=_parse_percent(row["volatility"]),
            max_drawdown=_parse_percent(row["max_drawdown"]),
            risk_level=row["risk_level"],
            suitable_clients=row["suitable_clients"],
            latest_nav=str(row.get("latest_nav") or ""),
            estimated_growth=str(row.get("estimated_growth") or ""),
            data_source=str(row.get("data_source") or ""),
            data_updated_at=str(row.get("data_updated_at") or ""),
            is_enriched=bool(int(row.get("is_enriched") or 0)),
        )
