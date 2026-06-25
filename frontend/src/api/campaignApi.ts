export type CampaignRequest = {
  hotspot: string;
  channel: string;
  risk_preference: string;
  fund_type_filter: string;
  top_k: number;
  evidence_headlines?: string[];
};

export type DriverItem = {
  title: string;
  description: string;
};

export type OppRiskItem = {
  title: string;
  description: string;
};

export type IndustryChain = {
  upstream: string[];
  midstream: string[];
  downstream: string[];
};

export type HotspotAnalysis = {
  hotspot: string;
  insufficient_data: boolean;
  summary: string;
  core_drivers: DriverItem[];
  industry_chain: IndustryChain;
  opportunities: OppRiskItem[];
  risks: OppRiskItem[];
  related_fund_directions: string[];
  evidence_headlines: string[];
  compliance_note: string;
  themes: string[];
  industries: string[];
  keywords: string[];
};

export type TodayHotspot = {
  name: string;
  heat_score: number;
  summary: string;
  related_keywords: string[];
  source: string;
  source_detail: string;
  evidence_headlines: {
    title: string;
    source: string;
    published_at: string;
  }[];
};

export type TodayHotspotsResponse = {
  updated_at: string;
  source: string;
  items: TodayHotspot[];
};

export type FundSyncResponse = {
  source: string;
  saved_path: string;
  total_candidates: number;
  synced_count: number;
  enriched_count: number;
  keywords: string[];
  updated_at: string;
  message: string;
};

export type FundPoolStatus = {
  available: boolean;
  storage: string;
  source: string;
  total_count: number;
  enriched_count: number;
  latest_updated_at: string | null;
  db_path: string;
};

export type DistributionItem = {
  label: string;
  count: number;
};

export type FundPoolSummary = {
  available: boolean;
  source: string;
  total_count: number;
  enriched_count: number;
  fund_type_distribution: DistributionItem[];
  risk_level_distribution: DistributionItem[];
};

export type MarketOverviewItem = {
  market_dimension: string;
  indicator_name: string;
  latest_value: number | null;
  change_value: number | null;
  change_percent: number | null;
  one_month_percent: number | null;
  interpretation: string;
  related_fund_types: string[];
  channel_scenario: string;
  status: string;
  source: string;
};

export type MarketOverviewResponse = {
  updated_at: string;
  source: string;
  refresh_interval_seconds: number;
  items: MarketOverviewItem[];
};

export type EFundSupermarketItem = {
  fund_code: string;
  fund_name: string;
  fund_type: string;
  risk_level: string;
  manager: string;
  net_value: string;
  trade_date: string;
  daily_change_percent: number | null;
  one_month_percent: number | null;
  one_year_percent: number | null;
};

export type EFundSupermarketResponse = {
  updated_at: string;
  source: string;
  total_count: number;
  items: EFundSupermarketItem[];
};

export type AppOptions = {
  channels: string[];
  risk_preferences: string[];
  fund_type_filters: string[];
  defaults: {
    hotspot: string;
    channel: string;
    risk_preference: string;
    fund_type_filter: string;
    top_k: number;
  };
  fund_sync_defaults: {
    limit: number;
    enrich_limit: number;
    keywords: string[];
  };
  scoring_model: ScoreFormula[];
};

export type ScoreFormula = {
  key: string;
  label: string;
  formula: string;
  description: string;
  max_score: number | null;
  evidence_fields: string[];
};

export type ScoreBreakdown = {
  theme_relevance: number;
  holding_match: number;
  positioning_match: number;
  performance_stability: number;
  channel_match: number;
  compliance_penalty: number;
};

export type ExplanationPoint = {
  label: string;
  text: string;
  evidence_fields: string[];
  source: string;
};

export type RecommendedFund = {
  fund_code: string;
  fund_name: string;
  fund_type: string;
  fund_category: string;
  compare_group: string;
  category_reason: string;
  category_rank: number;
  category_total: number;
  manager: string;
  latest_nav: string;
  estimated_growth: string;
  one_year_return: number | null;
  volatility: number | null;
  max_drawdown: number | null;
  risk_level: string;
  positioning: string[];
  top_holdings: string[];
  industry_allocation: Record<string, number>;
  data_source: string;
  data_updated_at: string;
  is_enriched: boolean;
  score: number;
  score_breakdown: ScoreBreakdown;
  explanation_points: ExplanationPoint[];
  matched_tags: string[];
  reason: string;
  suitable_clients: string;
  unsuitable_clients: string;
  risk_warning: string;
  field_sources: Record<string, "raw" | "calculated" | "inferred" | "generated" | "missing" | string>;
  is_eligible: boolean;
  data_quality_score: number;
  missing_fields: string[];
  exclusion_reasons: string[];
};

export type ChannelStrategy = {
  channel: string;
  client_profile: string[];
  messaging_focus: string[];
  forbidden_angles: string[];
  strategy_summary: string;
};

export type ObjectionHandling = {
  objection: string;
  response: string;
};

export type MarketingCopy = {
  headline: string;
  one_liner: string;
  relationship_manager_script: string;
  social_post: string;
  long_form: string;
  risk_disclosure: string;
  selling_points: string[];
  investor_education: string[];
  objection_handling: ObjectionHandling[];
};

export type ComplianceIssue = {
  term: string;
  severity: string;
  message: string;
};

export type ComplianceResult = {
  passed: boolean;
  issues: ComplianceIssue[];
  suggestions: string[];
};

export type CampaignResponse = {
  hotspot_analysis: HotspotAnalysis;
  channel_strategy: ChannelStrategy;
  recommended_funds: RecommendedFund[];
  excluded_funds: RecommendedFund[];
  screened_count: number;
  eligible_count: number;
  excluded_count: number;
  marketing_copy: MarketingCopy;
  compliance: ComplianceResult;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function runCampaign(request: CampaignRequest): Promise<CampaignResponse> {
  const response = await fetch(`${API_BASE}/api/run-campaign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "请求失败");
  }

  return response.json();
}

export async function fetchTodayHotspots(): Promise<TodayHotspotsResponse> {
  const response = await fetch(`${API_BASE}/api/hotspots/today`);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "热点获取失败");
  }

  return response.json();
}

export async function fetchFundPoolStatus(): Promise<FundPoolStatus> {
  const response = await fetch(`${API_BASE}/api/funds/status`);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "基金池状态获取失败");
  }

  return response.json();
}

export async function fetchFundPoolSummary(): Promise<FundPoolSummary> {
  const response = await fetch(`${API_BASE}/api/funds/summary`);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "基金池摘要获取失败");
  }

  return response.json();
}

export async function fetchMarketOverview(): Promise<MarketOverviewResponse> {
  const response = await fetch(`${API_BASE}/api/market/overview`);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "市场数据获取失败");
  }

  return response.json();
}

export async function fetchEFundSupermarket(): Promise<EFundSupermarketResponse> {
  const response = await fetch(`${API_BASE}/api/efunds/supermarket`);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "易方达基金超市数据获取失败");
  }

  return response.json();
}

export async function fetchAppOptions(): Promise<AppOptions> {
  const response = await fetch(`${API_BASE}/api/options`);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "系统选项获取失败");
  }

  return response.json();
}

export async function syncRealFunds(options?: {
  limit?: number;
  enrichLimit?: number;
  keywords?: string[];
}): Promise<FundSyncResponse> {
  const {
    limit = 3000,
    enrichLimit = 100,
    keywords = [],
  } = options ?? {};

  const response = await fetch(`${API_BASE}/api/funds/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      limit,
      enrich_limit: enrichLimit,
      keywords,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "基金池同步失败");
  }

  return response.json();
}
