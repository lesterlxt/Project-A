import { ArrowLeft, ChevronDown, ChevronUp, FileSearch, ShieldCheck, Star, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChannelFitPanel } from "../components/ChannelFitPanel";
import { FundEvidencePanel } from "../components/FundEvidencePanel";
import { MarketingCopyPanel } from "../components/MarketingCopyPanel";
import { Badge } from "../components/ui/badge";
import { SourceBadge } from "../components/SourceBadge";
import { useCampaignContext } from "../context/CampaignContext";

export function FundDetailPage() {
  const { fundCode } = useParams<{ fundCode: string }>();
  const navigate = useNavigate();
  const { result, options, selectedHotspot, riskPreference } = useCampaignContext();
  const [showEvidence, setShowEvidence] = useState(false);

  const fund = useMemo(() => {
    if (!result || !fundCode) return null;
    return result.recommended_funds.find((f) => f.fund_code === fundCode) ?? null;
  }, [result, fundCode]);

  if (!result || !fund) {
    return (
      <main className="min-h-screen bg-white p-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          返回结果列表
        </button>
        <div className="rounded-md border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">未找到该基金的详情数据，请从结果列表重新进入。</p>
        </div>
      </main>
    );
  }

  const { hotspot_analysis, channel_strategy, marketing_copy, compliance } = result;
  const industryEntries = Object.entries(fund.industry_allocation);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        {/* ── Back navigation ── */}
        <button
          type="button"
          onClick={() => navigate(`/?tab=result&fund=${fundCode}`)}
          className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          返回结果列表
        </button>

        {/* ═══════════════════════════════════════
           ① 产品概要
           ═══════════════════════════════════════ */}
        <section className="mb-8">
          <h1 className="text-2xl font-semibold tracking-normal">{fund.fund_name}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {fund.fund_code} · {fund.fund_type} · {fund.compare_group}
            {fund.manager && fund.manager !== "未知" ? ` · ${fund.manager}` : ""}
            {" · "}风险 {fund.risk_level}
          </p>

          {/* Key metrics bar */}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3">
            <MetricChip
              label="综合匹配"
              value={fund.score.toFixed(1)}
              icon={<Star size={15} className="text-primary" />}
            />
            <MetricChip
              label="同组排名"
              value={`${fund.category_rank}/${fund.category_total}`}
            />
            <MetricChip
              label="数据质量"
              value={`${fund.data_quality_score.toFixed(0)}/100`}
            />
            {fund.one_year_return !== null && (
              <MetricChip
                label="近1年收益"
                value={`${fund.one_year_return > 0 ? "+" : ""}${fund.one_year_return.toFixed(2)}%`}
                trend={fund.one_year_return >= 0 ? "up" : "down"}
              />
            )}
            {fund.volatility !== null && (
              <MetricChip label="波动率" value={`${fund.volatility.toFixed(1)}%`} />
            )}
            <SourceBadge source={fund.field_sources.industry_allocation} />
          </div>

          {/* Hotspot match summary */}
          {fund.matched_tags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">关联热点：</span>
              {fund.matched_tags.map((tag) => (
                <Badge key={tag} variant="muted">{tag}</Badge>
              ))}
              <span className="ml-1 text-muted-foreground">
                · 行业：{industryEntries.length
                  ? industryEntries.slice(0, 4).map(([k]) => k).join("、")
                  : "暂无数据"}
              </span>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════
           ② 渠道营销方案（核心板块）
           ═══════════════════════════════════════ */}
        <MarketingCopyPanel copy={marketing_copy} strategy={channel_strategy} />

        {/* ═══════════════════════════════════════
           ③ 渠道适配分析（新增）
           ═══════════════════════════════════════ */}
        <div className="mt-8">
          <ChannelFitPanel
            fund={fund}
            channel={channel_strategy}
            hotspot={hotspot_analysis}
            riskPreference={riskPreference}
          />
        </div>

        {/* ═══════════════════════════════════════
           ④ 适当性与合规
           ═══════════════════════════════════════ */}
        <section className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={18} className="text-muted-foreground" />
            <h2 className="text-lg font-semibold">适当性与合规</h2>
            {compliance.passed ? (
              <Badge variant="success">基础合规通过</Badge>
            ) : (
              <Badge variant="warning">有合规提醒</Badge>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="mb-1.5 text-sm font-medium">适合客户</div>
              <p className="text-sm leading-relaxed text-muted-foreground">{fund.suitable_clients}</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-1.5 text-sm font-medium">不适合客户</div>
              <p className="text-sm leading-relaxed text-muted-foreground">{fund.unsuitable_clients}</p>
            </div>
            <div className="rounded-lg border p-4 sm:col-span-2">
              <div className="mb-1.5 text-sm font-medium">风险提示</div>
              <p className="text-sm leading-relaxed text-muted-foreground">{fund.risk_warning}</p>
            </div>
          </div>

          {/* Compliance check results */}
          {compliance.issues.length > 0 && (
            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="mb-2 text-sm font-medium text-destructive">合规扫描命中</div>
              <ul className="space-y-1">
                {compliance.issues.map((issue, index) => (
                  <li key={index} className="text-sm text-destructive/80">
                    · {issue.term}：{issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {compliance.suggestions.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="mb-1.5 text-sm font-medium text-amber-800">审核建议</div>
              <ul className="space-y-1">
                {compliance.suggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-amber-700">· {suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════
           ⑤ 技术依据（默认折叠）
           ═══════════════════════════════════════ */}
        <section className="mt-8">
          <button
            type="button"
            onClick={() => setShowEvidence(!showEvidence)}
            className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <FileSearch size={17} className="text-muted-foreground" />
              <span className="text-base font-semibold">初筛技术依据</span>
              <span className="text-xs text-muted-foreground">
                评分拆解、持仓证据、解释证据链
              </span>
            </div>
            {showEvidence ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {showEvidence && (
            <div className="mt-4">
              <FundEvidencePanel fund={fund} scoringModel={options?.scoring_model ?? []} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricChip({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  trend?: "up" | "down";
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {icon}
      <span
        className={`font-semibold tabular-nums ${
          trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
