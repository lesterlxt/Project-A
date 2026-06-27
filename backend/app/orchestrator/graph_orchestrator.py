"""
LangGraph-based multi-agent campaign orchestrator.

Uses langgraph.StateGraph to orchestrate the fund marketing pipeline
with event logging at each step. Each node wraps an existing Agent class
unchanged — no LangChain Agent/Tool involvement.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Annotated, Any

from langgraph.graph import END, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.channel_strategy_agent import ChannelStrategyAgent
from app.agents.copywriting_agent import CopywritingAgent
from app.agents.eligibility_agent import EligibilityAgent, FundEligibility
from app.agents.hotspot_agent import HotspotAgent
from app.schemas import (
    AgentEvent,
    CampaignRequest,
    CampaignResponse,
    CampaignStreamResponse,
    ChannelStrategy,
    ComplianceResult,
    HotspotAnalysisResponse,
    MarketingCopy,
    RecommendedFund,
)
from app.services.compliance import ComplianceChecker
from app.services.fund_loader import Fund, FundLoader
from app.services.fund_scorer import FundScorer
from app.services.rule_config import load_rule_config

# ── State ────────────────────────────────────────────────────────────


@dataclass
class CampaignState:
    """Mutable state bag carried through the LangGraph pipeline."""

    # ── Input ──
    hotspot: str = ""
    channel: str = "招商银行"
    risk_preference: str = "平衡型"
    fund_type_filter: str = "全部"
    top_k: int = 5
    evidence_headlines: list[str] = field(default_factory=list)

    # ── Intermediate results ──
    hotspot_analysis: HotspotAnalysisResponse | None = None
    funds: list[Fund] = field(default_factory=list)
    eligibility_results: list[FundEligibility] = field(default_factory=list)
    eligible_funds: list[FundEligibility] = field(default_factory=list)
    excluded_funds: list[FundEligibility] = field(default_factory=list)
    channel_strategy: ChannelStrategy | None = None
    recommended_funds: list[RecommendedFund] = field(default_factory=list)
    excluded_fund_items: list[RecommendedFund] = field(default_factory=list)
    marketing_copy: MarketingCopy | None = None
    compliance: ComplianceResult | None = None

    # ── Pipeline metadata ──
    current_step: str = ""
    error: str = ""
    events: list[dict[str, Any]] = field(default_factory=list)

    # ── Stats ──
    screened_count: int = 0
    eligible_count: int = 0
    excluded_count: int = 0


# ── Helpers ───────────────────────────────────────────────────────────


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _emit(state: CampaignState, step: str, status: str, message: str = "", data: dict | None = None, duration_ms: float | None = None) -> None:
    state.events.append(
        AgentEvent(
            step=step,
            status=status,
            timestamp=_now_iso(),
            duration_ms=duration_ms,
            message=message,
            data=data,
        ).model_dump()
    )


def _filter_funds(funds: list[Fund], fund_type_filter: str) -> list[Fund]:
    if fund_type_filter == "全部":
        return funds
    rule = load_rule_config().fund_type_filter_rules.get(fund_type_filter)
    if rule is None:
        return funds
    fund_type_contains = rule.get("fund_type_contains", [])
    positioning_any = set(rule.get("positioning_any", []))
    return [
        f
        for f in funds
        if any(token in f.fund_type for token in fund_type_contains)
        or bool(positioning_any & set(f.positioning))
    ]


# ── Graph Nodes ───────────────────────────────────────────────────────


class GraphNodes:
    """Each method is a LangGraph node — a pure function of CampaignState → CampaignState (mutated in place)."""

    def __init__(self) -> None:
        self.hotspot_agent = HotspotAgent()
        self.fund_loader = FundLoader()
        self.eligibility_agent = EligibilityAgent()
        self.channel_agent = ChannelStrategyAgent()
        self.fund_scorer = FundScorer()
        self.copywriter = CopywritingAgent()
        self.compliance_checker = ComplianceChecker()

    # ── Step 1: Load Funds ──

    def load_funds(self, state: CampaignState) -> CampaignState:
        _emit(state, "load_funds", "started", "正在加载本地基金池...")
        t0 = time.monotonic()
        try:
            state.funds = self.fund_loader.load()
            state.funds = _filter_funds(state.funds, state.fund_type_filter)
            dt = (time.monotonic() - t0) * 1000
            _emit(state, "load_funds", "completed", f"已加载 {len(state.funds)} 只基金", duration_ms=dt)
        except Exception as exc:
            dt = (time.monotonic() - t0) * 1000
            _emit(state, "load_funds", "failed", str(exc), duration_ms=dt)
            state.error = f"基金池加载失败: {exc}"
        return state

    # ── Step 2: Analyze Hotspot ──

    def analyze_hotspot(self, state: CampaignState) -> CampaignState:
        _emit(state, "analyze_hotspot", "started", f"正在分析热点：{state.hotspot}")
        t0 = time.monotonic()
        try:
            state.hotspot_analysis = self.hotspot_agent.analyze(
                state.hotspot, state.evidence_headlines if state.evidence_headlines else None
            )
            dt = (time.monotonic() - t0) * 1000
            themes = state.hotspot_analysis.themes
            _emit(
                state, "analyze_hotspot", "completed",
                f"主题：{', '.join(themes[:4]) if themes else '暂无'}",
                duration_ms=dt,
            )
        except Exception as exc:
            dt = (time.monotonic() - t0) * 1000
            _emit(state, "analyze_hotspot", "failed", str(exc), duration_ms=dt)
            state.error = f"热点分析失败: {exc}"
        return state

    # ── Step 3: Eligibility Screening ──

    def screen_eligibility(self, state: CampaignState) -> CampaignState:
        _emit(state, "screen_eligibility", "started", "正在进行数据质量与适当性检查...")
        t0 = time.monotonic()
        try:
            state.eligibility_results = self.eligibility_agent.screen(
                state.funds, state.risk_preference
            )
            state.eligible_funds = [r for r in state.eligibility_results if r.is_eligible]
            state.excluded_funds = [r for r in state.eligibility_results if not r.is_eligible]
            state.eligible_count = len(state.eligible_funds)
            state.excluded_count = len(state.excluded_funds)
            state.screened_count = len(state.eligibility_results)
            dt = (time.monotonic() - t0) * 1000
            _emit(
                state, "screen_eligibility", "completed",
                f"通过 {state.eligible_count} 只，拦截 {state.excluded_count} 只",
                duration_ms=dt,
            )
        except Exception as exc:
            dt = (time.monotonic() - t0) * 1000
            _emit(state, "screen_eligibility", "failed", str(exc), duration_ms=dt)
            state.error = f"资格筛选失败: {exc}"
        return state

    # ── Step 4: Build Channel Strategy ──

    def build_channel(self, state: CampaignState) -> CampaignState:
        _emit(state, "build_channel", "started", f"正在构建渠道策略：{state.channel}")
        t0 = time.monotonic()
        try:
            state.channel_strategy = self.channel_agent.build(state.channel)
            dt = (time.monotonic() - t0) * 1000
            _emit(state, "build_channel", "completed", f"渠道策略已就绪", duration_ms=dt)
        except Exception as exc:
            dt = (time.monotonic() - t0) * 1000
            _emit(state, "build_channel", "failed", str(exc), duration_ms=dt)
            state.error = f"渠道策略构建失败: {exc}"
        return state

    # ── Step 5: Score Funds ──

    def score_funds(self, state: CampaignState) -> CampaignState:
        _emit(state, "score_funds", "started", "正在进行多维度评分与同类排名...")
        t0 = time.monotonic()
        try:
            state.recommended_funds = self.fund_scorer.score(
                funds=state.eligible_funds,
                hotspot_analysis=state.hotspot_analysis,
                channel_strategy=state.channel_strategy,
                risk_preference=state.risk_preference,
                top_k=state.top_k,
            )
            state.excluded_fund_items = self.fund_scorer.excluded(
                funds=state.excluded_funds,
                hotspot_analysis=state.hotspot_analysis,
            )
            dt = (time.monotonic() - t0) * 1000
            _emit(
                state, "score_funds", "completed",
                f"已排序 {len(state.recommended_funds)} 只候选基金",
                duration_ms=dt,
            )
        except Exception as exc:
            dt = (time.monotonic() - t0) * 1000
            _emit(state, "score_funds", "failed", str(exc), duration_ms=dt)
            state.error = f"基金评分失败: {exc}"
        return state

    # ── Step 6: Generate Marketing Copy ──

    def generate_copy(self, state: CampaignState) -> CampaignState:
        _emit(state, "generate_copy", "started", "正在生成渠道营销文案...")
        t0 = time.monotonic()
        try:
            state.marketing_copy = self.copywriter.generate(
                hotspot_analysis=state.hotspot_analysis,
                channel_strategy=state.channel_strategy,
                recommended_funds=state.recommended_funds,
            )
            dt = (time.monotonic() - t0) * 1000
            _emit(state, "generate_copy", "completed", "营销文案已生成", duration_ms=dt)
        except Exception as exc:
            dt = (time.monotonic() - t0) * 1000
            _emit(state, "generate_copy", "failed", str(exc), duration_ms=dt)
            state.error = f"文案生成失败: {exc}"
        return state

    # ── Step 7: Compliance Check ──

    def check_compliance(self, state: CampaignState) -> CampaignState:
        _emit(state, "check_compliance", "started", "正在执行合规规则检查...")
        t0 = time.monotonic()
        try:
            state.compliance = self.compliance_checker.check(state.marketing_copy)
            dt = (time.monotonic() - t0) * 1000
            passed = state.compliance.passed
            _emit(
                state, "check_compliance", "completed",
                "基础规则通过" if passed else f"命中 {len(state.compliance.issues)} 条规则",
                duration_ms=dt,
            )
        except Exception as exc:
            dt = (time.monotonic() - t0) * 1000
            _emit(state, "check_compliance", "failed", str(exc), duration_ms=dt)
            state.error = f"合规检查失败: {exc}"
        return state

    # ── Skip node (no eligible funds) ──

    def skip_ineligible(self, state: CampaignState) -> CampaignState:
        _emit(state, "score_funds", "skipped", "无合格基金，跳过评分")
        _emit(state, "generate_copy", "skipped", "无合格基金，跳过文案生成")
        _emit(state, "check_compliance", "skipped", "无合格基金，跳过合规检查")
        return state


# ── Build Graph ───────────────────────────────────────────────────────


def _has_eligible(state: CampaignState) -> str:
    if state.eligible_count > 0:
        return "build_channel"
    return "skip_ineligible"


def build_graph() -> CompiledStateGraph:
    nodes = GraphNodes()

    builder = StateGraph(CampaignState)

    # Add nodes
    builder.add_node("load_funds", nodes.load_funds)
    builder.add_node("analyze_hotspot", nodes.analyze_hotspot)
    builder.add_node("screen_eligibility", nodes.screen_eligibility)
    builder.add_node("build_channel", nodes.build_channel)
    builder.add_node("score_funds", nodes.score_funds)
    builder.add_node("generate_copy", nodes.generate_copy)
    builder.add_node("check_compliance", nodes.check_compliance)
    builder.add_node("skip_ineligible", nodes.skip_ineligible)

    # Set entry
    builder.set_entry_point("load_funds")

    # Linear edges
    builder.add_edge("load_funds", "analyze_hotspot")
    builder.add_edge("analyze_hotspot", "screen_eligibility")

    # Conditional branch after eligibility
    builder.add_conditional_edges(
        "screen_eligibility",
        _has_eligible,
        {"build_channel": "build_channel", "skip_ineligible": "skip_ineligible"},
    )

    # Continue linear
    builder.add_edge("build_channel", "score_funds")
    builder.add_edge("score_funds", "generate_copy")
    builder.add_edge("generate_copy", "check_compliance")
    builder.add_edge("check_compliance", END)
    builder.add_edge("skip_ineligible", END)

    return builder.compile()


# ── Public API ────────────────────────────────────────────────────────


class GraphOrchestrator:
    """Drop-in replacement for CampaignOrchestrator with LangGraph under the hood."""

    def __init__(self) -> None:
        self._graph = build_graph()

    @property
    def graph(self) -> CompiledStateGraph:
        return self._graph

    def run_sync(self, request: CampaignRequest) -> CampaignResponse:
        """Run the full pipeline synchronously (backward-compatible with old API)."""
        state = CampaignState(
            hotspot=request.hotspot,
            channel=request.channel,
            risk_preference=request.risk_preference,
            fund_type_filter=request.fund_type_filter,
            top_k=request.top_k,
            evidence_headlines=request.evidence_headlines,
        )
        final = self._graph.invoke(state)

        return CampaignResponse(
            hotspot_analysis=final.get("hotspot_analysis") or HotspotAnalysisResponse(hotspot=request.hotspot),
            channel_strategy=final.get("channel_strategy") or ChannelStrategy(
                channel=request.channel,
                client_profile=[],
                messaging_focus=[],
                forbidden_angles=[],
                strategy_summary="",
            ),
            recommended_funds=final.get("recommended_funds") or [],
            excluded_funds=final.get("excluded_fund_items") or [],
            screened_count=final.get("screened_count", 0),
            eligible_count=final.get("eligible_count", 0),
            excluded_count=final.get("excluded_count", 0),
            marketing_copy=final.get("marketing_copy") or MarketingCopy(
                headline="", one_liner="", relationship_manager_script="",
                social_post="", long_form="", risk_disclosure="",
            ),
            compliance=final.get("compliance") or ComplianceResult(passed=True, issues=[], suggestions=[]),
        )

    async def run_stream(self, request: CampaignRequest):
        """Async generator yielding AgentEvent dicts, then final CampaignStreamResponse."""
        state = CampaignState(
            hotspot=request.hotspot,
            channel=request.channel,
            risk_preference=request.risk_preference,
            fund_type_filter=request.fund_type_filter,
            top_k=request.top_k,
            evidence_headlines=request.evidence_headlines,
        )

        seen = 0
        async for chunk in self._graph.astream(state, stream_mode="values"):
            events = chunk.get("events", [])
            # Yield new events
            for event in events[seen:]:
                yield event
            seen = len(events)

        # Yield final response
        error = chunk.get("error", "")
        if error:
            yield CampaignStreamResponse(
                status="partial" if chunk.get("hotspot_analysis") else "failed",
                result=self._build_response(chunk) if chunk.get("hotspot_analysis") else None,
                error=error,
                events=[AgentEvent(**e) for e in chunk.get("events", [])],
            ).model_dump()
        else:
            yield CampaignStreamResponse(
                status="completed",
                result=self._build_response(chunk),
                events=[AgentEvent(**e) for e in chunk.get("events", [])],
            ).model_dump()

    def _build_response(self, final: dict) -> CampaignResponse:
        return CampaignResponse(
            hotspot_analysis=final.get("hotspot_analysis") or HotspotAnalysisResponse(hotspot=""),
            channel_strategy=final.get("channel_strategy") or ChannelStrategy(
                channel="", client_profile=[], messaging_focus=[], forbidden_angles=[], strategy_summary="",
            ),
            recommended_funds=final.get("recommended_funds") or [],
            excluded_funds=final.get("excluded_fund_items") or [],
            screened_count=final.get("screened_count", 0),
            eligible_count=final.get("eligible_count", 0),
            excluded_count=final.get("excluded_count", 0),
            marketing_copy=final.get("marketing_copy") or MarketingCopy(
                headline="", one_liner="", relationship_manager_script="",
                social_post="", long_form="", risk_disclosure="",
            ),
            compliance=final.get("compliance") or ComplianceResult(passed=True, issues=[], suggestions=[]),
        )
