from app.schemas import ChannelStrategy, HotspotAnalysisResponse, MarketingCopy, RecommendedFund
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
                "score": fund.score,
                "matched_tags": fund.matched_tags,
                "reason": fund.reason,
                "suitable_clients": fund.suitable_clients,
                "unsuitable_clients": fund.unsuitable_clients,
                "risk_warning": fund.risk_warning,
            }
            for fund in recommended_funds[:3]
        ]
        result = self.llm.chat_json(
            system_prompt=(
                "你是银行渠道基金营销材料助手。"
                "必须合规、克制、可审核，只能输出严格 JSON。"
                "禁止出现保本、稳赚、必涨、无风险、保证收益、收益承诺等表达。"
                "不得直接向终端客户给出买入指令。"
            ),
            user_prompt=(
                "请基于以下结构化信息生成银行渠道营销材料。\n"
                f"热点分析：{hotspot_analysis.model_dump_json(ensure_ascii=False)}\n"
                f"渠道画像：{channel_strategy.model_dump_json(ensure_ascii=False)}\n"
                f"推荐基金：{funds_payload}\n"
                "返回 JSON 字段：headline, one_liner, relationship_manager_script, social_post, long_form, risk_disclosure。\n"
                "relationship_manager_script 120-180 字；social_post 80-140 字；long_form 180-260 字；"
                "risk_disclosure 必须包含：基金投资有风险、不构成任何收益承诺、过往业绩不预示未来表现。"
            ),
            temperature=0.35,
        )
        return MarketingCopy(
            headline=str(result["headline"]),
            one_liner=str(result["one_liner"]),
            relationship_manager_script=str(result["relationship_manager_script"]),
            social_post=str(result["social_post"]),
            long_form=str(result["long_form"]),
            risk_disclosure=str(result["risk_disclosure"]),
        )

    def _generate_with_template(
        self,
        hotspot_analysis: HotspotAnalysisResponse,
        channel_strategy: ChannelStrategy,
        recommended_funds: list[RecommendedFund],
    ) -> MarketingCopy:
        lead_fund = recommended_funds[0]
        fund_names = "、".join(fund.fund_name for fund in recommended_funds[:3])
        themes = "、".join(hotspot_analysis.themes[:4])
        focus = "、".join(channel_strategy.messaging_focus[:2])

        headline = f"{channel_strategy.channel}{hotspot_analysis.hotspot}主题基金配置观察"
        one_liner = (
            f"围绕{hotspot_analysis.hotspot}热点，系统优先筛选出与{themes}相关度较高、"
            f"且更匹配{channel_strategy.channel}客户沟通风格的基金产品。"
        )
        relationship_manager_script = (
            f"客户经理可这样介绍：近期{hotspot_analysis.summary}"
            f"在产品筛选上，{lead_fund.fund_name}的综合匹配分为{lead_fund.score}，"
            f"主要因为{lead_fund.reason.rstrip('。')}。这类产品适合{lead_fund.suitable_clients}，"
            f"不适合{lead_fund.unsuitable_clients}。"
        )
        social_post = (
            f"{hotspot_analysis.hotspot}热度上升，相关产业链包括{themes}。"
            f"我们从基金持仓、产品定位、风险特征和渠道客户适配度出发，筛选出"
            f"{fund_names}等产品供进一步审核。基金投资有风险，具体配置需结合客户风险承受能力。"
        )
        long_form = (
            f"本次营销主题为{hotspot_analysis.hotspot}。热点逻辑方面，{hotspot_analysis.summary}"
            f"机会主要来自{hotspot_analysis.opportunities[0]}，但也需要关注{hotspot_analysis.risks[0]}。"
            f"结合{channel_strategy.channel}客户画像，文案表达建议突出{focus}，"
            f"避免使用短期收益导向或确定性收益表述。系统推荐的首位产品为{lead_fund.fund_name}，"
            f"推荐依据包括主题相关度、持仓匹配、产品定位和风险等级适配。"
        )
        risk_disclosure = (
            "以上内容仅作为基金产品营销材料生成和内部审核辅助，不构成任何收益承诺或投资建议。"
            "基金过往业绩不预示未来表现，投资需结合客户风险承受能力、投资期限和资产配置需求。"
        )

        return MarketingCopy(
            headline=headline,
            one_liner=one_liner,
            relationship_manager_script=relationship_manager_script,
            social_post=social_post,
            long_form=long_form,
            risk_disclosure=risk_disclosure,
        )
