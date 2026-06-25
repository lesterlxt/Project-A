import json
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.schemas import MarketOverviewItem, MarketOverviewResponse


REFRESH_INTERVAL_SECONDS = 300


@dataclass(frozen=True)
class MarketMetric:
    market_dimension: str
    indicator_name: str
    eastmoney_secid: str
    related_fund_types: list[str]
    channel_scenario: str
    tencent_code: str | None = None
    yahoo_symbol: str | None = None
    is_yield: bool = False


MARKET_METRICS = [
    MarketMetric(
        market_dimension="A股核心宽基",
        indicator_name="沪深300",
        eastmoney_secid="1.000300",
        tencent_code="sh000300",
        yahoo_symbol="000300.SS",
        related_fund_types=["沪深300ETF联接", "宽基指数", "核心资产"],
        channel_scenario="适合做大盘核心资产和长期定投沟通。",
    ),
    MarketMetric(
        market_dimension="A股核心宽基",
        indicator_name="中证A500",
        eastmoney_secid="1.000510",
        tencent_code="sh000510",
        yahoo_symbol="000510.SS",
        related_fund_types=["中证A500指数", "宽基指数", "全市场配置"],
        channel_scenario="适合做新宽基、均衡配置和换仓对比沟通。",
    ),
    MarketMetric(
        market_dimension="成长风格",
        indicator_name="创业板指",
        eastmoney_secid="0.399006",
        tencent_code="sz399006",
        yahoo_symbol="399006.SZ",
        related_fund_types=["成长风格", "科技成长", "创业板指数"],
        channel_scenario="适合进取型客户的成长弹性和波动风险沟通。",
    ),
    MarketMetric(
        market_dimension="红利低波",
        indicator_name="中证红利",
        eastmoney_secid="1.000922",
        tencent_code="sh000922",
        yahoo_symbol="000922.SS",
        related_fund_types=["红利低波", "高股息", "价值风格"],
        channel_scenario="适合稳健客户的分红、低估值和波动控制沟通。",
    ),
    MarketMetric(
        market_dimension="债券市场",
        indicator_name="美国10年期国债收益率",
        eastmoney_secid="171.US10Y",
        yahoo_symbol="^TNX",
        related_fund_types=["债券基金", "固收+", "美元债"],
        channel_scenario="适合解释利率变化对债券和固收+产品的影响。",
        is_yield=True,
    ),
    MarketMetric(
        market_dimension="港股科技",
        indicator_name="恒生科技指数",
        eastmoney_secid="124.HSTECH",
        yahoo_symbol="HSTECH.HK",
        related_fund_types=["港股科技", "QDII", "互联网主题"],
        channel_scenario="适合讨论港股科技估值修复和跨市场配置。",
    ),
    MarketMetric(
        market_dimension="海外科技",
        indicator_name="纳斯达克100",
        eastmoney_secid="100.NDX",
        yahoo_symbol="^NDX",
        related_fund_types=["纳指100", "QDII", "海外科技"],
        channel_scenario="适合高风险承受客户的海外科技配置沟通。",
    ),
]


class MarketDataService:
    source = "Eastmoney quote + Tencent daily kline + Yahoo Finance chart"

    def overview(self) -> MarketOverviewResponse:
        try:
            current_quotes = self._fetch_eastmoney_quotes([item.eastmoney_secid for item in MARKET_METRICS])
        except Exception:
            current_quotes = {}
        rows = [
            self._build_item(metric, current_quotes.get(metric.eastmoney_secid))
            for metric in MARKET_METRICS
        ]
        return MarketOverviewResponse(
            updated_at=datetime.now(UTC).isoformat(timespec="seconds"),
            source=self.source,
            refresh_interval_seconds=REFRESH_INTERVAL_SECONDS,
            items=rows,
        )

    def _build_item(self, metric: MarketMetric, quote: dict[str, Any] | None) -> MarketOverviewItem:
        latest = self._number(quote.get("f2")) if quote else None
        change_percent = self._number(quote.get("f3")) if quote else None
        change_value = self._number(quote.get("f4")) if quote else None
        one_month = self._one_month_performance(metric)
        status = "available" if latest is not None and change_percent is not None else "unavailable"

        return MarketOverviewItem(
            market_dimension=metric.market_dimension,
            indicator_name=metric.indicator_name,
            latest_value=latest,
            change_value=change_value,
            change_percent=change_percent,
            one_month_percent=one_month,
            interpretation=self._interpret(metric, change_percent, one_month),
            related_fund_types=metric.related_fund_types,
            channel_scenario=metric.channel_scenario,
            status=status,
            source=self.source if status == "available" else "",
        )

    def _fetch_eastmoney_quotes(self, secids: list[str]) -> dict[str, dict[str, Any]]:
        query = urllib.parse.urlencode({
            "fltt": "2",
            "invt": "2",
            "fields": "f12,f13,f14,f2,f3,f4,f152",
            "secids": ",".join(secids),
        })
        payload = self._http_json(f"https://push2.eastmoney.com/api/qt/ulist.np/get?{query}")
        rows = ((payload.get("data") or {}).get("diff") or []) if isinstance(payload, dict) else []
        quotes: dict[str, dict[str, Any]] = {}
        for row in rows:
            secid = f"{row.get('f13')}.{row.get('f12')}"
            quotes[secid] = row
        return quotes

    def _one_month_performance(self, metric: MarketMetric) -> float | None:
        if metric.tencent_code:
            try:
                value = self._tencent_one_month(metric.tencent_code)
            except Exception:
                value = None
            if value is not None:
                return value
        if metric.yahoo_symbol:
            try:
                return self._yahoo_one_month(metric.yahoo_symbol)
            except Exception:
                return None
        return None

    def _tencent_one_month(self, code: str) -> float | None:
        params = f"{code},day,,,31,qfq"
        url = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?" + urllib.parse.urlencode({"param": params})
        payload = self._http_json(url, referer="https://gu.qq.com/")
        rows = (((payload.get("data") or {}).get(code) or {}).get("qfqday") or
                ((payload.get("data") or {}).get(code) or {}).get("day") or [])
        closes = [self._number(row[2]) for row in rows if isinstance(row, list) and len(row) >= 3]
        return self._performance_from_closes(closes)

    def _yahoo_one_month(self, symbol: str) -> float | None:
        encoded = urllib.parse.quote(symbol, safe="")
        payload = self._http_json(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?range=1mo&interval=1d"
        )
        result = ((payload.get("chart") or {}).get("result") or []) if isinstance(payload, dict) else []
        if not result:
            return None
        closes = (((result[0].get("indicators") or {}).get("quote") or [{}])[0].get("close") or [])
        return self._performance_from_closes([self._number(value) for value in closes])

    def _performance_from_closes(self, closes: list[float | None]) -> float | None:
        values = [value for value in closes if value is not None and value > 0]
        if len(values) < 2:
            return None
        return round((values[-1] / values[0] - 1) * 100, 2)

    def _interpret(self, metric: MarketMetric, change_percent: float | None, one_month: float | None) -> str:
        if change_percent is None:
            return "实时行情暂不可用。"

        if metric.is_yield:
            if change_percent > 0:
                return "利率上行，债券承压，关注久期和波动。"
            if change_percent < 0:
                return "利率下行，债券受益，关注固收+配置价值。"
            return "利率变化有限，围绕稳健底仓配置。"

        if change_percent > 1 and (one_month or 0) > 0:
            return "短期走强且月度趋势偏正，可作为配置窗口参考。"
        if change_percent > 0:
            return "当日上行，关注主题匹配和追高风险。"
        if change_percent < -1:
            return "回调较明显，提示波动风险，观察分批配置机会。"
        if change_percent < 0:
            return "小幅回落，强调长期配置和风险承受。"
        return "变化有限，中性配置参考。"

    def _http_json(self, url: str, referer: str | None = None) -> dict[str, Any]:
        headers = {
            "User-Agent": "Mozilla/5.0 ProjectA/0.1",
            "Accept": "application/json,text/plain,*/*",
        }
        if referer:
            headers["Referer"] = referer
        request = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(request, timeout=12) as response:
            return json.loads(response.read().decode("utf-8-sig", errors="replace"))

    def _number(self, value: Any) -> float | None:
        if value in {None, "", "-"}:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
