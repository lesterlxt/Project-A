import email.utils
import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import UTC, datetime

from app.schemas import HotspotItem, TodayHotspotsResponse
from app.services.llm_client import DeepSeekClient


class HotspotProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class NewsHeadline:
    title: str
    source: str
    published_at: str


class NewsHotspotProvider:
    def __init__(self) -> None:
        self.llm = DeepSeekClient()
        self.queries = [
            "A股 市场 热点 行业 主题 投资",
            "中国 产业 热点 AI 机器人 创新药 低空经济 半导体",
            "券商 策略 行业 配置 热点 主题 A股",
        ]

    def today(self) -> TodayHotspotsResponse:
        if not self.llm.is_configured:
            raise HotspotProviderError("DEEPSEEK_API_KEY is required for real hotspot extraction")

        headlines = self._fetch_headlines()
        if not headlines:
            raise HotspotProviderError("No news headlines were fetched from live sources")

        hotspots = self._extract_hotspots(headlines)
        return TodayHotspotsResponse(
            updated_at=datetime.now(UTC).isoformat(timespec="seconds"),
            source="Google News RSS + DeepSeek",
            items=hotspots,
        )

    def _fetch_headlines(self) -> list[NewsHeadline]:
        deduped: dict[str, NewsHeadline] = {}
        for query in self.queries:
            url = self._rss_url(query)
            request = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 ProjectA/0.1",
                    "Accept": "application/rss+xml, application/xml, text/xml",
                },
            )
            with urllib.request.urlopen(request, timeout=20) as response:
                xml_text = response.read().decode("utf-8", errors="replace")

            root = ET.fromstring(xml_text)
            for item in root.findall("./channel/item"):
                raw_title = (item.findtext("title") or "").strip()
                if not raw_title:
                    continue
                source = item.findtext("source") or "Google News"
                pub_date = item.findtext("pubDate") or ""
                title = self._clean_title(raw_title)
                deduped[title] = NewsHeadline(
                    title=title,
                    source=source.strip(),
                    published_at=self._parse_pub_date(pub_date),
                )
                if len(deduped) >= 60:
                    break
        return list(deduped.values())[:60]

    def _extract_hotspots(self, headlines: list[NewsHeadline]) -> list[HotspotItem]:
        payload = [headline.__dict__ for headline in headlines]
        result = self.llm.chat_json(
            system_prompt=(
                "你是基金公司市场热点研究助手。你只能基于用户提供的新闻标题提炼热点，"
                "不要编造标题之外的事实。只输出严格 JSON。"
            ),
            user_prompt=(
                "下面是真实新闻 RSS 抓取到的财经/产业/基金相关标题。"
                "请提炼适合基金营销选品系统使用的今日市场热点 Top 5。\n"
                "优先选择可映射到行业、产业链或投资主题的热点，例如 AI、机器人、半导体、创新药、红利、低空经济、农业、消费、军工。\n"
                "不要把基金公司运营新闻、监管整改、产品发行数量、策略会活动本身列为热点，除非它明确对应某个可投资行业主题。\n"
                f"新闻标题 JSON：{json.dumps(payload, ensure_ascii=False)}\n"
                "返回 JSON：{\"hotspots\": [...]}\n"
                "每个 hotspot 字段：name, heat_score, summary, related_keywords。\n"
                "要求：name 是短热点名，heat_score 是 1-100 的整数，summary 一句话，"
                "related_keywords 是 3-6 个短关键词。不要写任何投资建议或收益承诺。"
            ),
            temperature=0.2,
        )

        raw_items = result["hotspots"]
        if not isinstance(raw_items, list) or not raw_items:
            raise HotspotProviderError("DeepSeek did not return hotspot items")

        items: list[HotspotItem] = []
        for raw in raw_items[:5]:
            items.append(
                HotspotItem(
                    name=str(raw["name"]),
                    heat_score=max(1, min(100, int(raw["heat_score"]))),
                    summary=str(raw["summary"]),
                    related_keywords=[str(item) for item in raw["related_keywords"]][:6],
                    source="Google News RSS + DeepSeek",
                )
            )
        return items

    def _rss_url(self, query: str) -> str:
        encoded = urllib.parse.quote(query)
        return f"https://news.google.com/rss/search?q={encoded}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"

    def _clean_title(self, title: str) -> str:
        if " - " in title:
            return title.rsplit(" - ", 1)[0].strip()
        return title.strip()

    def _parse_pub_date(self, value: str) -> str:
        if not value:
            return ""
        try:
            parsed = email.utils.parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return value
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC).isoformat(timespec="seconds")
