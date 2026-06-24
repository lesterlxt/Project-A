from app.agents.channel_strategy_agent import ChannelStrategyAgent
from app.agents.copywriting_agent import CopywritingAgent
from app.agents.hotspot_agent import HotspotAgent
from app.schemas import CampaignRequest, CampaignResponse, HotspotAnalysisResponse
from app.services.compliance import ComplianceChecker
from app.services.fund_loader import FundLoader
from app.services.fund_scorer import FundScorer


class CampaignOrchestrator:
    def __init__(self) -> None:
        self.hotspot_agent = HotspotAgent()
        self.fund_loader = FundLoader()
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
        channel_strategy = self.channel_agent.build(request.channel)
        recommended_funds = self.fund_scorer.score(
            funds=filtered_funds,
            hotspot_analysis=hotspot_analysis,
            channel_strategy=channel_strategy,
            risk_preference=request.risk_preference,
            top_k=request.top_k,
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
            marketing_copy=marketing_copy,
            compliance=compliance,
        )

    def _filter_funds(self, funds, fund_type_filter: str):
        if fund_type_filter == "全部":
            return funds
        if fund_type_filter == "权益":
            return [fund for fund in funds if fund.fund_type in {"股票型", "偏股混合", "混合型"}]
        if fund_type_filter == "固收+":
            return [fund for fund in funds if fund.fund_type in {"债券型", "混合型"} or "固收+" in fund.positioning]
        if fund_type_filter == "红利低波":
            return [fund for fund in funds if {"红利", "低波", "高股息"} & set(fund.positioning)]
        if fund_type_filter in {"指数", "ETF联接"}:
            return [fund for fund in funds if fund_type_filter in fund.fund_type]
        return funds
