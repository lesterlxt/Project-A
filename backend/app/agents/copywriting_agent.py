from app.schemas import ChannelStrategy, HotspotAnalysisResponse, MarketingCopy, ObjectionHandling, RecommendedFund
from app.services.llm_client import DeepSeekClient, LLMError


class CopywritingAgent:
    def __init__(self) -> None:
        self.llm = DeepSeekClient()

    def generate(
        self,
        hotspot_analysis: HotspotAnalysisResponse,
        channel_strategy: ChannelStrategy,
        recommended_funds: list[RecommendedFund],
    ) -> MarketingCopy:
        if not self.llm.is_configured:
            raise LLMError("DEEPSEEK_API_KEY is required for marketing copy generation")
        return self._generate_with_llm(hotspot_analysis, channel_strategy, recommended_funds)

    def _generate_with_llm(
        self,
        hotspot_analysis: HotspotAnalysisResponse,
        channel_strategy: ChannelStrategy,
        recommended_funds: list[RecommendedFund],
    ) -> MarketingCopy:
        funds_payload = [
            {
                "fund_name": fund.fund_name,
                "fund_type": fund.fund_type,
                "compare_group": fund.compare_group,
                "score": fund.score,
                "category_rank": fund.category_rank,
                "category_total": fund.category_total,
                "data_quality_score": fund.data_quality_score,
                "matched_tags": fund.matched_tags,
                "reason": fund.reason,
                "explanation_points": [point.model_dump() for point in fund.explanation_points],
                "suitable_clients": fund.suitable_clients,
                "unsuitable_clients": fund.unsuitable_clients,
                "risk_warning": fund.risk_warning,
            }
            for fund in recommended_funds[:3]
        ]

        lead_name = recommended_funds[0].fund_name if recommended_funds else ""
        lead_reason = recommended_funds[0].reason if recommended_funds else ""
        channel = channel_strategy.channel
        client_desc = "、".join(channel_strategy.client_profile)
        focus = "、".join(channel_strategy.messaging_focus)
        avoid = "、".join(channel_strategy.forbidden_angles)

        result = self.llm.chat_json(
            system_prompt=(
                "你是一名资深银行渠道基金营销专家，为基金公司渠道经理服务。\n"
                "你会收到系统筛选出的候选基金、市场热点分析和银行渠道画像。\n"
                "你的任务是生成可直接供渠道经理使用的营销材料。\n\n"
                "核心原则：\n"
                "- 内容专业但不晦涩，面向银行理财经理的日常工作场景\n"
                "- 紧扣渠道画像定制表达，不同银行的话术要有明显差异\n"
                "- 必须合规克制：禁止保本、稳赚、必涨、无风险、保证收益、收益承诺等表达\n"
                "- 不得直接向终端客户给出买入指令\n"
                "- 只能输出严格 JSON，不要写 Markdown"
            ),
            user_prompt=(
                "请基于以下信息，为{channel}渠道生成基金营销材料。\n\n"
                f"【市场热点分析】\n{hotspot_analysis.model_dump_json(ensure_ascii=False)}\n\n"
                f"【渠道画像】\n"
                f"  渠道名称：{channel}\n"
                f"  客户特征：{client_desc}\n"
                f"  表达重点：{focus}\n"
                f"  规避角度：{avoid}\n"
                f"  策略摘要：{channel_strategy.strategy_summary}\n\n"
                f"【候选基金】\n{funds_payload}\n\n"
                "请输出以下 JSON 字段（所有字段均为必填）：\n\n"
                "headline (string)\n"
                "  营销主题标题，10-25字，突出热点+产品+渠道特色\n\n"
                "one_liner (string)\n"
                "  一句话推荐语，30-60字，包含热点关联和渠道适配信息\n\n"
                "selling_points (string数组，3-4条)\n"
                "  核心卖点，每条15-30字。从主题匹配、持仓优势、风险特征、渠道适配四个维度各提炼一点\n"
                "  示例：[\"持仓高度聚焦半导体产业链，精准匹配AI算力热点\", \"R3风险等级匹配平衡型客户，波动率低于同类均值\"]\n\n"
                "relationship_manager_script (string，150-220字)\n"
                "  客户经理面谈话术。口语化、有温度、专业可信，可用于晨会分享或一对一客户沟通\n"
                "  结构建议：热点引入(1句) → 产品匹配逻辑(2-3句) → 适配客户画像(1-2句) → 风险提示(1句)\n\n"
                "social_post (string，80-140字)\n"
                "  微信朋友圈/社媒短文案。轻松专业，带emoji和话题标签更佳\n\n"
                "long_form (string，200-280字)\n"
                "  产品推介长文。适合发给高净值客户或发在理财客户群\n"
                "  结构建议：热点背景(2-3句) → 产品亮点(3-4句) → 适合谁/不适合谁(1-2句) → 风险提示(1句)\n\n"
                "investor_education (string数组，3-5条)\n"
                "  投教要点。通俗解释该基金涉及的投资概念，帮理财经理快速建立专业知识\n"
                "  示例：[\"半导体产业链：从芯片设计→制造→封测，ETF跟踪的指数覆盖全产业链龙头\"]\n\n"
                "objection_handling (对象数组，2-3条，每条含 objection 和 response)\n"
                "  常见客户异议及应对话术。模拟真实客户提问，给出专业得体的回答\n"
                "  示例：{{\"objection\": \"最近科技股波动太大了，现在买会不会追高？\", \"response\": \"您的担心很合理。这只基金跟踪的是半导体指数，当前估值处于近三年中位数以下...\"}}\n\n"
                "risk_disclosure (string)\n"
                "  风险揭示。必须包含：基金投资有风险、不构成任何收益承诺、过往业绩不预示未来表现\n\n"
                "重要提醒：\n"
                "- 如果候选基金为空，selling_points/investor_education/objection_handling 返回空数组，正文只输出热点观察和建议\n"
                "- 不得编造基金名称或数据\n"
                "- {lead_name}的选品依据是{lead_reason}，请据此展开而非凭空发挥"
            ),
            temperature=0.35,
        )
        return self._parse_result(result)

    def _parse_result(self, result: dict) -> MarketingCopy:
        raw_handling = result.get("objection_handling") or []
        objection_items = [
            ObjectionHandling(
                objection=str(item.get("objection", "")),
                response=str(item.get("response", "")),
            )
            for item in raw_handling
            if isinstance(item, dict)
        ]

        selling_points = [str(item) for item in result.get("selling_points", [])]
        investor_education = [str(item) for item in result.get("investor_education", [])]

        # Fallback: if LLM returned empty arrays, generate basic ones from the generated text
        headline = str(result.get("headline", ""))
        one_liner = str(result.get("one_liner", ""))
        relationship_manager_script = str(result.get("relationship_manager_script", ""))
        social_post = str(result.get("social_post", ""))
        long_form = str(result.get("long_form", ""))
        risk_disclosure = str(result.get("risk_disclosure", ""))

        if not selling_points:
            selling_points = [
                f"主题聚焦：{headline}",
                one_liner,
                "该基金经过系统初筛，在主题匹配、持仓相关度和渠道适配方面表现较优",
                "具体投资决策需结合客户风险承受能力和资产配置需求综合判断",
            ]
        if not investor_education:
            investor_education = [
                "建议了解该基金所涉及的行业产业链结构，帮助客户理解投资逻辑",
                "指数型基金跟踪特定指数，被动投资风格透明，费率通常低于主动管理型基金",
                "基金投资需关注波动率、最大回撤、费率、跟踪误差等关键指标",
            ]
        if not objection_items:
            objection_items = [
                ObjectionHandling(
                    objection="最近市场波动较大，现在适合投资吗？",
                    response="市场波动是正常现象。我们建议通过定投方式分批建仓以平摊成本。同时需关注产品的风险等级是否与您的风险承受能力匹配，不必过度关注短期涨跌。",
                ),
                ObjectionHandling(
                    objection="这只基金的收益预期如何？",
                    response="我们不预测具体收益。基金过往业绩不预示未来表现，投资需关注产品本身的风险特征、投资方向和费率结构，结合个人投资目标和期限做决策。",
                ),
            ]

        return MarketingCopy(
            headline=headline,
            one_liner=one_liner,
            relationship_manager_script=relationship_manager_script,
            social_post=social_post,
            long_form=long_form,
            risk_disclosure=risk_disclosure,
            selling_points=selling_points,
            investor_education=investor_education,
            objection_handling=objection_items,
        )

    def _generate_with_template(
        self,
        hotspot_analysis: HotspotAnalysisResponse,
        channel_strategy: ChannelStrategy,
        recommended_funds: list[RecommendedFund],
    ) -> MarketingCopy:
        lead_fund = recommended_funds[0] if recommended_funds else None
        fund_names = "、".join(fund.fund_name for fund in recommended_funds[:3])
        themes = "、".join(hotspot_analysis.themes[:4])
        focus = "、".join(channel_strategy.messaging_focus[:2])
        channel = channel_strategy.channel
        hotspot = hotspot_analysis.hotspot

        headline = f"{channel}{hotspot}主题基金配置观察"
        one_liner = (
            f"围绕{hotspot}热点，系统优先筛选出与{themes}相关度较高、"
            f"且更匹配{channel}客户沟通风格的基金产品。"
        )

        if lead_fund:
            relationship_manager_script = (
                f"近期{hotspot_analysis.summary}"
                f"在产品筛选上，{lead_fund.fund_name}的综合匹配分为{lead_fund.score}，"
                f"主要因为{lead_fund.reason.rstrip('。')}。这类产品适合{lead_fund.suitable_clients}，"
                f"不适合{lead_fund.unsuitable_clients}。建议结合客户现有持仓和风险偏好综合判断。"
            )
        else:
            relationship_manager_script = (
                f"近期{hotspot}主题关注度上升，但我们暂未筛选出直接匹配的基金产品，"
                f"建议先关注相关产业链动态，待基金池数据更新后再做选品决策。"
            )

        social_post = (
            f"{hotspot}热度上升，相关产业链包括{themes}。"
            f"我们从基金持仓、产品定位、风险特征和渠道客户适配度出发，筛选出"
            f"{fund_names}等产品供进一步审核。基金投资有风险，具体配置需结合客户风险承受能力。"
        )

        long_form = (
            f"本次营销主题为{hotspot}。热点逻辑方面，{hotspot_analysis.summary}"
            f"机会方面关注{hotspot_analysis.opportunities[0].title if hotspot_analysis.opportunities else '暂无'}，"
            f"需要注意{hotspot_analysis.risks[0].title if hotspot_analysis.risks else '暂无'}。"
            f"结合{channel}客户画像，文案表达建议突出{focus}，"
            f"避免使用短期收益导向或确定性收益表述。系统初筛靠前的候选产品为{fund_names or '暂无'}，"
            f"初筛依据包括主题相关度、持仓匹配、产品定位和风险等级适配。"
        )

        risk_disclosure = (
            "以上内容仅作为基金产品营销材料生成和内部审核辅助，不构成任何收益承诺或投资建议。"
            "基金过往业绩不预示未来表现，投资需结合客户风险承受能力、投资期限和资产配置需求。"
        )

        selling_points = (
            [
                f"主题匹配度高：命中{hotspot}相关标签{len(lead_fund.matched_tags)}个",
                f"持仓聚焦：前十大持仓覆盖{len(lead_fund.industry_allocation)}个行业",
                f"风险可控：等级{lead_fund.risk_level}，匹配{channel}客户画像",
                f"同组排名前{lead_fund.category_rank}/{lead_fund.category_total}",
            ]
            if lead_fund
            else []
        )

        investor_education = (
            [
                f"{hotspot}产业链：建议关注上游原材料、中游制造、下游应用三个环节",
                f"指数型基金特点：被动跟踪指数，费用较低，适合看好行业长期趋势的客户",
                "基金投资需关注：波动率、最大回撤、费率、跟踪误差等指标",
            ]
            if lead_fund
            else []
        )

        objection_handling = (
            [
                ObjectionHandling(
                    objection="最近市场波动大，现在适合投资吗？",
                    response="市场波动是正常现象。我们建议通过定投方式分批建仓，平摊成本。同时这只基金风险等级适中，适合有中长期配置需求的客户，不必过度关注短期波动。",
                ),
                ObjectionHandling(
                    objection=f"{hotspot}主题已经涨了不少，会不会追高？",
                    response="理解您的顾虑。我们更关注的是产业链的长期趋势而非短期涨跌。建议您可以先小仓位参与，后续根据市场变化和自身判断再决定是否加仓。",
                ),
            ]
            if lead_fund
            else []
        )

        return MarketingCopy(
            headline=headline,
            one_liner=one_liner,
            relationship_manager_script=relationship_manager_script,
            social_post=social_post,
            long_form=long_form,
            risk_disclosure=risk_disclosure,
            selling_points=selling_points,
            investor_education=investor_education,
            objection_handling=objection_handling,
        )
