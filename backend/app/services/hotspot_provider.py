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

        headlines: list[NewsHeadline] = []
        source_label = ""
        # Try Google News RSS first, then Eastmoney scrape as fallback
        for fetcher, label in [
            (self._fetch_headlines_google, "Google News RSS"),
            (self._fetch_headlines_eastmoney, "东方财富财经新闻"),
        ]:
            try:
                headlines = fetcher()
                if headlines:
                    source_label = label
                    break
            except Exception:
                continue
        if not headlines:
            raise HotspotProviderError("No news headlines were fetched from any live source")

        hotspots = self._extract_hotspots(headlines)
        return TodayHotspotsResponse(
            updated_at=datetime.now(UTC).isoformat(timespec="seconds"),
            source=f"{source_label} + DeepSeek",
            items=hotspots,
        )

    def _fetch_headlines_google(self) -> list[NewsHeadline]:
        deduped: dict[str, NewsHeadline] = {}
        for query in self.queries:
            try:
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
            except Exception:
                continue
        return list(deduped.values())[:60]

    def _fetch_headlines_eastmoney(self) -> list[NewsHeadline]:
        """Fallback: scrape Eastmoney finance homepage for headlines."""
        deduped: dict[str, NewsHeadline] = {}
        try:
            request = urllib.request.Request(
                "https://finance.eastmoney.com/",
                headers={
                    "User-Agent": "Mozilla/5.0 ProjectA/0.1",
                    "Accept": "text/html,application/xhtml+xml,*/*",
                },
            )
            with urllib.request.urlopen(request, timeout=12) as response:
                html = response.read().decode("gbk", errors="replace")

            import re
            titles = re.findall(r'<a[^>]*title=\"([^\"]{8,120})\"[^>]*>', html)
            now = datetime.now(UTC).isoformat(timespec="seconds")
            noise_words = {"广告", "举报", "违法", "接听", "市民", "警方", "征信", "亲爱的"}
            for title in titles:
                title = title.strip()
                if not title or any(w in title for w in noise_words):
                    continue
                deduped[title] = NewsHeadline(
                    title=title,
                    source="东方财富",
                    published_at=now,
                )
                if len(deduped) >= 50:
                    break
        except Exception:
            pass
        return list(deduped.values())[:50]

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
                "每个 hotspot 字段：name, heat_score, summary, related_keywords, evidence_titles。\n"
                "要求：name 是短热点名，heat_score 是 1-100 的整数，summary 一句话，"
                "related_keywords 是 3-6 个短关键词，evidence_titles 是 1-3 个来自新闻标题 JSON 的原始标题。"
                "不要写任何投资建议或收益承诺。"
            ),
            temperature=0.2,
        )

        raw_items = result["hotspots"]
        if not isinstance(raw_items, list) or not raw_items:
            raise HotspotProviderError("DeepSeek did not return hotspot items")

        items: list[HotspotItem] = []
        for raw in raw_items[:5]:
            related_keywords = [str(item) for item in raw["related_keywords"]][:6]
            evidence_headlines = self._match_evidence(
                raw_titles=[str(item) for item in raw.get("evidence_titles", [])],
                keywords=[str(raw["name"]), *related_keywords],
                headlines=headlines,
            )
            items.append(
                HotspotItem(
                    name=str(raw["name"]),
                    heat_score=max(1, min(100, int(raw["heat_score"]))),
                    summary=str(raw["summary"]),
                    related_keywords=related_keywords,
                    source="Google News RSS + DeepSeek",
                    source_detail="Google News RSS 抓取财经/产业标题，DeepSeek 仅基于这些标题提炼热点和热度分。",
                    evidence_headlines=evidence_headlines,
                )
            )
        return items

    def _match_evidence(
        self,
        *,
        raw_titles: list[str],
        keywords: list[str],
        headlines: list[NewsHeadline],
    ) -> list[dict[str, str]]:
        by_title = {headline.title: headline for headline in headlines}
        matched: list[NewsHeadline] = []

        for title in raw_titles:
            headline = by_title.get(title)
            if headline and headline not in matched:
                matched.append(headline)

        if len(matched) < 3:
            normalized_keywords = [keyword.lower() for keyword in keywords if keyword.strip()]
            for headline in headlines:
                title_text = headline.title.lower()
                if headline not in matched and any(keyword in title_text for keyword in normalized_keywords):
                    matched.append(headline)
                if len(matched) >= 3:
                    break

        return [
            {
                "title": headline.title,
                "source": headline.source,
                "published_at": headline.published_at,
            }
            for headline in matched[:3]
        ]

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
