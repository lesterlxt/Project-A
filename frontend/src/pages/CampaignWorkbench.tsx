import { LineChart, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AppOptions,
  CampaignResponse,
  EFundSupermarketResponse,
  FundPoolStatus,
  FundPoolSummary,
  MarketOverviewResponse,
  RecommendedFund,
  TodayHotspot,
  fetchAppOptions,
  fetchEFundSupermarket,
  fetchFundPoolSummary,
  fetchFundPoolStatus,
  fetchMarketOverview,
  fetchTodayHotspots,
  runCampaign,
  syncRealFunds,
} from "../api/campaignApi";
import { AgentPipelineStatus } from "../components/AgentPipelineStatus";
import { CompliancePanel } from "../components/CompliancePanel";
import { ControlPanel } from "../components/ControlPanel";
import { ExcludedFundsPanel } from "../components/ExcludedFundsPanel";
import { FundEvidencePanel } from "../components/FundEvidencePanel";
import { FundPoolStatusCard } from "../components/FundPoolStatusCard";
import { FundRankingTable } from "../components/FundRankingTable";
import { MarketingCopyPanel } from "../components/MarketingCopyPanel";
import { PreAnalysisDashboard } from "../components/PreAnalysisDashboard";
import { ReviewActions } from "../components/ReviewActions";
import { Badge } from "../components/ui/badge";

export function CampaignWorkbench() {
  const [hotspot, setHotspot] = useState("AI算力");
  const [channel, setChannel] = useState("招商银行");
  const [riskPreference, setRiskPreference] = useState("平衡型");
  const [fundTypeFilter, setFundTypeFilter] = useState("全部");
  const [topK, setTopK] = useState(5);
  const [result, setResult] = useState<CampaignResponse | null>(null);
  const [selectedFundCode, setSelectedFundCode] = useState<string>("");
  const [todayHotspots, setTodayHotspots] = useState<TodayHotspot[]>([]);
  const [hotspotsUpdatedAt, setHotspotsUpdatedAt] = useState("");
  const [hotspotsLoading, setHotspotsLoading] = useState(false);
  const [fundStatus, setFundStatus] = useState<FundPoolStatus | null>(null);
  const [fundSummary, setFundSummary] = useState<FundPoolSummary | null>(null);
  const [marketOverview, setMarketOverview] = useState<MarketOverviewResponse | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [efundSupermarket, setEfundSupermarket] = useState<EFundSupermarketResponse | null>(null);
  const [efundLoading, setEfundLoading] = useState(false);
  const [efundError, setEfundError] = useState("");
  const [options, setOptions] = useState<AppOptions | null>(null);
  const [fundSyncing, setFundSyncing] = useState(false);
  const [fundSyncMessage, setFundSyncMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let active = true;
    setHotspotsLoading(true);
    fetchAppOptions()
      .then((response) => {
        if (!active) return;
        setOptions(response);
        setHotspot((current) => current.trim() || response.defaults.hotspot);
        setChannel(response.defaults.channel);
        setRiskPreference(response.defaults.risk_preference);
        setFundTypeFilter(response.defaults.fund_type_filter);
        setTopK(response.defaults.top_k);
      })
      .catch(() => {
        if (active) setOptions(null);
      });

    fetchTodayHotspots()
      .then((response) => {
        if (!active) return;
        setTodayHotspots(response.items);
        setHotspotsUpdatedAt(response.updated_at);
        if (response.items[0]) setHotspot(response.items[0].name);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "热点获取失败");
      })
      .finally(() => {
        if (active) setHotspotsLoading(false);
      });

    fetchFundPoolStatus()
      .then((response) => {
        if (active) setFundStatus(response);
      })
      .catch(() => {
        if (active) setFundStatus(null);
      });

    fetchFundPoolSummary()
      .then((response) => {
        if (active) setFundSummary(response);
      })
      .catch(() => {
        if (active) setFundSummary(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMarketOverview() {
      setMarketLoading(true);
      try {
        const response = await fetchMarketOverview();
        if (!active) return;
        setMarketOverview(response);
        setMarketError("");
      } catch (err) {
        if (!active) return;
        setMarketOverview(null);
        setMarketError(err instanceof Error ? err.message : "市场数据暂不可用");
      } finally {
        if (active) setMarketLoading(false);
      }
    }

    loadMarketOverview();
    const timer = window.setInterval(loadMarketOverview, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setEfundLoading(true);
    fetchEFundSupermarket()
      .then((response) => {
        if (!active) return;
        setEfundSupermarket(response);
        setEfundError("");
      })
      .catch((err) => {
        if (!active) return;
        setEfundSupermarket(null);
        setEfundError(err instanceof Error ? err.message : "易方达基金超市数据暂不可用");
      })
      .finally(() => {
        if (active) setEfundLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedFund = useMemo<RecommendedFund | null>(() => {
    if (!result) return null;
    return (
      result.recommended_funds.find((fund) => fund.fund_code === selectedFundCode) ??
      result.recommended_funds[0] ??
      null
    );
  }, [result, selectedFundCode]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await runCampaign({
        hotspot,
        channel,
        risk_preference: riskPreference,
        fund_type_filter: fundTypeFilter,
        top_k: topK,
      });
      setResult(response);
      setSelectedFundCode(response.recommended_funds[0]?.fund_code ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleFundSync() {
    setFundSyncing(true);
    setFundSyncMessage("");
    setError("");
    try {
      const response = await syncRealFunds({
        limit: options?.fund_sync_defaults.limit,
        enrichLimit: options?.fund_sync_defaults.enrich_limit,
        keywords: options?.fund_sync_defaults.keywords,
      });
      setFundSyncMessage(`已同步 ${response.synced_count} 只基金。`);
      const status = await fetchFundPoolStatus();
      setFundStatus(status);
      const summary = await fetchFundPoolSummary();
      setFundSummary(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "基金池同步失败");
    } finally {
      setFundSyncing(false);
    }
  }

  const selectedHotspot = todayHotspots.find((item) => item.name === hotspot);
  const updatedTime = hotspotsUpdatedAt
    ? new Date(hotspotsUpdatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  return (
    <main className="min-h-screen bg-white">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-r bg-white p-4 xl:sticky xl:top-0 xl:h-screen xl:overflow-y-auto">
          <div className="mb-4">
            <div className="text-lg font-semibold">Project A</div>
            <div className="text-sm text-muted-foreground">基金热点选品与营销工作台</div>
          </div>
          <div className="space-y-4">
            <ControlPanel
              hotspot={hotspot}
              channel={channel}
              riskPreference={riskPreference}
              fundTypeFilter={fundTypeFilter}
              topK={topK}
              channels={options?.channels ?? ["招商银行", "工商银行", "建设银行", "农业银行"]}
              riskPreferences={options?.risk_preferences ?? ["稳健型", "平衡型", "进取型"]}
              fundTypes={options?.fund_type_filters ?? ["全部", "权益", "指数", "ETF联接", "固收+", "红利低波"]}
              loading={loading}
              error={error}
              onHotspotChange={setHotspot}
              onChannelChange={setChannel}
              onRiskPreferenceChange={setRiskPreference}
              onFundTypeFilterChange={setFundTypeFilter}
              onTopKChange={setTopK}
              onSubmit={handleSubmit}
            />
            <FundPoolStatusCard
              status={fundStatus}
              syncing={fundSyncing}
              message={fundSyncMessage}
              onSync={handleFundSync}
            />
            <AgentPipelineStatus hasResult={Boolean(result)} loading={loading} />
          </div>
        </aside>

        <section className="p-4 md:p-6">
          <header className="mb-5 flex flex-col justify-between gap-4 border-b pb-5 lg:flex-row lg:items-end">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-normal">
                基金热点选品与渠道支持
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                基于公开行情、热点新闻和本地基金池，生成候选基金、渠道文案和合规检查结果。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-6 text-right text-sm">
              <HeaderMetric label="基金池" value={fundStatus?.total_count ? fundStatus.total_count.toLocaleString("zh-CN") : "--"} />
              <HeaderMetric label="存储" value={fundStatus?.storage || "SQLite"} />
              <HeaderMetric label="热点更新" value={updatedTime} />
            </div>
          </header>

          {!result && (
            <PreAnalysisDashboard
              hotspot={hotspot}
              channel={channel}
              riskPreference={riskPreference}
              fundTypeFilter={fundTypeFilter}
              topK={topK}
              todayHotspots={todayHotspots}
              hotspotsLoading={hotspotsLoading}
              fundSummary={fundSummary}
              marketOverview={marketOverview}
              marketLoading={marketLoading}
              marketError={marketError}
              efundSupermarket={efundSupermarket}
              efundLoading={efundLoading}
              efundError={efundError}
              onHotspotSelect={setHotspot}
            />
          )}

          {result && (
            <div className="space-y-8">
              <ReviewActions result={result} />

              <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-md border bg-card px-5 py-3 text-sm">
                <StatItem label="热点" value={result.hotspot_analysis.hotspot} />
                <StatItem label="候选基金" value={`${result.recommended_funds.length} 只（通过 P0 初筛）`} />
                <StatItem label="已筛基金" value={`${result.screened_count} 只 / ${result.excluded_count} 只被拦截`} />
                <StatItem label="渠道" value={`${result.channel_strategy.channel} · ${riskPreference}`} />
                <StatItem label="合规" value={result.compliance.passed ? "基础规则通过" : "需复核"} />
              </div>

              <FundRankingTable
                funds={result.recommended_funds}
                selectedFundCode={selectedFund?.fund_code ?? ""}
                onSelect={setSelectedFundCode}
              />

              {selectedFund && (
                <FundEvidencePanel fund={selectedFund} scoringModel={options?.scoring_model ?? []} />
              )}

              <HotspotAnalysisSection response={result} selectedHotspot={selectedHotspot} />

              <div className="grid gap-8 xl:grid-cols-2">
                <MarketingCopyPanel copy={result.marketing_copy} strategy={result.channel_strategy} />
                <CompliancePanel compliance={result.compliance} />
              </div>

              {selectedFund && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck size={17} className="text-muted-foreground" />
                    <h2 className="text-base font-semibold">适当性边界</h2>
                  </div>
                  <div className="grid gap-3 rounded-md border p-4 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-sm font-medium">适合客户</div>
                      <p className="text-sm leading-6 text-muted-foreground">{selectedFund.suitable_clients}</p>
                    </div>
                    <div>
                      <div className="mb-1 text-sm font-medium">不适合客户</div>
                      <p className="text-sm leading-6 text-muted-foreground">{selectedFund.unsuitable_clients}</p>
                    </div>
                    <div>
                      <div className="mb-1 text-sm font-medium">风险提示</div>
                      <p className="text-sm leading-6 text-muted-foreground">{selectedFund.risk_warning}</p>
                    </div>
                    <div>
                      <div className="mb-1 text-sm font-medium">渠道表达重点</div>
                      <p className="text-sm leading-6 text-muted-foreground">{result.channel_strategy.messaging_focus.join(" / ")}</p>
                    </div>
                  </div>
                </section>
              )}

              <ExcludedFundsPanel funds={result.excluded_funds} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function HotspotAnalysisSection({
  response,
  selectedHotspot,
}: {
  response: CampaignResponse;
  selectedHotspot?: TodayHotspot;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <LineChart size={17} className="text-muted-foreground" />
        <h2 className="text-base font-semibold">热点主题分析</h2>
      </div>
      <div className="space-y-4 rounded-md border p-5">
        <p className="text-sm leading-6 text-muted-foreground">{response.hotspot_analysis.summary}</p>

        <TagBlock title="主题标签" items={response.hotspot_analysis.themes} />
        <TagBlock title="相关行业" items={response.hotspot_analysis.industries} />
        <TagBlock title="关键词" items={response.hotspot_analysis.keywords} />

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="mb-1 text-sm font-medium text-amber-950">主要风险</div>
          <p className="text-sm leading-6 text-amber-900">{response.hotspot_analysis.risks.join(" / ")}</p>
        </div>

        {selectedHotspot && (selectedHotspot.evidence_headlines?.length ?? 0) > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">来源新闻</div>
            <div className="space-y-1.5">
              {selectedHotspot.evidence_headlines?.slice(0, 3).map((headline) => (
                <p key={`${headline.title}-${headline.source}`} className="text-xs leading-5 text-muted-foreground">
                  {headline.source}：{headline.title}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TagBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="muted">{item}</Badge>
        ))}
      </div>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
