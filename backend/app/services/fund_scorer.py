from app.agents.eligibility_agent import FundEligibility
from app.agents.fund_category_agent import FundCategoryAgent
from app.schemas import ChannelStrategy, ExplanationPoint, HotspotAnalysisResponse, RecommendedFund, ScoreBreakdown
from app.services.fund_loader import Fund
from app.services.rule_config import load_rule_config


class FundScorer:
    def __init__(self) -> None:
        self.category_agent = FundCategoryAgent()

    def score(
        self,
        funds: list[FundEligibility],
        hotspot_analysis: HotspotAnalysisResponse,
        channel_strategy: ChannelStrategy,
        risk_preference: str,
        top_k: int,
    ) -> list[RecommendedFund]:
        scored = [
            self._score_one(result, hotspot_analysis, channel_strategy, risk_preference)
            for result in funds
        ]
        self._assign_category_ranks(scored)
        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:top_k]

    def _assign_category_ranks(self, funds: list[RecommendedFund]) -> None:
        groups: dict[str, list[RecommendedFund]] = {}
        for fund in funds:
            groups.setdefault(fund.fund_category, []).append(fund)

        for group in groups.values():
            group.sort(key=lambda item: item.score, reverse=True)
            total = len(group)
            for index, fund in enumerate(group, start=1):
                fund.category_rank = index
                fund.category_total = total

    def excluded(
        self,
        funds: list[FundEligibility],
        hotspot_analysis: HotspotAnalysisResponse,
        limit: int = 30,
    ) -> list[RecommendedFund]:
        excluded = [
            self._build_excluded(result, hotspot_analysis)
            for result in funds[:limit]
        ]
        excluded.sort(key=lambda item: item.data_quality_score, reverse=True)
        return excluded

    def _score_one(
        self,
        eligibility: FundEligibility,
        hotspot_analysis: HotspotAnalysisResponse,
        channel_strategy: ChannelStrategy,
        risk_preference: str,
    ) -> RecommendedFund:
        fund = eligibility.fund
        tags = hotspot_analysis.themes + hotspot_analysis.industries + hotspot_analysis.keywords
        fund_text = " ".join(
            fund.positioning
            + fund.top_holdings
            + list(fund.industry_allocation.keys())
            + [fund.fund_name, fund.fund_type]
        )
        matched_tags = [tag for tag in tags if tag and tag in fund_text]
        unique_match_ratio = len(set(matched_tags)) / max(len(set(tags)), 1)
        scoring = load_rule_config().scoring

        theme_relevance = min(
            scoring["theme_relevance_max"],
            round(unique_match_ratio * scoring["theme_relevance_multiplier"], 1),
        )
        holding_match = min(
            scoring["holding_match_max"],
            round(
                sum(percent for industry, percent in fund.industry_allocation.items() if industry in hotspot_analysis.industries)
                * scoring["holding_match_multiplier"],
                1,
            ),
        )
        positioning_match = min(
            scoring["positioning_match_max"],
            round(
                sum(1 for tag in hotspot_analysis.themes if tag in " ".join(fund.positioning))
                * scoring["positioning_match_per_hit"],
                1,
            ),
        )
        performance_stability = self._performance_score(fund)
        channel_match = self._channel_score(fund, channel_strategy.channel, risk_preference)
        compliance_penalty = (
            scoring["compliance_penalty_high_risk_for_conservative"]
            if fund.risk_level in {"R4", "R5"} and risk_preference == "稳健型"
            else 0
        )

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
        category = self.category_agent.classify(fund)
        field_sources = self._field_sources(fund)

        return RecommendedFund(
            fund_code=fund.fund_code,
            fund_name=fund.fund_name,
            fund_type=fund.fund_type,
            fund_category=category.category,
            compare_group=category.label,
            category_reason=category.reason,
            category_rank=0,
            category_total=0,
            manager=fund.manager,
            latest_nav=fund.latest_nav,
            estimated_growth=fund.estimated_growth,
            one_year_return=fund.one_year_return,
            volatility=fund.volatility,
            max_drawdown=fund.max_drawdown,
            risk_level=fund.risk_level,
            positioning=fund.positioning,
            top_holdings=fund.top_holdings,
            industry_allocation=fund.industry_allocation,
            data_source=fund.data_source,
            data_updated_at=fund.data_updated_at,
            is_enriched=fund.is_enriched,
            score=total_score,
            score_breakdown=score_breakdown,
            explanation_points=self._explanation_points(
                fund=fund,
                hotspot_analysis=hotspot_analysis,
                matched_tags=sorted(set(matched_tags)),
                category_label=category.label,
                category_reason=category.reason,
                field_sources=field_sources,
            ),
            matched_tags=sorted(set(matched_tags)),
            reason=reason,
            suitable_clients=fund.suitable_clients,
            unsuitable_clients=self._unsuitable_clients(fund),
            risk_warning=risk_warning,
            field_sources=field_sources,
            is_eligible=True,
            data_quality_score=eligibility.data_quality_score,
            missing_fields=eligibility.missing_fields,
            exclusion_reasons=[],
        )

    def _build_excluded(
        self,
        eligibility: FundEligibility,
        hotspot_analysis: HotspotAnalysisResponse,
    ) -> RecommendedFund:
        fund = eligibility.fund
        reason = "未进入候选池：" + "；".join(eligibility.exclusion_reasons)
        category = self.category_agent.classify(fund)
        field_sources = self._field_sources(fund)
        return RecommendedFund(
            fund_code=fund.fund_code,
            fund_name=fund.fund_name,
            fund_type=fund.fund_type,
            fund_category=category.category,
            compare_group=category.label,
            category_reason=category.reason,
            category_rank=0,
            category_total=0,
            manager=fund.manager,
            latest_nav=fund.latest_nav,
            estimated_growth=fund.estimated_growth,
            one_year_return=fund.one_year_return,
            volatility=fund.volatility,
            max_drawdown=fund.max_drawdown,
            risk_level=fund.risk_level,
            positioning=fund.positioning,
            top_holdings=fund.top_holdings,
            industry_allocation=fund.industry_allocation,
            data_source=fund.data_source,
            data_updated_at=fund.data_updated_at,
            is_enriched=fund.is_enriched,
            score=0.0,
            score_breakdown=ScoreBreakdown(
                theme_relevance=0,
                holding_match=0,
                positioning_match=0,
                performance_stability=0,
                channel_match=0,
                compliance_penalty=0,
            ),
            explanation_points=[
                ExplanationPoint(
                    label="未进入候选池",
                    text="；".join(eligibility.exclusion_reasons) or "未返回排除原因",
                    evidence_fields=["data_quality_score", "risk_level", "missing_fields"],
                    source="calculated",
                )
            ],
            matched_tags=self._matched_tags(fund, hotspot_analysis),
            reason=reason,
            suitable_clients=fund.suitable_clients,
            unsuitable_clients=self._unsuitable_clients(fund),
            risk_warning=self._build_risk_warning(fund),
            field_sources=field_sources,
            is_eligible=False,
            data_quality_score=eligibility.data_quality_score,
            missing_fields=eligibility.missing_fields,
            exclusion_reasons=eligibility.exclusion_reasons,
        )

    def _matched_tags(self, fund: Fund, hotspot_analysis: HotspotAnalysisResponse) -> list[str]:
        tags = hotspot_analysis.themes + hotspot_analysis.industries + hotspot_analysis.keywords
        fund_text = " ".join(
            fund.positioning
            + fund.top_holdings
            + list(fund.industry_allocation.keys())
            + [fund.fund_name, fund.fund_type]
        )
        return sorted({tag for tag in tags if tag and tag in fund_text})

    def _field_sources(self, fund: Fund) -> dict[str, str]:
        return {
            "fund_code": "raw",
            "fund_name": "raw",
            "fund_type": "raw",
            "manager": "raw" if fund.manager != "未知" else "missing",
            "latest_nav": "raw" if fund.latest_nav else "missing",
            "estimated_growth": "raw" if fund.estimated_growth else "missing",
            "one_year_return": "raw" if fund.one_year_return is not None else "missing",
            "top_holdings": "raw" if fund.top_holdings else "missing",
            "volatility": "calculated" if fund.volatility is not None else "missing",
            "max_drawdown": "calculated" if fund.max_drawdown is not None else "missing",
            "risk_level": "inferred",
            "suitable_clients": "inferred",
            "positioning": "inferred",
            "industry_allocation": self._industry_source(fund),
            "score": "calculated",
            "reason": "generated",
            "data_quality_score": "calculated",
            "exclusion_reasons": "calculated",
        }

    def _industry_source(self, fund: Fund) -> str:
        if not fund.industry_allocation:
            return "missing"
        if fund.industry_allocation_source == "mapped_from_stock_industry_map":
            return "mapped"
        if fund.industry_allocation_source == "keyword_inferred":
            return "inferred"
        return "inferred"

    def _explanation_points(
        self,
        *,
        fund: Fund,
        hotspot_analysis: HotspotAnalysisResponse,
        matched_tags: list[str],
        category_label: str,
        category_reason: str,
        field_sources: dict[str, str],
    ) -> list[ExplanationPoint]:
        points = [
            ExplanationPoint(
                label="比较分组",
                text=f"该基金归入{category_label}。{category_reason}",
                evidence_fields=["fund_type"],
                source=field_sources["fund_type"],
            )
        ]

        if matched_tags:
            points.append(
                ExplanationPoint(
                    label="主题匹配",
                    text=f"命中热点相关标签：{'、'.join(matched_tags[:6])}。",
                    evidence_fields=["matched_tags", "positioning", "fund_name", "fund_type"],
                    source="inferred",
                )
            )
        else:
            points.append(
                ExplanationPoint(
                    label="主题匹配",
                    text=f"未直接命中{hotspot_analysis.hotspot}的短标签，需要人工确认主题相关性。",
                    evidence_fields=["matched_tags", "positioning", "fund_name", "fund_type"],
                    source="missing",
                )
            )

        if fund.industry_allocation:
            industries = "、".join(
                f"{name}{value:.0f}%"
                for name, value in list(fund.industry_allocation.items())[:5]
            )
            source_text = "持仓代码行业映射" if field_sources["industry_allocation"] == "mapped" else "规则推导"
            points.append(
                ExplanationPoint(
                    label="行业证据",
                    text=f"行业配置显示：{industries}；来源为{source_text}。",
                    evidence_fields=["industry_allocation", "top_holdings"],
                    source=field_sources["industry_allocation"],
                )
            )

        risk_parts = []
        if fund.volatility is not None:
            risk_parts.append(f"波动率{fund.volatility:.1f}%")
        if fund.max_drawdown is not None:
            risk_parts.append(f"最大回撤{fund.max_drawdown:.1f}%")
        if fund.one_year_return is not None:
            risk_parts.append(f"近一年收益{fund.one_year_return:.1f}%")
        if risk_parts:
            points.append(
                ExplanationPoint(
                    label="风险收益指标",
                    text="，".join(risk_parts) + "。",
                    evidence_fields=["one_year_return", "volatility", "max_drawdown"],
                    source="calculated",
                )
            )

        points.append(
            ExplanationPoint(
                label="适当性边界",
                text=f"风险等级为{fund.risk_level}，适合客户口径为：{fund.suitable_clients}。",
                evidence_fields=["risk_level", "suitable_clients"],
                source="inferred",
            )
        )
        return points

    def _performance_score(self, fund: Fund) -> float:
        if fund.volatility is None or fund.max_drawdown is None or fund.one_year_return is None:
            return 0.0
        rules = load_rule_config().performance_score
        score = rules["base_score"]
        if fund.volatility > rules["high_volatility_threshold"]:
            score -= rules["high_volatility_penalty"]
        elif fund.volatility > rules["medium_volatility_threshold"]:
            score -= rules["medium_volatility_penalty"]
        if abs(fund.max_drawdown) > rules["high_drawdown_threshold"]:
            score -= rules["high_drawdown_penalty"]
        elif abs(fund.max_drawdown) > rules["medium_drawdown_threshold"]:
            score -= rules["medium_drawdown_penalty"]
        if fund.one_year_return < 0:
            score -= rules["negative_return_penalty"]
        return float(max(score, 0))

    def _channel_score(self, fund: Fund, channel: str, risk_preference: str) -> float:
        config = load_rule_config()
        scores = config.channel_risk_scores.get(channel, config.channel_risk_scores["工商银行"])
        preference_scores = config.preference_risk_scores.get(
            risk_preference,
            config.preference_risk_scores["平衡型"],
        )
        scoring = config.scoring
        return round(
            (scores.get(fund.risk_level, 6) * scoring["channel_score_weight"])
            + (preference_scores.get(fund.risk_level, 6) * scoring["preference_score_weight"]),
            1,
        )

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
