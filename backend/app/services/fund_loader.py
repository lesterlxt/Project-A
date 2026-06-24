import csv
import sqlite3
from dataclasses import dataclass
from pathlib import Path


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "funds.csv"
REAL_DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "real_funds.csv"
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
    one_year_return: float | None
    volatility: float | None
    max_drawdown: float | None
    risk_level: str
    suitable_clients: str


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
    def __init__(self, data_path: Path = DATA_PATH) -> None:
        self.data_path = REAL_DATA_PATH if REAL_DATA_PATH.exists() else data_path

    def load(self) -> list[Fund]:
        if DB_PATH.exists():
            return self._load_sqlite()

        with self.data_path.open("r", encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file)
            return [self._row_to_fund(row) for row in reader]

    def _load_sqlite(self) -> list[Fund]:
        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                """
                SELECT
                    fund_code,
                    fund_name,
                    fund_type,
                    manager,
                    positioning,
                    top_holdings,
                    industry_allocation,
                    one_year_return,
                    volatility,
                    max_drawdown,
                    risk_level,
                    suitable_clients
                FROM funds
                """
            ).fetchall()
        return [self._row_to_fund(dict(row)) for row in rows]

    def _row_to_fund(self, row: dict[str, str]) -> Fund:
        return Fund(
            fund_code=row["fund_code"],
            fund_name=row["fund_name"],
            fund_type=row["fund_type"],
            manager=row["manager"],
            positioning=_split_semicolon(row["positioning"]),
            top_holdings=_split_semicolon(row["top_holdings"]),
            industry_allocation=_parse_industry_allocation(row["industry_allocation"]),
            one_year_return=_parse_percent(row["one_year_return"]),
            volatility=_parse_percent(row["volatility"]),
            max_drawdown=_parse_percent(row["max_drawdown"]),
            risk_level=row["risk_level"],
            suitable_clients=row["suitable_clients"],
        )
