import {
  BarChart3,
  Database,
  ExternalLink,
  LineChart,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AgentEvent,
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
  runCampaignStream,
  syncRealFunds,
} from "../api/campaignApi";
import { AgentPipelineStatus } from "../components/AgentPipelineStatus";
import { ControlPanel } from "../components/ControlPanel";
import { FundPoolStatusCard } from "../components/FundPoolStatusCard";
import { FundRankingTable } from "../components/FundRankingTable";
import { PreAnalysisDashboard } from "../components/PreAnalysisDashboard";
import { ReviewActions } from "../components/ReviewActions";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import {
  CampaignContext,
  clearStorage,
  loadFromStorage,
  saveToStorage,
} from "../context/CampaignContext";

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
  const [fundSummary, setFundSummary] =
    useState<FundPoolSummary | null>(null);
  const [marketOverview, setMarketOverview] =
    useState<MarketOverviewResponse | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [efundSupermarket, setEfundSupermarket] =
    useState<EFundSupermarketResponse | null>(null);
  const [efundLoading, setEfundLoading] = useState(false);
  const [efundError, setEfundError] = useState("");
  const [options, setOptions] = useState<AppOptions | null>(null);
  const [fundSyncing, setFundSyncing] = useState(false);
  const [fundSyncMessage, setFundSyncMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [pipelineEvents, setPipelineEvents] = useState<AgentEvent[]>([]);

  // Sync URL fund param → state
  useEffect(() => {
    if (view === "result" && urlFundCode && result) {
      const exists = result.recommended_funds.some(
        (f) => f.fund_code === urlFundCode,
      );
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
        setMarketError(
          err instanceof Error ? err.message : "市场数据暂不可用",
        );
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
        setEfundError(
          err instanceof Error
            ? err.message
            : "易方达基金超市数据暂不可用",
        );
      })
      .finally(() => {
        if (active) setEfundLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Restore from sessionStorage
  useEffect(() => {
    if (!result && view === "result") {
      const stored = loadFromStorage();
      if (stored?.result) {
        setResult(stored.result);
        if (stored.options) setOptions(stored.options);
        const code =
          urlFundCode ||
          stored.result.recommended_funds[0]?.fund_code ||
          "";
        setSelectedFundCode(code);
      }
    }
  }, []);

  const selectedFund = useMemo<RecommendedFund | null>(() => {
    if (!result) return null;
    return (
      result.recommended_funds.find(
        (fund) => fund.fund_code === selectedFundCode,
      ) ??
      result.recommended_funds[0] ??
      null
    );
  }, [result, selectedFundCode]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setPipelineEvents([]);
    setResult(null);

    runCampaignStream(
      {
        hotspot,
        channel,
        risk_preference: riskPreference,
        fund_type_filter: fundTypeFilter,
        top_k: topK,
        evidence_headlines:
          selectedHotspot?.evidence_headlines?.map((h) => h.title) ?? [],
      },
      // onEvent
      (event) => {
        setPipelineEvents((prev) => [...prev, event]);
      },
      // onComplete
      (response) => {
        setResult(response);
        setLoading(false);
        const firstCode =
          response.recommended_funds[0]?.fund_code ?? "";
        setSelectedFundCode(firstCode);
      },
      // onError
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
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
      setFundSyncMessage(
        `已同步 ${response.synced_count} 只基金。`,
      );
      const status = await fetchFundPoolStatus();
      setFundStatus(status);
      const summary = await fetchFundPoolSummary();
      setFundSummary(summary);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "基金池同步失败",
      );
    } finally {
      setFundSyncing(false);
    }
  }

  function handleBackToPre() {
    setSearchParams({}, { replace: true });
    setResult(null);
    setSelectedFundCode("");
    setPipelineEvents([]);
    clearStorage();
  }

  const selectedHotspot = todayHotspots.find(
    (item) => item.name === hotspot,
  );
  const updatedTime = hotspotsUpdatedAt
    ? new Date(hotspotsUpdatedAt).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";

  useEffect(() => {
    if (result) {
      saveToStorage({
        result,
        options,
        selectedHotspot,
        riskPreference,
      });
    }
  }, [result, options, selectedHotspot, riskPreference]);

  const showResult = view === "result" && result !== null;

  return (
    <main className="min-h-screen bg-background">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* ═══════════════════════════════════════
           Sidebar
           ═══════════════════════════════════════ */}
        <aside className="border-r border-border bg-card xl:sticky xl:top-0 xl:h-screen xl:overflow-y-auto">
          {/* Brand header */}
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
                <TrendingUp size={18} className="text-primary-foreground" />
              </div>
              <div>
                <div className="text-h2 tracking-tight">Project A</div>
                <div className="text-micro text-muted-foreground">
                  基金热点选品与营销工作台
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar content */}
          <div className="space-y-4 p-4">
            <ControlPanel
              hotspot={hotspot}
              channel={channel}
              riskPreference={riskPreference}
              fundTypeFilter={fundTypeFilter}
              topK={topK}
              channels={
                options?.channels ?? [
                  "招商银行",
                  "工商银行",
                  "建设银行",
                  "农业银行",
                ]
              }
              riskPreferences={
                options?.risk_preferences ?? [
                  "稳健型",
                  "平衡型",
                  "进取型",
                ]
              }
              fundTypes={
                options?.fund_type_filters ?? [
                  "全部",
                  "权益",
                  "指数",
                  "ETF联接",
                  "固收+",
                  "红利低波",
                ]
              }
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

            <AgentPipelineStatus
              events={pipelineEvents}
              hasResult={Boolean(result)}
              loading={loading}
            />

            {showResult && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleBackToPre}
                className="w-full justify-start"
              >
                ← 返回分析前配置
              </Button>
            )}
          </div>
        </aside>

        {/* ═══════════════════════════════════════
           Main Content
           ═══════════════════════════════════════ */}
        <section className="p-6 lg:p-8">
          {/* ── Header ── */}
          <header className="mb-8 flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-2">
              <h1 className="text-hero tracking-tight text-foreground">
                {showResult
                  ? "分析结果"
                  : "基金热点选品与渠道支持"}
              </h1>
              <p className="max-w-3xl text-body text-muted-foreground">
                {showResult
                  ? `${result.hotspot_analysis.hotspot} · ${result.channel_strategy.channel} · ${riskPreference} · 候选 ${result.recommended_funds.length} 只`
                  : "基于公开行情、热点新闻和本地基金池，生成候选基金、渠道文案和合规检查结果。"}
              </p>
            </div>

            {/* Key metrics */}
            <div className="flex items-center gap-4">
              <HeaderMetric
                icon={<Database size={14} />}
                label="基金池"
                value={
                  fundStatus?.total_count
                    ? fundStatus.total_count.toLocaleString(
                        "zh-CN",
                      )
                    : "--"
                }
              />
              <Separator orientation="vertical" className="h-8" />
              <HeaderMetric
                icon={<BarChart3 size={14} />}
                label="存储"
                value={fundStatus?.storage || "SQLite"}
              />
              <Separator orientation="vertical" className="h-8" />
              <HeaderMetric
                icon={<RefreshCw size={14} />}
                label="热点更新"
                value={updatedTime}
              />
            </div>
          </header>

          {/* ── Pre-Analysis View ── */}
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

          {/* ── Result View ── */}
          {showResult && (
            <CampaignContext.Provider
              value={{
                result,
                options,
                selectedHotspot,
                riskPreference,
              }}
            >
              <div className="animate-fade-in space-y-8">
                <FundRankingTable
                  funds={result.recommended_funds}
                  selectedFundCode={selectedFund?.fund_code ?? ""}
                  onSelect={handleFundSelect}
                />

                <HotspotAnalysisSection
                  response={result}
                  selectedHotspot={selectedHotspot}
                />

                <ReviewActions result={result} />
              </div>
            </CampaignContext.Provider>
          )}
        </section>
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════
   Hotspot Analysis Section
   ═══════════════════════════════════════ */
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
          <h2 className="text-h1">热点主题分析</h2>
          <Badge variant="warning" size="sm">
            数据不足
          </Badge>
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning-subtle p-5">
          <p className="text-body leading-relaxed text-warning">
            当前新闻数据不足，无法生成完整的结构化分析。建议人工补充相关新闻和市场数据后重新分析。
          </p>
          {h.summary && (
            <p className="mt-2 text-caption text-warning/80">
              {h.summary}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <LineChart size={18} className="text-primary" />
        <h2 className="text-h1">热点主题分析</h2>
        <Badge variant="info" size="sm">
          AI 生成 · 需人工复核
        </Badge>
      </div>

      <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-xs">
        {/* Summary */}
        <p className="text-body leading-relaxed">{h.summary}</p>

        {/* Core Drivers */}
        {h.core_drivers.length > 0 && (
          <div>
            <h3 className="mb-3 text-h3">核心驱动因素</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {h.core_drivers.map((d, i) => (
                <div
                  key={d.title}
                  className="flex gap-3 rounded-lg border border-border bg-background p-4"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-micro font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-body font-semibold">{d.title}</p>
                    <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">
                      {d.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Industry Chain */}
        {h.industry_chain &&
          (h.industry_chain.upstream.length > 0 ||
            h.industry_chain.midstream.length > 0 ||
            h.industry_chain.downstream.length > 0) && (
            <div>
              <h3 className="mb-3 text-h3">产业链影响</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {h.industry_chain.upstream.length > 0 && (
                  <div className="rounded-lg border border-border bg-background p-4">
                    <span className="text-micro font-medium text-muted-foreground">
                      上游
                    </span>
                    <p className="mt-1 text-caption font-medium">
                      {h.industry_chain.upstream.join(" / ")}
                    </p>
                  </div>
                )}
                {h.industry_chain.midstream.length > 0 && (
                  <div className="rounded-lg border border-border bg-background p-4">
                    <span className="text-micro font-medium text-muted-foreground">
                      中游
                    </span>
                    <p className="mt-1 text-caption font-medium">
                      {h.industry_chain.midstream.join(" / ")}
                    </p>
                  </div>
                )}
                {h.industry_chain.downstream.length > 0 && (
                  <div className="rounded-lg border border-border bg-background p-4">
                    <span className="text-micro font-medium text-muted-foreground">
                      下游
                    </span>
                    <p className="mt-1 text-caption font-medium">
                      {h.industry_chain.downstream.join(
                        " / ",
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Opportunities & Risks */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-success/30 bg-success-subtle p-4">
            <h3 className="mb-3 text-h3 text-success">机会</h3>
            <div className="space-y-3">
              {h.opportunities.length === 0 && (
                <p className="text-caption text-success/70">
                  暂无数据。
                </p>
              )}
              {h.opportunities.map((o) => (
                <div key={o.title}>
                  <p className="text-body font-semibold text-success">
                    {o.title}
                  </p>
                  <p className="mt-0.5 text-caption leading-relaxed text-success/80">
                    {o.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-warning/30 bg-warning-subtle p-4">
            <h3 className="mb-3 text-h3 text-warning">风险</h3>
            <div className="space-y-3">
              {h.risks.length === 0 && (
                <p className="text-caption text-warning/70">
                  暂无数据。
                </p>
              )}
              {h.risks.map((r) => (
                <div key={r.title}>
                  <p className="text-body font-semibold text-warning">
                    {r.title}
                  </p>
                  <p className="mt-0.5 text-caption leading-relaxed text-warning/80">
                    {r.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related Fund Directions */}
        {h.related_fund_directions.length > 0 && (
          <div>
            <h3 className="mb-2 text-h3">相关基金方向</h3>
            <div className="flex flex-wrap gap-1.5">
              {h.related_fund_directions.map((d) => (
                <Badge key={d} variant="gold" size="lg">
                  {d}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-caption text-muted-foreground">
          {h.themes.length > 0 && (
            <span>
              主题：{h.themes.join(" · ")}
            </span>
          )}
          {h.industries.length > 0 && (
            <span>
              行业：{h.industries.join(" · ")}
            </span>
          )}
          {h.keywords.length > 0 && (
            <span>
              关键词：{h.keywords.join(" · ")}
            </span>
          )}
        </div>

        {/* Evidence */}
        {(h.evidence_headlines.length > 0 ||
          (selectedHotspot?.evidence_headlines?.length ?? 0) >
            0) && (
          <div className="border-t border-border pt-4">
            <h3 className="mb-2 text-micro font-medium text-muted-foreground">
              来源依据
            </h3>
            <div className="space-y-1">
              {h.evidence_headlines
                .slice(0, 5)
                .map((title, i) => (
                  <p
                    key={`ds-${i}`}
                    className="text-micro leading-relaxed text-muted-foreground"
                  >
                    {title}
                  </p>
                ))}
              {selectedHotspot?.evidence_headlines
                ?.filter(
                  (headline) =>
                    !h.evidence_headlines.some((ds) =>
                      ds.includes(headline.title.slice(0, 10)),
                    ),
                )
                .slice(0, 3)
                .map((headline) => (
                  <p
                    key={`${headline.source}-${headline.title}`}
                    className="text-micro leading-relaxed text-muted-foreground"
                  >
                    {headline.source}：{headline.title}
                  </p>
                ))}
            </div>
          </div>
        )}

        {/* Compliance Note */}
        {h.compliance_note && (
          <p className="border-t border-border pt-4 text-micro leading-relaxed text-muted-foreground">
            {h.compliance_note}
          </p>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   Header Metric
   ═══════════════════════════════════════ */
function HeaderMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <div className="text-micro text-muted-foreground">{label}</div>
        <div className="text-caption font-semibold tabular-nums">
          {value}
        </div>
      </div>
    </div>
  );
}
