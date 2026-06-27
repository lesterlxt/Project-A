from pydantic import BaseModel, Field


class HotspotAnalysisRequest(BaseModel):
    hotspot: str = Field(..., examples=["AI算力"])


class DriverItem(BaseModel):
    title: str = ""
    description: str = ""


class OppRiskItem(BaseModel):
    title: str = ""
    description: str = ""


class IndustryChain(BaseModel):
    upstream: list[str] = Field(default_factory=list)
    midstream: list[str] = Field(default_factory=list)
    downstream: list[str] = Field(default_factory=list)


class HotspotAnalysisResponse(BaseModel):
    hotspot: str
    insufficient_data: bool = False
    summary: str = ""
    core_drivers: list[DriverItem] = Field(default_factory=list)
    industry_chain: IndustryChain = Field(default_factory=IndustryChain)
    opportunities: list[OppRiskItem] = Field(default_factory=list)
    risks: list[OppRiskItem] = Field(default_factory=list)
    related_fund_directions: list[str] = Field(default_factory=list)
    evidence_headlines: list[str] = Field(default_factory=list)
    compliance_note: str = ""
    # Flat lists for scoring compatibility and quick reference
    themes: list[str] = Field(default_factory=list)
    industries: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)


class NewsEvidence(BaseModel):
    title: str
    source: str
    published_at: str


class HotspotItem(BaseModel):
    name: str
    heat_score: int
    summary: str
    related_keywords: list[str]
    source: str
    source_detail: str = ""
    evidence_headlines: list[NewsEvidence] = Field(default_factory=list)


class TodayHotspotsResponse(BaseModel):
    updated_at: str
    source: str
    items: list[HotspotItem]


class FundSyncRequest(BaseModel):
    limit: int = Field(default=3000, ge=1, le=5000)
    enrich_limit: int = Field(default=80, ge=0, le=500)
    keywords: list[str] = Field(default_factory=list)


class FundSyncResponse(BaseModel):
    source: str
    saved_path: str
    total_candidates: int
    synced_count: int
    enriched_count: int
    keywords: list[str]
    updated_at: str
    message: str


class FundPoolStatusResponse(BaseModel):
    available: bool
    storage: str
    source: str
    total_count: int
    enriched_count: int
    latest_updated_at: str | None
    db_path: str


class DistributionItem(BaseModel):
    label: str
    count: int


class FundPoolSummaryResponse(BaseModel):
    available: bool
    source: str
    total_count: int
    enriched_count: int
    fund_type_distribution: list[DistributionItem]
    risk_level_distribution: list[DistributionItem]


class MarketOverviewItem(BaseModel):
    market_dimension: str
    indicator_name: str
    latest_value: float | None
    change_value: float | None
    change_percent: float | None
    one_month_percent: float | None
    interpretation: str
    related_fund_types: list[str]
    channel_scenario: str
    status: str
    source: str


class MarketOverviewResponse(BaseModel):
    updated_at: str
    source: str
    refresh_interval_seconds: int
    items: list[MarketOverviewItem]


class EFundSupermarketItem(BaseModel):
    fund_code: str
    fund_name: str
    fund_type: str
    risk_level: str
    manager: str
    net_value: str
    trade_date: str
    daily_change_percent: float | None
    one_month_percent: float | None
    one_year_percent: float | None


class EFundSupermarketResponse(BaseModel):
    updated_at: str
    source: str
    total_count: int
    items: list[EFundSupermarketItem]


class FundSyncDefaults(BaseModel):
    limit: int
    enrich_limit: int
    keywords: list[str]


class CampaignDefaults(BaseModel):
    hotspot: str
    channel: str
    risk_preference: str
    fund_type_filter: str
    top_k: int


class ScoreFormula(BaseModel):
    key: str
    label: str
    formula: str
    description: str
    max_score: float | None = None
    evidence_fields: list[str] = Field(default_factory=list)


class AppOptionsResponse(BaseModel):
    channels: list[str]
    risk_preferences: list[str]
    fund_type_filters: list[str]
    defaults: CampaignDefaults
    fund_sync_defaults: FundSyncDefaults
    scoring_model: list[ScoreFormula]


class CampaignRequest(BaseModel):
    hotspot: str = Field(..., examples=["AI算力"])
    channel: str = Field(default="招商银行", examples=["招商银行"])
    risk_preference: str = Field(default="平衡型", examples=["平衡型"])
    fund_type_filter: str = Field(default="全部", examples=["权益"])
    top_k: int = Field(default=5, ge=1, le=10)
    evidence_headlines: list[str] = Field(default_factory=list)


class ScoreBreakdown(BaseModel):
    theme_relevance: float
    holding_match: float
    positioning_match: float
    performance_stability: float
    channel_match: float
    compliance_penalty: float


class ExplanationPoint(BaseModel):
    label: str
    text: str
    evidence_fields: list[str]
    source: str


class RecommendedFund(BaseModel):
    fund_code: str
    fund_name: str
    fund_type: str
    fund_category: str
    compare_group: str
    category_reason: str
    category_rank: int = 0
    category_total: int = 0
    manager: str
    latest_nav: str
    estimated_growth: str
    one_year_return: float | None
    volatility: float | None
    max_drawdown: float | None
    risk_level: str
    risk_level_source: str = "inferred_from_fund_type"
    positioning: list[str]
    top_holdings: list[str]
    industry_allocation: dict[str, float]
    industry_allocation_source: str = ""
    fund_size: str = ""
    inception_date: str = ""
    management_fee: str = ""
    custody_fee: str = ""
    sales_service_fee: str = ""
    official_risk_level: str = ""
    manager_tenure: str = ""
    sharpe_ratio: str = ""
    calmar_ratio: str = ""
    peer_rank: str = ""
    data_source: str
    data_updated_at: str
    is_enriched: bool
    score: float
    score_breakdown: ScoreBreakdown
    explanation_points: list[ExplanationPoint] = Field(default_factory=list)
    matched_tags: list[str]
    reason: str
    suitable_clients: str
    unsuitable_clients: str
    risk_warning: str
    field_sources: dict[str, str]
    is_eligible: bool = True
    data_quality_score: float = 0
    missing_fields: list[str] = Field(default_factory=list)
    exclusion_reasons: list[str] = Field(default_factory=list)


class ChannelStrategy(BaseModel):
    channel: str
    client_profile: list[str]
    messaging_focus: list[str]
    forbidden_angles: list[str]
    strategy_summary: str


class ObjectionHandling(BaseModel):
    objection: str
    response: str


class MarketingCopy(BaseModel):
    headline: str
    one_liner: str
    relationship_manager_script: str
    social_post: str
    long_form: str
    risk_disclosure: str
    selling_points: list[str] = Field(default_factory=list)
    investor_education: list[str] = Field(default_factory=list)
    objection_handling: list[ObjectionHandling] = Field(default_factory=list)


class ComplianceIssue(BaseModel):
    term: str
    severity: str
    message: str


class ComplianceResult(BaseModel):
    passed: bool
    issues: list[ComplianceIssue]
    suggestions: list[str]


class CampaignResponse(BaseModel):
    hotspot_analysis: HotspotAnalysisResponse
    channel_strategy: ChannelStrategy
    recommended_funds: list[RecommendedFund]
    excluded_funds: list[RecommendedFund] = Field(default_factory=list)
    screened_count: int = 0
    eligible_count: int = 0
    excluded_count: int = 0
    marketing_copy: MarketingCopy
    compliance: ComplianceResult


class StockIndustryImportResponse(BaseModel):
    total_codes: int
    imported: int
    failed: int
    skipped: int
    elapsed_seconds: float
    mapping_count: int
    message: str
