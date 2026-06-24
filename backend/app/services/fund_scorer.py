from app.schemas import ChannelStrategy, HotspotAnalysisResponse, RecommendedFund, ScoreBreakdown
from app.services.fund_loader import Fund


RISK_SCORE_BY_CHANNEL = {
    "招商银行": {"R1": 3, "R2": 6, "R3": 8, "R4": 9, "R5": 7},
    "工商银行": {"R1": 8, "R2": 9, "R3": 8, "R4": 6, "R5": 3},
    "建设银行": {"R1": 7, "R2": 9, "R3": 8, "R4": 6, "R5": 4},
    "农业银行": {"R1": 8, "R2": 9, "R3": 7, "R4": 5, "R5": 3},
}

RISK_SCORE_BY_PREFERENCE = {
    "稳健型": {"R1": 10, "R2": 10, "R3": 8, "R4": 4, "R5": 2},
    "平衡型": {"R1": 6, "R2": 8, "R3": 10, "R4": 8, "R5": 5},
    "进取型": {"R1": 3, "R2": 5, "R3": 8, "R4": 10, "R5": 10},
}


class FundScorer:
    def score(
        self,
        funds: list[Fund],
        hotspot_analysis: HotspotAnalysisResponse,
        channel_strategy: ChannelStrategy,
        risk_preference: str,
        top_k: int,
    ) -> list[RecommendedFund]:
        scored = [
            self._score_one(fund, hotspot_analysis, channel_strategy, risk_preference)
            for fund in funds
        ]
        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:top_k]

    def _score_one(
        self,
        fund: Fund,
        hotspot_analysis: HotspotAnalysisResponse,
        channel_strategy: ChannelStrategy,
        risk_preference: str,
    ) -> RecommendedFund:
        tags = hotspot_analysis.themes + hotspot_analysis.industries + hotspot_analysis.keywords
        fund_text = " ".join(
            fund.positioning
            + fund.top_holdings
            + list(fund.industry_allocation.keys())
            + [fund.fund_name, fund.fund_type]
        )
        matched_tags = [tag for tag in tags if tag and tag in fund_text]
        unique_match_ratio = len(set(matched_tags)) / max(len(set(tags)), 1)

        theme_relevance = min(35, round(unique_match_ratio * 45, 1))
        holding_match = min(
            25,
            round(
                sum(percent for industry, percent in fund.industry_allocation.items() if industry in hotspot_analysis.industries)
                * 0.6,
                1,
            ),
        )
        positioning_match = min(
            15,
            round(sum(1 for tag in hotspot_analysis.themes if tag in " ".join(fund.positioning)) * 5, 1),
        )
        performance_stability = self._performance_score(fund)
        channel_match = self._channel_score(fund, channel_strategy.channel, risk_preference)
        compliance_penalty = -2 if fund.risk_level in {"R4", "R5"} and risk_preference == "稳健型" else 0

        total_score = round(
            theme_relevance
            + holding_match
            + positioning_match
            + performance_stability
            + channel_match
            + compliance_penalty,
            1,
        )

        score_breakdown = ScoreBreakdown(
            theme_relevance=theme_relevance,
            holding_match=holding_match,
            positioning_match=positioning_match,
            performance_stability=performance_stability,
            channel_match=channel_match,
            compliance_penalty=compliance_penalty,
        )

        reason = self._build_reason(fund, hotspot_analysis, matched_tags)
        risk_warning = self._build_risk_warning(fund)

        return RecommendedFund(
            fund_code=fund.fund_code,
            fund_name=fund.fund_name,
            fund_type=fund.fund_type,
            manager=fund.manager,
            score=total_score,
            score_breakdown=score_breakdown,
            matched_tags=sorted(set(matched_tags)),
            reason=reason,
            suitable_clients=fund.suitable_clients,
            unsuitable_clients=self._unsuitable_clients(fund),
            risk_warning=risk_warning,
        )

    def _performance_score(self, fund: Fund) -> float:
        if fund.volatility is None or fund.max_drawdown is None or fund.one_year_return is None:
            return 0.0
        score = 10
        if fund.volatility > 30:
            score -= 3
        elif fund.volatility > 22:
            score -= 1
        if abs(fund.max_drawdown) > 28:
            score -= 3
        elif abs(fund.max_drawdown) > 20:
            score -= 1
        if fund.one_year_return < 0:
            score -= 2
        return float(max(score, 0))

    def _channel_score(self, fund: Fund, channel: str, risk_preference: str) -> float:
        scores = RISK_SCORE_BY_CHANNEL.get(channel, RISK_SCORE_BY_CHANNEL["工商银行"])
        preference_scores = RISK_SCORE_BY_PREFERENCE.get(risk_preference, RISK_SCORE_BY_PREFERENCE["平衡型"])
        return round((scores.get(fund.risk_level, 6) * 0.45) + (preference_scores.get(fund.risk_level, 6) * 0.55), 1)

    def _build_reason(self, fund: Fund, hotspot_analysis: HotspotAnalysisResponse, matched_tags: list[str]) -> str:
        industry_hits = [
            f"{industry}{percent:.0f}%"
            for industry, percent in fund.industry_allocation.items()
            if industry in hotspot_analysis.industries
        ]
        hits = "、".join(sorted(set(matched_tags[:5])))
        industries = "、".join(industry_hits) if industry_hits else "相关行业暴露需要进一步人工确认"
        if not hits:
            return f"该基金暂未在名称、类型、持仓代码或产品标签中直接命中{hotspot_analysis.hotspot}相关短标签，{industries}。"
        return f"该基金与{hotspot_analysis.hotspot}相关标签匹配到{hits}，行业配置中包含{industries}。"

    def _build_risk_warning(self, fund: Fund) -> str:
        volatility = f"{fund.volatility:.1f}%" if fund.volatility is not None else "暂无公开计算值"
        max_drawdown = f"{fund.max_drawdown:.1f}%" if fund.max_drawdown is not None else "暂无公开计算值"
        return (
            f"该基金风险等级为{fund.risk_level}，近一年波动率约{volatility}，"
            f"最大回撤约{max_drawdown}，需结合客户风险承受能力使用。"
        )

    def _unsuitable_clients(self, fund: Fund) -> str:
        if fund.risk_level == "未知":
            return "风险等级、持仓和行业配置尚未完整校验的客户场景，需人工适当性审核"
        if fund.risk_level in {"R4", "R5"}:
            return "低风险承受能力、短期流动性要求高或无法接受较大净值波动的客户"
        if fund.risk_level == "R3":
            return "只接受低波动、保守收益预期或投资期限较短的客户"
        return "追求高弹性主题收益且能够承受较大权益波动的客户"
