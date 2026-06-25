import { LineChart } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { ControlPanel } from "../components/ControlPanel";
import { FundPoolStatusCard } from "../components/FundPoolStatusCard";
import { FundRankingTable } from "../components/FundRankingTable";
import { PreAnalysisDashboard } from "../components/PreAnalysisDashboard";
import { ReviewActions } from "../components/ReviewActions";
import { Badge } from "../components/ui/badge";
import { CampaignContext, clearStorage, loadFromStorage, saveToStorage } from "../context/CampaignContext";

export function CampaignWorkbench() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const view = searchParams.get("tab") === "result" ? "result" : "pre";
  const urlFundCode = searchParams.get("fund") ?? "";

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

  // Sync URL fund param → state (for browser back/forward)
  useEffect(() => {
    if (view === "result" && urlFundCode && result) {
      const exists = result.recommended_funds.some((f) => f.fund_code === urlFundCode);
      if (exists) setSelectedFundCode(urlFundCode);
    }
  }, [urlFundCode, result, view]);

  // When result appears, set URL to result view
  useEffect(() => {
    if (result && view === "pre") {
      const first = result.recommended_funds[0]?.fund_code ?? "";
      setSelectedFundCode(first);
      const params = new URLSearchParams();
      params.set("tab", "result");
      if (first) params.set("fund", first);
      setSearchParams(params, { replace: true });
    }
  }, [result]);

  // Navigate to fund detail page
  function handleFundSelect(fundCode: string) {
    setSelectedFundCode(fundCode);
    navigate(`/fund/${fundCode}`);
  }

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
    const timer = window.setInterval(loadMarketOverview, 300_000);
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

  // Restore campaign from sessionStorage on mount (e.g. back from FundDetailPage)
  useEffect(() => {
    if (!result && view === "result") {
      const stored = loadFromStorage();
      if (stored?.result) {
        setResult(stored.result);
        if (stored.options) setOptions(stored.options);
        const code = urlFundCode || stored.result.recommended_funds[0]?.fund_code || "";
        setSelectedFundCode(code);
      }
    }
  }, []); // run once on mount

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
        evidence_headlines: selectedHotspot?.evidence_headlines?.map((h) => h.title) ?? [],
      });
      setResult(response);
      const firstCode = response.recommended_funds[0]?.fund_code ?? "";
      setSelectedFundCode(firstCode);
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

  function handleBackToPre() {
    setSearchParams({}, { replace: true });
    setResult(null);
    setSelectedFundCode("");
    clearStorage();
  }

  const selectedHotspot = todayHotspots.find((item) => item.name === hotspot);
  const updatedTime = hotspotsUpdatedAt
    ? new Date(hotspotsUpdatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  // Persist campaign data to sessionStorage so FundDetailPage survives refresh
  useEffect(() => {
    if (result) {
      saveToStorage({ result, options, selectedHotspot, riskPreference });
    }
  }, [result, options, selectedHotspot, riskPreference]);

  const showResult = view === "result" && result !== null;

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
            {showResult && (
              <button
                type="button"
                onClick={handleBackToPre}
                className="w-full rounded-md border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
              >
                ← 返回分析前
              </button>
            )}
          </div>
        </aside>

        <section className="p-4 md:p-6">
          <header className="mb-5 flex flex-col justify-between gap-4 border-b pb-5 lg:flex-row lg:items-end">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-normal">
                {showResult ? "分析结果" : "基金热点选品与渠道支持"}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {showResult
                  ? `${result.hotspot_analysis.hotspot} · ${result.channel_strategy.channel} · ${riskPreference} · 候选 ${result.recommended_funds.length} 只`
                  : "基于公开行情、热点新闻和本地基金池，生成候选基金、渠道文案和合规检查结果。"}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-6 text-right text-sm">
              <HeaderMetric label="基金池" value={fundStatus?.total_count ? fundStatus.total_count.toLocaleString("zh-CN") : "--"} />
              <HeaderMetric label="存储" value={fundStatus?.storage || "SQLite"} />
              <HeaderMetric label="热点更新" value={updatedTime} />
            </div>
          </header>

          {!showResult && (
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

          {showResult && (
            <CampaignContext.Provider
              value={{
                result,
                options,
                selectedHotspot,
                riskPreference,
              }}
            >
              <div className="space-y-8">
                <FundRankingTable
                  funds={result.recommended_funds}
                  selectedFundCode={selectedFund?.fund_code ?? ""}
                  onSelect={handleFundSelect}
                />

                <HotspotAnalysisSection response={result} selectedHotspot={selectedHotspot} />

                <ReviewActions result={result} />
              </div>
            </CampaignContext.Provider>
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
  const h = response.hotspot_analysis;

  if (h.insufficient_data) {
    return (
      <section>
        <div className="mb-3 flex items-center gap-2">
          <LineChart size={17} className="text-muted-foreground" />
          <h2 className="text-base font-semibold">热点主题分析</h2>
          <span className="text-xs text-muted-foreground">AI 生成 · 需人工复核</span>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm leading-6 text-amber-900">
            当前新闻数据不足，无法生成完整的结构化分析。建议人工补充相关新闻和市场数据后重新分析。
          </p>
          {h.summary && <p className="mt-2 text-sm leading-6 text-amber-800">{h.summary}</p>}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <LineChart size={17} className="text-muted-foreground" />
        <h2 className="text-base font-semibold">热点主题分析</h2>
        <span className="text-xs text-muted-foreground">AI 生成 · 需人工复核</span>
      </div>

      <div className="space-y-5 rounded-md border p-5">
        {/* Summary */}
        <p className="text-sm leading-6">{h.summary}</p>

        {/* Core Drivers */}
        {h.core_drivers.length > 0 && (
          <div>
            <div className="mb-3 text-sm font-medium">核心驱动因素</div>
            <div className="space-y-3">
              {h.core_drivers.map((d, i) => (
                <div key={d.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-medium">{d.title}</div>
                    <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{d.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Industry Chain */}
        {h.industry_chain && (h.industry_chain.upstream.length > 0 || h.industry_chain.midstream.length > 0 || h.industry_chain.downstream.length > 0) && (
          <div>
            <div className="mb-3 text-sm font-medium">产业链影响</div>
            <div className="grid gap-2 text-sm">
              {h.industry_chain.upstream.length > 0 && (
                <div className="flex gap-3">
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">上游</span>
                  <span>{h.industry_chain.upstream.join(" / ")}</span>
                </div>
              )}
              {h.industry_chain.midstream.length > 0 && (
                <div className="flex gap-3">
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">中游</span>
                  <span>{h.industry_chain.midstream.join(" / ")}</span>
                </div>
              )}
              {h.industry_chain.downstream.length > 0 && (
                <div className="flex gap-3">
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">下游</span>
                  <span>{h.industry_chain.downstream.join(" / ")}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Opportunities & Risks — side-by-side cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="mb-3 text-sm font-medium text-emerald-950">机会</div>
            <div className="space-y-3">
              {h.opportunities.length === 0 && <p className="text-sm text-emerald-800">暂无数据。</p>}
              {h.opportunities.map((o) => (
                <div key={o.title}>
                  <div className="text-sm font-medium text-emerald-900">{o.title}</div>
                  <p className="mt-0.5 text-sm leading-6 text-emerald-800">{o.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50/50 p-4">
            <div className="mb-3 text-sm font-medium text-amber-950">风险</div>
            <div className="space-y-3">
              {h.risks.length === 0 && <p className="text-sm text-amber-800">暂无数据。</p>}
              {h.risks.map((r) => (
                <div key={r.title}>
                  <div className="text-sm font-medium text-amber-900">{r.title}</div>
                  <p className="mt-0.5 text-sm leading-6 text-amber-800">{r.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related Fund Directions */}
        {h.related_fund_directions.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">相关基金方向</div>
            <div className="flex flex-wrap gap-1.5">
              {h.related_fund_directions.map((d) => (
                <Badge key={d}>{d}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tags — quick reference */}
        <div className="flex flex-wrap gap-3 border-t pt-4 text-xs text-muted-foreground">
          {h.themes.length > 0 && <span>主题：{h.themes.join(" · ")}</span>}
          {h.industries.length > 0 && <span>行业：{h.industries.join(" · ")}</span>}
          {h.keywords.length > 0 && <span>关键词：{h.keywords.join(" · ")}</span>}
        </div>

        {/* Evidence — DeepSeek cited + RSS original */}
        {(h.evidence_headlines.length > 0 || (selectedHotspot?.evidence_headlines?.length ?? 0) > 0) && (
          <div className="border-t pt-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">来源依据</div>
            <div className="space-y-1">
              {h.evidence_headlines.slice(0, 5).map((title, i) => (
                <p key={`ds-${i}`} className="text-xs leading-5 text-muted-foreground">{title}</p>
              ))}
              {selectedHotspot?.evidence_headlines
                ?.filter((headline) => !h.evidence_headlines.some((ds) => ds.includes(headline.title.slice(0, 10))))
                .slice(0, 3)
                .map((headline) => (
                  <p key={`${headline.source}-${headline.title}`} className="text-xs leading-5 text-muted-foreground">
                    {headline.source}：{headline.title}
                  </p>
                ))}
            </div>
          </div>
        )}

        {/* Compliance Note */}
        {h.compliance_note && (
          <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">{h.compliance_note}</p>
        )}
      </div>
    </section>
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
