import json
import re
import urllib.request
from datetime import UTC, datetime
from typing import Any

from app.schemas import EFundSupermarketItem, EFundSupermarketResponse


EFUND_SUPERMARKET_URL = "https://www.efunds.com.cn/lm/jjcp/"


class EFundSupermarketService:
    source = "E Fund official fund supermarket"

    def snapshot(self, limit: int = 8) -> EFundSupermarketResponse:
        try:
            html = self._http_text(EFUND_SUPERMARKET_URL)
            rows = self._extract_rows(html)
        except Exception:
            rows = []
        return EFundSupermarketResponse(
            updated_at=datetime.now(UTC).isoformat(timespec="seconds"),
            source=self.source,
            total_count=len(rows),
            items=[self._to_item(row) for row in rows[:limit]],
        )

    def _extract_rows(self, html: str) -> list[dict[str, Any]]:
        match = re.search(r"var\s+__FUND_SUPER_MARKET_DATA__\s*=\s*(\[.*?\]);", html, flags=re.S)
        if match is None:
            return []
        payload = json.loads(match.group(1))
        if not isinstance(payload, list):
            return []
        return [row for row in payload if isinstance(row, dict)]

    def _to_item(self, row: dict[str, Any]) -> EFundSupermarketItem:
        properties = row.get("properties") if isinstance(row.get("properties"), dict) else {}
        return EFundSupermarketItem(
            fund_code=str(row.get("fundcode") or ""),
            fund_name=str(row.get("fundname") or row.get("fundSourceName") or ""),
            fund_type=str(row.get("fundType") or ""),
            risk_level=str(properties.get("riskLevel") or ""),
            manager=str(row.get("managerName") or ""),
            net_value=str(row.get("netvalue") or row.get("incomeunit") or ""),
            trade_date=self._format_date(str(row.get("tdate") or "")),
            daily_change_percent=self._number(row.get("rzd")),
            one_month_percent=self._number(row.get("lastMonthIncome")),
            one_year_percent=self._number(row.get("lastYearIncome")),
        )

    def _http_text(self, url: str) -> str:
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 ProjectA/0.1",
                "Accept": "text/html,application/xhtml+xml,*/*",
            },
        )
        with urllib.request.urlopen(request, timeout=18) as response:
            return response.read().decode("utf-8", errors="replace")

    def _number(self, value: Any) -> float | None:
        if value in {None, "", "-"}:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _format_date(self, value: str) -> str:
        if len(value) == 8 and value.isdigit():
            return f"{value[:4]}-{value[4:6]}-{value[6:]}"
        return value
