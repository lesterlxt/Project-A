from app.agents.channel_strategy_agent import ChannelStrategyAgent
from app.agents.copywriting_agent import CopywritingAgent
from app.agents.eligibility_agent import EligibilityAgent
from app.agents.hotspot_agent import HotspotAgent
from app.schemas import CampaignRequest, CampaignResponse, HotspotAnalysisResponse
from app.services.compliance import ComplianceChecker
from app.services.fund_loader import FundLoader
from app.services.fund_scorer import FundScorer
from app.services.rule_config import load_rule_config


class CampaignOrchestrator:
    def __init__(self) -> None:
        self.hotspot_agent = HotspotAgent()
        self.fund_loader = FundLoader()
        self.eligibility_agent = EligibilityAgent()
        self.fund_scorer = FundScorer()
        self.channel_agent = ChannelStrategyAgent()
        self.copywriter = CopywritingAgent()
        self.compliance_checker = ComplianceChecker()

    def analyze_hotspot(self, hotspot: str) -> HotspotAnalysisResponse:
        return self.hotspot_agent.analyze(hotspot)

    def run(self, request: CampaignRequest) -> CampaignResponse:
        hotspot_analysis = self.hotspot_agent.analyze(request.hotspot)
        funds = self.fund_loader.load()
        filtered_funds = self._filter_funds(funds, request.fund_type_filter)
        if not filtered_funds:
            filtered_funds = funds
        screened_funds = self.eligibility_agent.screen(
            filtered_funds,
            request.risk_preference,
        )
        eligible_funds = [item for item in screened_funds if item.is_eligible]
        excluded_funds = [item for item in screened_funds if not item.is_eligible]
        channel_strategy = self.channel_agent.build(request.channel)
        recommended_funds = self.fund_scorer.score(
            funds=eligible_funds,
            hotspot_analysis=hotspot_analysis,
            channel_strategy=channel_strategy,
            risk_preference=request.risk_preference,
            top_k=request.top_k,
        )
        excluded_fund_items = self.fund_scorer.excluded(
            funds=excluded_funds,
            hotspot_analysis=hotspot_analysis,
        )
        marketing_copy = self.copywriter.generate(
            hotspot_analysis=hotspot_analysis,
            channel_strategy=channel_strategy,
            recommended_funds=recommended_funds,
        )
        compliance = self.compliance_checker.check(marketing_copy)

        return CampaignResponse(
            hotspot_analysis=hotspot_analysis,
            channel_strategy=channel_strategy,
            recommended_funds=recommended_funds,
            excluded_funds=excluded_fund_items,
            screened_count=len(screened_funds),
            eligible_count=len(eligible_funds),
            excluded_count=len(excluded_funds),
            marketing_copy=marketing_copy,
            compliance=compliance,
        )

    def _filter_funds(self, funds, fund_type_filter: str):
        if fund_type_filter == "全部":
            return funds
        rule = load_rule_config().fund_type_filter_rules.get(fund_type_filter)
        if rule is None:
            return funds

        fund_type_contains = rule.get("fund_type_contains", [])
        positioning_any = set(rule.get("positioning_any", []))
        return [
            fund
            for fund in funds
            if any(token in fund.fund_type for token in fund_type_contains)
            or bool(positioning_any & set(fund.positioning))
        ]
