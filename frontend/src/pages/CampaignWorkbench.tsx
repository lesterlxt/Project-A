import { AlertTriangle, BarChart3, CheckCircle2, FileText, LineChart, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CampaignResponse, RecommendedFund, TodayHotspot, fetchTodayHotspots, runCampaign, syncRealFunds } from "../api/campaignApi";
import { CompliancePanel } from "../components/CompliancePanel";
import { FundRankingTable } from "../components/FundRankingTable";
import { MarketingCopyPanel } from "../components/MarketingCopyPanel";
import { ScoreBreakdown } from "../components/ScoreBreakdown";

const channels = ["招商银行", "工商银行", "建设银行", "农业银行"];
const riskPreferences = ["稳健型", "平衡型", "进取型"];
const fundTypes = ["全部", "权益", "指数", "ETF联接", "固收+", "红利低波"];
const trendBars = [54, 62, 58, 73, 78, 84, 89];

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
  const [fundSyncing, setFundSyncing] = useState(false);
  const [fundSyncMessage, setFundSyncMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let active = true;
    setHotspotsLoading(true);
    fetchTodayHotspots()
      .then((response) => {
        if (!active) return;
        setTodayHotspots(response.items);
        setHotspotsUpdatedAt(response.updated_at);
        if (response.items[0]) {
          setHotspot(response.items[0].name);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "热点获取失败");
      })
      .finally(() => {
        if (active) setHotspotsLoading(false);
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
      const response = await syncRealFunds();
      setFundSyncMessage(`已同步 ${response.synced_count} 只，增强 ${response.enriched_count} 只`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "基金池同步失败");
    } finally {
      setFundSyncing(false);
    }
  }

  const selectedHotspot = todayHotspots.find((item) => item.name === hotspot);
  const heatScore = selectedHotspot?.heat_score ?? (result ? Math.min(96, 68 + result.hotspot_analysis.themes.length * 4) : 0);
  const copyCount = result ? 4 : 0;
  const updatedTime = hotspotsUpdatedAt ? new Date(hotspotsUpdatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "--:--";

  return (
    <main className="app-shell">
      <aside className="control-panel">
        <div className="brand-row">
          <div className="brand-icon">
            <Sparkles size={18} />
          </div>
          <div>
            <h1>Project A</h1>
            <p>基金热点选品工作台</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>市场热点</span>
            <input value={hotspot} onChange={(event) => setHotspot(event.target.value)} />
          </label>

          <div className="hotspot-list">
            <div className="hotspot-list-header">
              <span>今日热点 Top 5</span>
              <small>{hotspotsLoading ? "加载中" : `更新 ${updatedTime}`}</small>
            </div>
            {todayHotspots.map((preset) => (
              <button
                type="button"
                key={preset.name}
                className={preset.name === hotspot ? "hotspot-button active" : "hotspot-button"}
                onClick={() => setHotspot(preset.name)}
              >
                <strong>{preset.name}</strong>
                <span>{preset.heat_score}</span>
              </button>
            ))}
            {!hotspotsLoading && todayHotspots.length === 0 && (
              <p className="hotspot-empty">未获取到真实热点，请检查网络或 DeepSeek 配置。</p>
            )}
          </div>

          <label className="field">
            <span>银行渠道</span>
            <select value={channel} onChange={(event) => setChannel(event.target.value)}>
              {channels.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>客户风险偏好</span>
            <select value={riskPreference} onChange={(event) => setRiskPreference(event.target.value)}>
              {riskPreferences.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>基金类型筛选</span>
            <select value={fundTypeFilter} onChange={(event) => setFundTypeFilter(event.target.value)}>
              {fundTypes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>推荐数量：{topK}</span>
            <input
              type="range"
              min="3"
              max="10"
              value={topK}
              onChange={(event) => setTopK(Number(event.target.value))}
            />
          </label>

          <button className="primary-action" disabled={loading || !hotspot.trim()}>
            {loading ? "分析中..." : "开始分析"}
          </button>
        </form>

        <div className="sync-panel">
          <button type="button" onClick={handleFundSync} disabled={fundSyncing}>
            {fundSyncing ? "同步中..." : "同步真实基金池"}
          </button>
          <p>{fundSyncMessage || "来源：天天基金 / 东方财富公开数据"}</p>
        </div>

        {error && (
          <div className="error-box">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
      </aside>

      <section className="workspace">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Bank Channel Advisor Dashboard</p>
            <h2>AI热点驱动的基金智能选品与营销生成平台</h2>
            <p>面向银行渠道销售的热点识别、基金匹配与营销内容生成 Agent</p>
          </div>
          <div className="header-actions">
            <span>今日市场热度 {heatScore || "--"}</span>
            <span>更新 {updatedTime}</span>
            <button type="button">生成报告</button>
          </div>
        </header>

        {!result && (
          <div className="empty-state">
            <BarChart3 size={36} />
            <h2>等待生成推荐结果</h2>
            <p>今日热点来自真实新闻源，经 DeepSeek 聚合后生成。</p>
          </div>
        )}

        {result && (
          <>
            <section className="kpi-grid">
              <div className="kpi-card">
                <span>今日热点热度分</span>
                <strong>{heatScore || "--"}</strong>
                <p>{result.hotspot_analysis.hotspot}</p>
              </div>
              <div className="kpi-card">
                <span>匹配基金数量</span>
                <strong>{result.recommended_funds.length}</strong>
                <p>当前筛选池</p>
              </div>
              <div className="kpi-card">
                <span>推荐渠道</span>
                <strong>{result.channel_strategy.channel}</strong>
                <p>{riskPreference}</p>
              </div>
              <div className="kpi-card">
                <span>生成文案数量</span>
                <strong>{copyCount}</strong>
                <p>话术 / 长文 / 社媒 / 风险提示</p>
              </div>
            </section>

            <section className="analysis-grid">
              <div className="section-block">
                <div className="section-title">
                  <Sparkles size={18} />
                  <h2>热点主题分析</h2>
                </div>
                <p className="summary-text">{result.hotspot_analysis.summary}</p>
                {selectedHotspot && <p className="source-text">热点来源：{selectedHotspot.source}；{selectedHotspot.summary}</p>}
                <div className="tag-row">
                  {result.hotspot_analysis.themes.map((theme) => (
                    <span key={theme} className="tag">{theme}</span>
                  ))}
                </div>
                <div className="evidence-grid compact">
                  <div>
                    <span>相关行业</span>
                    <p>{result.hotspot_analysis.industries.join(" / ")}</p>
                  </div>
                  <div>
                    <span>主要风险</span>
                    <p>{result.hotspot_analysis.risks[0]}</p>
                  </div>
                </div>
              </div>

              <div className="section-block">
                <div className="section-title">
                  <LineChart size={18} />
                  <h2>主题热度趋势</h2>
                </div>
                <div className="trend-chart">
                  {trendBars.map((value, index) => (
                    <div key={`${value}-${index}`} className="trend-column">
                      <div style={{ height: `${value}%` }} />
                      <span>D-{6 - index}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="section-block">
              <div className="section-title">
                <BarChart3 size={18} />
                <h2>推荐基金 Top {result.recommended_funds.length}</h2>
              </div>
              <FundRankingTable
                funds={result.recommended_funds}
                selectedFundCode={selectedFund?.fund_code ?? ""}
                onSelect={setSelectedFundCode}
              />
            </section>

            {selectedFund && (
              <section className="two-column">
                <div className="section-block">
                  <div className="section-title">
                    <CheckCircle2 size={18} />
                    <h2>分数拆解</h2>
                  </div>
                  <ScoreBreakdown fund={selectedFund} />
                </div>

                <div className="section-block">
                  <div className="section-title">
                    <FileText size={18} />
                    <h2>推荐解释</h2>
                  </div>
                  <div className="text-stack">
                    <p>{selectedFund.reason}</p>
                    <p>{selectedFund.risk_warning}</p>
                    <p>适合：{selectedFund.suitable_clients}</p>
                    <p>不适合：{selectedFund.unsuitable_clients}</p>
                  </div>
                </div>
              </section>
            )}

            <section className="two-column wide">
              <MarketingCopyPanel copy={result.marketing_copy} strategy={result.channel_strategy} />
              <CompliancePanel compliance={result.compliance} />
            </section>

            {selectedFund && (
              <section className="section-block">
                <div className="section-title">
                  <CheckCircle2 size={18} />
                  <h2>推荐依据拆解</h2>
                </div>
                <div className="evidence-grid">
                  <div>
                    <span>热点关键词</span>
                    <p>{result.hotspot_analysis.keywords.slice(0, 6).join(" / ")}</p>
                  </div>
                  <div>
                    <span>基金匹配标签</span>
                    <p>{selectedFund.matched_tags.join(" / ")}</p>
                  </div>
                  <div>
                    <span>渠道客户特征</span>
                    <p>{result.channel_strategy.client_profile.join(" / ")}</p>
                  </div>
                  <div>
                    <span>风险适配</span>
                    <p>{riskPreference}；{selectedFund.risk_warning}</p>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
