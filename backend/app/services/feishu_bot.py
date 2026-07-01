"""
Feishu (Lark) chatbot service.

Connects via WebSocket long-connection — no public URL needed for local dev.
Receives messages from Feishu, classifies intent via DeepSeek, and calls
the existing backend pipeline to generate structured card replies.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any

import lark_oapi as lark
from lark_oapi.api.im.v1 import (
    CreateMessageRequest,
    CreateMessageRequestBody,
)
from lark_oapi.event.dispatcher_handler import EventDispatcherHandler
from lark_oapi.ws import Client as WsClient

from app.agents.hotspot_agent import HotspotAgent
from app.orchestrator.graph_orchestrator import GraphOrchestrator
from app.schemas import CampaignRequest, RecommendedFund, ScoreBreakdown
from app.services.feishu_card import (
    build_analysis_card,
    build_campaign_result_card,
    build_copy_card,
    build_error_card,
    build_fund_detail_card,
    build_help_card,
    build_hotspot_list_card,
)
from app.services.fund_loader import Fund, FundLoader
from app.services.hotspot_provider import NewsHotspotProvider
from app.services.llm_client import DeepSeekClient, _env_value

logger = logging.getLogger("feishu_bot")
logger.setLevel(logging.INFO)


def _now_local_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

# ── Intent Classification Prompt ──────────────────────────────────────

INTENT_PROMPT = """你是一个意图分类器，分析用户对基金营销助手的消息，返回 JSON。

支持的操作：
- list_hotspots: 查看今日热点（"今天有什么热点""最近热点""热点"）
- analyze_topic: 分析一个主题/行业（"分析AI""人工智能怎么样""红利策略分析"）
- run_campaign: 生成推介/选品/话术（"生成推介""推荐基金""招行话术""给我推荐"）
- lookup_fund: 查询具体基金（"查基金000001""帮我看看110011""易方达人工智能ETF怎么样"）
- show_copy: 查看已生成文案的详情（"看看话术""完整文案"）
- help: 帮助/问候/不知道干什么/你好

返回格式：
{"action": "<intent>", "topic": "<提取的主题/基金名称>", "channel": "<提到的渠道>", "fund_code": "<6位数字基金代码>", "top_k": 5}

渠道：招商银行/工商银行/建设银行/农业银行/中国银行。未提及时默认"招商银行"。
基金代码是6位纯数字；如果用户按基金名称查询，fund_code 可以为空，topic 填基金名称或关键词。top_k 默认3，用户说具体数量时提取（如"推荐5只"则 top_k=5）。
topic 是用户关注的主题/行业/热点名称。

只返回 JSON，不要其他内容。"""

# ── Service ────────────────────────────────────────────────────────────


class FeishuBotService:
    """WebSocket-based Feishu chatbot that delegates to existing backend services."""

    def __init__(self) -> None:
        self._app_id = _env_value("FEISHU_APP_ID")
        self._app_secret = _env_value("FEISHU_APP_SECRET")
        self._configured = bool(self._app_id and self._app_secret)

        if self._configured:
            self._client: lark.Client | None = (
                lark.Client.builder()
                .app_id(self._app_id)
                .app_secret(self._app_secret)
                .build()
            )
        else:
            self._client = None

        # Business services (shared with main.py singletons)
        self.llm = DeepSeekClient()
        self.hotspot_provider = NewsHotspotProvider()
        self.hotspot_agent = HotspotAgent()
        self.fund_loader = FundLoader()
        self.graph_orchestrator = GraphOrchestrator()

        # Per-chat state: latest campaign result for "show_copy" follow-up
        self._chat_results: dict[str, Any] = {}

        # Background task handle
        self._ws_task: asyncio.Future | None = None
        self._ws_started = False
        self._last_error = ""
        self._last_message_text = ""
        self._last_message_at = ""
        self._last_reply_at = ""
        self._last_reply_error = ""
        self._last_intent: dict[str, Any] = {}
        self._last_lookup_code = ""
        self._last_lookup_query = ""
        self._last_lookup_match_count = 0
        self._last_lookup_matches: list[str] = []

    # ── Public API ─────────────────────────────────────────────────

    @property
    def is_configured(self) -> bool:
        return self._configured

    def status(self) -> dict[str, Any]:
        ws_done = bool(self._ws_task and self._ws_task.done())
        ws_error = self._last_error
        if self._ws_task and self._ws_task.done():
            try:
                self._ws_task.result()
            except Exception as exc:
                ws_error = f"{type(exc).__name__}: {exc}"

        return {
            "configured": self._configured,
            "ws_started": self._ws_started,
            "ws_task_done": ws_done,
            "last_error": ws_error,
            "last_message_at": self._last_message_at,
            "last_message_preview": self._last_message_text[:80],
            "last_reply_at": self._last_reply_at,
            "last_reply_error": self._last_reply_error,
            "last_intent": self._last_intent,
            "last_lookup_code": self._last_lookup_code,
            "last_lookup_query": self._last_lookup_query,
            "last_lookup_match_count": self._last_lookup_match_count,
            "last_lookup_matches": self._last_lookup_matches,
        }

    async def start(self) -> None:
        """Launch the WebSocket client as a background asyncio task."""
        if not self._configured:
            logger.info("[FeishuBot] Not configured — skipping WebSocket start")
            return

        loop = asyncio.get_running_loop()
        self._ws_task = loop.run_in_executor(None, self._run_ws_blocking)
        self._ws_started = True
        logger.info("[FeishuBot] WebSocket client starting in background...")

    async def stop(self) -> None:
        """Placeholder for graceful shutdown (WS client owns its own lifecycle)."""
        logger.info("[FeishuBot] Shutting down...")

    # ── WebSocket ──────────────────────────────────────────────────

    def _run_ws_blocking(self) -> None:
        """Blocking WS loop — runs in a thread-pool executor so the async
        event loop is not blocked.

        The lark WS client calls our handler callbacks on its own threads.
        """
        try:
            ws_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(ws_loop)
            import lark_oapi.ws.client as ws_client_module

            # lark-oapi stores a module-level event loop at import time. Uvicorn
            # may import it while its own loop is running, so force the SDK to
            # use this worker thread's private loop for the blocking WS client.
            ws_client_module.loop = ws_loop
            handler = (
                EventDispatcherHandler.builder("", "")
                .register_p2_im_message_receive_v1(self._on_message_receive)
                .build()
            )

            ws = WsClient(
                self._app_id,
                self._app_secret,
                event_handler=handler,
                log_level=lark.LogLevel.INFO,
            )
            logger.info("[FeishuBot] WebSocket connected, listening for events...")
            ws.start()
        except Exception as exc:
            self._last_error = f"{type(exc).__name__}: {exc}"
            logger.exception("[FeishuBot] WebSocket client stopped with error")
            raise

    # ── Event Handlers ─────────────────────────────────────────────

    def _on_chat_create(self, event: Any) -> None:
        """First-time P2P chat opened with the bot — send a welcome card."""
        logger.info("[FeishuBot] New P2P chat created")
        # The event is a v1.0 P2PChatCreate event
        try:
            chat_id = getattr(event, "chat_id", "")
            if chat_id:
                self._send_card(chat_id, "chat_id", build_help_card())
        except Exception:
            logger.exception("[FeishuBot] Failed to send welcome card")

    def _on_message_receive(self, event: Any) -> None:
        """Handle im.message.receive_v1 events.

        Runs synchronously on the WS client's thread; we schedule the async
        processing onto the main event loop via asyncio.run_coroutine_threadsafe.
        """
        logger.info("[FeishuBot] Message received")
        try:
            # Extract the event payload — lark SDK gives us a typed object
            msg_event = getattr(event, "event", None)
            if msg_event is None:
                return

            message = getattr(msg_event, "message", None)
            if message is None:
                return

            # Parse message content (Feishu sends it as a JSON string)
            content_str = getattr(message, "content", "{}")
            content = json.loads(content_str)
            text = content.get("text", "").strip()
            if not text:
                # Check for rich text / post content
                text = self._extract_text_from_content(content)

            if not text:
                logger.info("[FeishuBot] Empty message, ignoring")
                return

            self._last_message_text = text
            self._last_message_at = _now_local_iso()

            # Determine receive_id for reply
            chat_id = getattr(message, "chat_id", "")
            chat_type = getattr(message, "chat_type", "p2p")
            sender = getattr(msg_event, "sender", None)
            open_id = getattr(getattr(sender, "sender_id", None), "open_id", "")

            # Reply to the conversation when possible. chat_id works for both
            # direct chats and groups and avoids extra user-scope requirements.
            if chat_id:
                receive_id = chat_id
                receive_id_type = "chat_id"
            else:
                receive_id = open_id
                receive_id_type = "open_id"

            logger.info(
                "[FeishuBot] text=%r chat_type=%s receive_id=%s",
                text[:100],
                chat_type,
                receive_id,
            )

            # Schedule async processing
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                # No running loop — process synchronously in the WS thread
                asyncio.run(self._process_message(text, receive_id, receive_id_type))
                return

            asyncio.run_coroutine_threadsafe(
                self._process_message(text, receive_id, receive_id_type),
                loop,
            )

        except Exception:
            logger.exception("[FeishuBot] Error in message handler")

    @staticmethod
    def _extract_text_from_content(content: dict) -> str:
        """Try to extract text from Feishu post/rich-text content."""
        # Rich text posts have a "content" nested structure
        post = content.get("post", content.get("content", {}))
        if isinstance(post, dict):
            for lang in post.values():
                if isinstance(lang, list):
                    parts = []
                    for block in lang:
                        if isinstance(block, list):
                            for elem in block:
                                if isinstance(elem, dict):
                                    parts.append(elem.get("text", ""))
                    return "".join(parts).strip()
        return ""

    # ── Message Processing ─────────────────────────────────────────

    async def _process_message(
        self, text: str, receive_id: str, receive_id_type: str
    ) -> None:
        """Classify intent and dispatch to the appropriate handler."""
        intent = self._classify_intent(text)
        self._last_intent = intent
        action = intent.get("action", "help")
        logger.info("[FeishuBot] intent=%s params=%s", action, intent)

        try:
            if action == "list_hotspots":
                await self._handle_list_hotspots(receive_id, receive_id_type)
            elif action == "analyze_topic":
                topic = intent.get("topic", "") or text
                await self._handle_analyze_topic(receive_id, receive_id_type, topic)
            elif action == "run_campaign":
                topic = intent.get("topic", "") or self._guess_topic(text)
                channel = intent.get("channel", "") or "招商银行"
                top_k = int(intent.get("top_k", 3))
                await self._handle_run_campaign(receive_id, receive_id_type, topic, channel, top_k)
            elif action == "lookup_fund":
                code = intent.get("fund_code", "") or self._extract_fund_code(text)
                query = intent.get("topic", "") or text
                await self._handle_lookup_fund(receive_id, receive_id_type, code, query)
            elif action == "show_copy":
                await self._handle_show_copy(receive_id, receive_id_type)
            else:
                await self._handle_help(receive_id, receive_id_type)
        except Exception:
            logger.exception("[FeishuBot] Handler error for action=%s", action)
            self._send_card(receive_id, receive_id_type, build_error_card("处理请求时出错，请稍后重试。"))

    # ── Intent Classification ──────────────────────────────────────

    def _classify_intent(self, text: str) -> dict[str, Any]:
        """Use DeepSeek to classify the user message into an intent + params."""
        forced_lookup = self._force_lookup_intent(text)
        if forced_lookup is not None:
            return forced_lookup

        if not self.llm.is_configured:
            return self._fallback_classify(text)

        try:
            result = self.llm.chat_json(system_prompt=INTENT_PROMPT, user_prompt=text, temperature=0.0)
            # Validate
            valid_actions = {
                "list_hotspots", "analyze_topic", "run_campaign",
                "lookup_fund", "show_copy", "help",
            }
            if result.get("action") not in valid_actions:
                result["action"] = self._fallback_classify(text).get("action", "help")
            return result
        except Exception:
            logger.exception("[FeishuBot] Intent classification failed, using fallback")
            return self._fallback_classify(text)

    @staticmethod
    def _fallback_classify(text: str) -> dict[str, Any]:
        """Rule-based fallback when LLM is unavailable."""
        t = text.strip().lower()
        forced_lookup = FeishuBotService._force_lookup_intent(text)
        if forced_lookup is not None:
            return forced_lookup
        if any(kw in t for kw in ["热点", "今天", "最近"]):
            return {"action": "list_hotspots", "topic": "", "channel": "招商银行", "top_k": 3}
        if any(kw in t for kw in ["分析", "怎么看"]):
            return {"action": "analyze_topic", "topic": text, "channel": "招商银行", "top_k": 3}
        if any(kw in t for kw in ["推荐", "推介", "生成", "话术", "选品", "文案"]):
            return {"action": "run_campaign", "topic": text, "channel": "招商银行", "top_k": 3}
        if any(kw in t for kw in ["文案", "话术", "详细"]):
            return {"action": "show_copy", "topic": "", "channel": "招商银行", "top_k": 3}
        return {"action": "help", "topic": "", "channel": "招商银行", "top_k": 3}

    @staticmethod
    def _force_lookup_intent(text: str) -> dict[str, Any] | None:
        """Route obvious fund lookup requests before LLM intent classification."""
        code = FeishuBotService._extract_fund_code(text)
        if code:
            return {
                "action": "lookup_fund",
                "fund_code": code,
                "topic": FeishuBotService._clean_fund_query(text),
                "channel": "招商银行",
                "top_k": 3,
            }

        normalized = text.strip().lower()
        lookup_words = ["查", "查询", "看看", "详情", "基金"]
        if any(word in normalized for word in lookup_words):
            query = FeishuBotService._clean_fund_query(text)
            if query:
                return {
                    "action": "lookup_fund",
                    "fund_code": "",
                    "topic": query,
                    "channel": "招商银行",
                    "top_k": 3,
                }
        return None

    @staticmethod
    def _extract_fund_code(text: str) -> str:
        """Extract a 6-digit fund code from text."""
        normalized = FeishuBotService._normalize_digits(text)
        m = re.search(r"(?<!\d)(\d\s*\d\s*\d\s*\d\s*\d\s*\d)(?!\d)", normalized)
        if m:
            return re.sub(r"\s+", "", m.group(1))
        return ""

    @staticmethod
    def _normalize_digits(text: str) -> str:
        chars = []
        for char in text:
            try:
                chars.append(str(unicodedata.digit(char)))
            except (TypeError, ValueError):
                chars.append(char)
        return "".join(chars)

    @staticmethod
    def _guess_topic(text: str) -> str:
        """Heuristic topic extraction for fallback."""
        # Remove obvious command words
        for word in ["给我", "生成", "推荐", "推介", "话术", "文案", "帮我", "一个", "一下"]:
            text = text.replace(word, "")
        # Remove channel names
        for ch in ["招商银行", "工商银行", "建设银行", "农业银行", "中国银行", "招行", "工行", "建行"]:
            text = text.replace(ch, "")
        topic = text.strip().rstrip("的。，！？")
        return topic if len(topic) > 1 else "人工智能"

    @staticmethod
    def _clean_fund_query(text: str) -> str:
        query = text.strip()
        for word in [
            "帮我", "麻烦", "请", "查询一下", "查一下", "查询", "查基金",
            "查", "看看", "看一下", "详情", "基金", "这个", "一下",
            "怎么样", "如何", "呢", "吗", "？", "?", "，", ",", "。", "！", "!",
        ]:
            query = query.replace(word, "")
        query = re.sub(r"\s+", "", query)
        return query.strip()

    # ── Handlers ───────────────────────────────────────────────────

    async def _handle_list_hotspots(self, receive_id: str, receive_id_type: str) -> None:
        """Fetch today's hotspots and send as a card."""
        try:
            hotspots = self.hotspot_provider.today()
            card = build_hotspot_list_card(hotspots.items, hotspots.updated_at)
            self._send_card(receive_id, receive_id_type, card)
        except Exception as exc:
            self._send_card(receive_id, receive_id_type, build_error_card(f"获取热点失败：{exc}"))

    async def _handle_analyze_topic(
        self, receive_id: str, receive_id_type: str, topic: str
    ) -> None:
        """Analyze a topic/hotspot and send the structured brief."""
        if not topic or len(topic) < 2:
            self._send_text(receive_id, receive_id_type, "请告诉我你想分析的主题，比如「分析人工智能」。")
            return

        self._send_text(receive_id, receive_id_type, f"正在分析「{topic}」，请稍候...")

        try:
            analysis = self.hotspot_agent.analyze(topic)
            card = build_analysis_card(analysis)
            self._send_card(receive_id, receive_id_type, card)
        except Exception as exc:
            self._send_card(receive_id, receive_id_type, build_error_card(f"分析失败：{exc}"))

    async def _handle_run_campaign(
        self, receive_id: str, receive_id_type: str, topic: str,
        channel: str, top_k: int,
    ) -> None:
        """Run the full campaign pipeline and send result cards."""
        if not topic or len(topic) < 2:
            self._send_text(receive_id, receive_id_type, "请告诉我你想推介的主题，比如「给我生成人工智能的招行推介」。")
            return

        # Normalize channel name
        channel_map = {
            "招行": "招商银行", "工行": "工商银行",
            "建行": "建设银行", "农行": "农业银行",
        }
        channel = channel_map.get(channel, channel)

        self._send_text(receive_id, receive_id_type, f"正在为你生成「{topic}」的{channel}推介方案，请稍候...")

        try:
            request = CampaignRequest(
                hotspot=topic,
                channel=channel,
                risk_preference="平衡型",
                fund_type_filter="全部",
                top_k=min(top_k, 5),
            )
            result = self.graph_orchestrator.run_sync(request)

            # Cache for "show_copy" follow-up
            self._chat_results[receive_id] = {
                "result": result,
                "channel": channel,
            }

            # Send main result card
            card = build_campaign_result_card(result)
            self._send_card(receive_id, receive_id_type, card)

            # Send a separate copy card with the marketing text
            if result.marketing_copy and result.marketing_copy.headline:
                copy_card = build_copy_card(result.marketing_copy, channel)
                self._send_card(receive_id, receive_id_type, copy_card)

        except Exception as exc:
            self._send_card(receive_id, receive_id_type, build_error_card(f"生成推介失败：{exc}"))

    async def _handle_lookup_fund(
        self, receive_id: str, receive_id_type: str, fund_code: str, query: str = "",
    ) -> None:
        """Look up a fund by code and send a detail card."""
        query = (query or "").strip()
        if (not fund_code or len(fund_code) != 6) and not query:
            self._send_text(receive_id, receive_id_type, "请提供6位数字基金代码或基金名称，比如「查基金 012733」。")
            return

        lookup_text = fund_code if fund_code else query
        self._send_text(receive_id, receive_id_type, f"正在查询基金 {lookup_text}，请稍候...")

        try:
            funds = self.fund_loader.load()
            matches = self._find_fund_matches(funds, fund_code, query)
            self._last_lookup_code = fund_code
            self._last_lookup_query = query
            self._last_lookup_match_count = len(matches)
            self._last_lookup_matches = [
                f"{fund.fund_code} {fund.fund_name}" for fund in matches[:5]
            ]

            if not matches:
                self._send_text(receive_id, receive_id_type, f"未找到基金 {lookup_text}，请确认代码或名称是否正确。")
                return

            if len(matches) > 1 and not fund_code:
                summary = "\n".join(
                    f"- {fund.fund_code} {fund.fund_name}（{fund.risk_level}）"
                    for fund in matches[:5]
                )
                self._send_text(
                    receive_id,
                    receive_id_type,
                    f"找到 {len(matches)} 只匹配基金，请用 6 位代码精确查询：\n{summary}",
                )
                return

            # Convert Fund to RecommendedFund-like dict for card builder
            fund_data = self._fund_to_card_data(matches[0])
            card = build_fund_detail_card(fund_data)
            self._send_card(receive_id, receive_id_type, card)

        except Exception as exc:
            self._send_card(receive_id, receive_id_type, build_error_card(f"查询基金失败：{exc}"))

    @staticmethod
    def _find_fund_matches(funds: list[Fund], fund_code: str, query: str) -> list[Fund]:
        if fund_code:
            return [fund for fund in funds if fund.fund_code == fund_code]

        normalized_query = re.sub(r"\s+", "", query).lower()
        if not normalized_query:
            return []

        exact_name = [
            fund for fund in funds
            if re.sub(r"\s+", "", fund.fund_name).lower() == normalized_query
        ]
        if exact_name:
            return exact_name

        return [
            fund for fund in funds
            if normalized_query in re.sub(r"\s+", "", fund.fund_name).lower()
        ]

    async def _handle_show_copy(self, receive_id: str, receive_id_type: str) -> None:
        """Show the full marketing copy from the last campaign run."""
        cached = self._chat_results.get(receive_id)
        if cached is None:
            self._send_text(
                receive_id, receive_id_type,
                "暂无已生成的文案。请先让我生成推介，例如「给我生成人工智能的招行推介」。",
            )
            return

        result = cached["result"]
        channel = cached["channel"]
        copy_card = build_copy_card(result.marketing_copy, channel)
        self._send_card(receive_id, receive_id_type, copy_card)

    async def _handle_help(self, receive_id: str, receive_id_type: str) -> None:
        """Send the help/welcome card."""
        self._send_card(receive_id, receive_id_type, build_help_card())

    # ── Fund Lookup Helper ─────────────────────────────────────────

    @staticmethod
    def _fund_to_card_data(fund: Fund) -> RecommendedFund:
        """Convert the dataclass Fund to a RecommendedFund for card building."""
        return RecommendedFund(
            fund_code=fund.fund_code,
            fund_name=fund.fund_name,
            fund_type=fund.fund_type,
            fund_category=fund.fund_type,
            compare_group="",
            category_reason="",
            category_rank=0,
            category_total=0,
            manager=fund.manager,
            latest_nav=fund.latest_nav,
            estimated_growth=fund.estimated_growth,
            one_year_return=fund.one_year_return,
            volatility=fund.volatility,
            max_drawdown=fund.max_drawdown,
            risk_level=fund.risk_level,
            risk_level_source=fund.risk_level_source,
            positioning=fund.positioning,
            top_holdings=fund.top_holdings,
            industry_allocation=fund.industry_allocation,
            industry_allocation_source=fund.industry_allocation_source,
            fund_size=fund.fund_size,
            inception_date=fund.inception_date,
            management_fee=fund.management_fee,
            custody_fee=fund.custody_fee,
            sales_service_fee=fund.sales_service_fee,
            official_risk_level=fund.official_risk_level,
            manager_tenure=fund.manager_tenure,
            sharpe_ratio=fund.sharpe_ratio,
            calmar_ratio=fund.calmar_ratio,
            peer_rank=fund.peer_rank,
            data_source=fund.data_source,
            data_updated_at=fund.data_updated_at,
            is_enriched=fund.is_enriched,
            score=0,
            score_breakdown=ScoreBreakdown(
                theme_relevance=0,
                holding_match=0,
                positioning_match=0,
                performance_stability=0,
                channel_match=0,
                compliance_penalty=0,
            ),
            explanation_points=[],
            matched_tags=[],
            reason="",
            suitable_clients=fund.suitable_clients,
            unsuitable_clients="",
            risk_warning="",
            field_sources={},
            is_eligible=True,
            data_quality_score=100,
            missing_fields=[],
            exclusion_reasons=[],
        )

    # ── Message Sending ────────────────────────────────────────────

    def _send_text(self, receive_id: str, receive_id_type: str, text: str) -> None:
        """Send a plain text message via the Feishu API."""
        if not self._client:
            return
        try:
            content = json.dumps({"text": text}, ensure_ascii=False)
            req = (
                CreateMessageRequest.builder()
                .receive_id_type(receive_id_type)
                .request_body(
                    CreateMessageRequestBody.builder()
                    .receive_id(receive_id)
                    .msg_type("text")
                    .content(content)
                    .build()
                )
                .build()
            )
            response = self._client.im.v1.message.create(req)
            if hasattr(response, "success") and not response.success():
                self._last_reply_error = (
                    f"send text failed: code={getattr(response, 'code', '')} "
                    f"msg={getattr(response, 'msg', '')}"
                )
                logger.error("[FeishuBot] %s", self._last_reply_error)
            else:
                self._last_reply_at = _now_local_iso()
                self._last_reply_error = ""
        except Exception:
            self._last_reply_error = "send text exception"
            logger.exception("[FeishuBot] Failed to send text message")

    def _send_card(self, receive_id: str, receive_id_type: str, card: dict) -> None:
        """Send an interactive card message via the Feishu API."""
        if not self._client:
            return
        try:
            content = json.dumps(card, ensure_ascii=False)
            req = (
                CreateMessageRequest.builder()
                .receive_id_type(receive_id_type)
                .request_body(
                    CreateMessageRequestBody.builder()
                    .receive_id(receive_id)
                    .msg_type("interactive")
                    .content(content)
                    .build()
                )
                .build()
            )
            response = self._client.im.v1.message.create(req)
            if hasattr(response, "success") and not response.success():
                self._last_reply_error = (
                    f"send card failed: code={getattr(response, 'code', '')} "
                    f"msg={getattr(response, 'msg', '')}"
                )
                logger.error("[FeishuBot] %s", self._last_reply_error)
            else:
                self._last_reply_at = _now_local_iso()
                self._last_reply_error = ""
        except Exception:
            self._last_reply_error = "send card exception"
            logger.exception("[FeishuBot] Failed to send card message")


# ── Module-level singleton ─────────────────────────────────────────────

_bot_instance: FeishuBotService | None = None


def get_feishu_bot() -> FeishuBotService:
    global _bot_instance
    if _bot_instance is None:
        _bot_instance = FeishuBotService()
    return _bot_instance
