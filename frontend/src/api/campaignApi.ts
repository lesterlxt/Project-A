export type CampaignRequest = {
  hotspot: string;
  channel: string;
  risk_preference: string;
  fund_type_filter: string;
  top_k: number;
};

export type HotspotAnalysis = {
  hotspot: string;
  summary: string;
  themes: string[];
  industries: string[];
  keywords: string[];
  opportunities: string[];
  risks: string[];
};

export type TodayHotspot = {
  name: string;
  heat_score: number;
  summary: string;
  related_keywords: string[];
  source: string;
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

export type ScoreBreakdown = {
  theme_relevance: number;
  holding_match: number;
  positioning_match: number;
  performance_stability: number;
  channel_match: number;
  compliance_penalty: number;
};

export type RecommendedFund = {
  fund_code: string;
  fund_name: string;
  fund_type: string;
  manager: string;
  score: number;
  score_breakdown: ScoreBreakdown;
  matched_tags: string[];
  reason: string;
  suitable_clients: string;
  unsuitable_clients: string;
  risk_warning: string;
};

export type ChannelStrategy = {
  channel: string;
  client_profile: string[];
  messaging_focus: string[];
  forbidden_angles: string[];
  strategy_summary: string;
};

export type MarketingCopy = {
  headline: string;
  one_liner: string;
  relationship_manager_script: string;
  social_post: string;
  long_form: string;
  risk_disclosure: string;
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
  marketing_copy: MarketingCopy;
  compliance: ComplianceResult;
};

const API_BASE = "http://127.0.0.1:8000";

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

export async function syncRealFunds(options?: {
  limit?: number;
  enrichLimit?: number;
  keywords?: string[];
}): Promise<FundSyncResponse> {
  const {
    limit = 3000,
    enrichLimit = 100,
    keywords = [
      "AI", "科技", "半导体", "算力", "机器人", "创新药", "医药", "红利",
      "低波", "储能", "电力", "新能源", "军工", "消费", "银行", "券商",
      "农业", "汽车", "有色", "煤炭", "化工", "通信", "计算机", "电子",
      "港股", "美股", "沪深300", "中证500", "创业板", "科创板",
    ],
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
