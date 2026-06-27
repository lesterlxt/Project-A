import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileSearch,
  ShieldCheck,
  Star,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChannelFitPanel } from "../components/ChannelFitPanel";
import { FundEvidencePanel } from "../components/FundEvidencePanel";
import { MarketingCopyPanel } from "../components/MarketingCopyPanel";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { SourceBadge } from "../components/SourceBadge";
import { useCampaignContext } from "../context/CampaignContext";
import { cn } from "../lib/utils";

export function FundDetailPage() {
  const { fundCode } = useParams<{ fundCode: string }>();
  const navigate = useNavigate();
  const { result, options, selectedHotspot, riskPreference } =
    useCampaignContext();
  const [showEvidence, setShowEvidence] = useState(false);

  const fund = useMemo(() => {
    if (!result || !fundCode) return null;
    return (
      result.recommended_funds.find(
        (f) => f.fund_code === fundCode,
      ) ?? null
    );
  }, [result, fundCode]);

  if (!result || !fund) {
    return (
      <main className="min-h-screen bg-background p-6">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft size={16} />
          返回结果列表
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <FileSearch size={40} className="text-muted-foreground/40" />
            <p className="text-body text-muted-foreground">
              未找到该基金的详情数据，请从结果列表重新进入。
            </p>
            <Button variant="outline" onClick={() => navigate("/?tab=result")}>
              返回结果列表
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { hotspot_analysis, channel_strategy, marketing_copy, compliance } =
    result;
  const industryEntries = Object.entries(fund.industry_allocation);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* ── Back navigation ── */}
        <Button
          variant="ghost"
          onClick={() =>
            navigate(`/?tab=result&fund=${fundCode}`)
          }
          className="mb-6"
        >
          <ArrowLeft size={16} />
          返回结果列表
        </Button>

        {/* ═══════════════════════════════════════
           ① Product Hero
           ═══════════════════════════════════════ */}
        <section className="mb-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-hero tracking-tight">
                {fund.fund_name}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
                <span className="font-mono">{fund.fund_code}</span>
                <Separator
                  orientation="vertical"
                  className="h-3.5"
                />
                <span>{fund.fund_type}</span>
                <Separator
                  orientation="vertical"
                  className="h-3.5"
                />
                <span>{fund.compare_group}</span>
                {fund.manager && fund.manager !== "未知" && (
                  <>
                    <Separator
                      orientation="vertical"
                      className="h-3.5"
                    />
                    <span>{fund.manager}</span>
                  </>
                )}
                <Separator
                  orientation="vertical"
                  className="h-3.5"
                />
                <RiskBadge level={fund.risk_level} />
              </p>
            </div>

            {/* Score badge */}
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex flex-col items-center rounded-xl bg-primary-subtle px-5 py-3">
                <span className="text-micro text-muted-foreground">
                  综合匹配
                </span>
                <span className="text-data text-primary">
                  {fund.score.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Key metrics bar */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MetricCard
              icon={<Star size={15} className="text-gold" />}
              label="同组排名"
              value={
                fund.category_rank > 0
                  ? `#${fund.category_rank}/${fund.category_total}`
                  : "--"
              }
            />
            <MetricCard
              label="数据质量"
              value={`${fund.data_quality_score.toFixed(0)}/100`}
              trend={
                fund.data_quality_score >= 80
                  ? "good"
                  : fund.data_quality_score >= 60
                    ? "ok"
                    : "low"
              }
            />
            {fund.one_year_return !== null && (
              <MetricCard
                label="近1年收益"
                value={`${fund.one_year_return >= 0 ? "+" : ""}${fund.one_year_return.toFixed(2)}%`}
                trend={
                  fund.one_year_return >= 0 ? "up" : "down"
                }
              />
            )}
            {fund.volatility !== null && (
              <MetricCard
                label="波动率"
                value={`${fund.volatility.toFixed(1)}%`}
              />
            )}
            <MetricCard
              label="行业来源"
              value={
                fund.field_sources.industry_allocation ===
                "mapped_from_holding_weight"
                  ? "持仓权重"
                  : fund.field_sources.industry_allocation ===
                      "holding_count_fallback"
                    ? "数量聚合"
                    : "推导"
              }
            />
          </div>

          {/* Tags */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {fund.matched_tags.map((tag) => (
              <Badge key={tag} variant="info" size="sm">
                {tag}
              </Badge>
            ))}
            <span className="ml-1 text-caption text-muted-foreground">
              · 行业：
              {industryEntries.length
                ? industryEntries
                    .slice(0, 4)
                    .map(([k]) => k)
                    .join("、")
                : "暂无数据"}
            </span>
          </div>
        </section>

        {/* ═══════════════════════════════════════
           ② Channel Marketing (Core)
           ═══════════════════════════════════════ */}
        <MarketingCopyPanel
          copy={marketing_copy}
          strategy={channel_strategy}
        />

        {/* ═══════════════════════════════════════
           ③ Channel Fit Analysis
           ═══════════════════════════════════════ */}
        <div className="mt-10">
          <ChannelFitPanel
            fund={fund}
            channel={channel_strategy}
            hotspot={hotspot_analysis}
            riskPreference={riskPreference}
          />
        </div>

        {/* ═══════════════════════════════════════
           ④ Suitability & Compliance
           ═══════════════════════════════════════ */}
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            <h2 className="text-h1">适当性与合规</h2>
            {compliance.passed ? (
              <Badge variant="success" size="sm">
                基础合规通过
              </Badge>
            ) : (
              <Badge variant="warning" size="sm">
                有合规提醒
              </Badge>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <h3 className="text-micro font-medium text-muted-foreground">
                  适合客户
                </h3>
                <p className="mt-1.5 text-body leading-relaxed">
                  {fund.suitable_clients}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="text-micro font-medium text-muted-foreground">
                  不适合客户
                </h3>
                <p className="mt-1.5 text-body leading-relaxed">
                  {fund.unsuitable_clients}
                </p>
              </CardContent>
            </Card>
            <Card className="sm:col-span-2">
              <CardContent className="p-4">
                <h3 className="text-micro font-medium text-muted-foreground">
                  风险提示
                </h3>
                <p className="mt-1.5 text-body leading-relaxed">
                  {fund.risk_warning}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Compliance scan hits */}
          {compliance.issues.length > 0 && (
            <div className="mt-4 rounded-lg border border-danger/30 bg-danger-subtle p-4">
              <h3 className="mb-2 text-caption font-semibold text-danger">
                合规扫描命中
              </h3>
              <ul className="space-y-1">
                {compliance.issues.map((issue, index) => (
                  <li
                    key={index}
                    className="text-caption text-danger/80"
                  >
                    · {issue.term}：{issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {compliance.suggestions.length > 0 && (
            <div className="mt-3 rounded-lg border border-warning/30 bg-warning-subtle p-4">
              <h3 className="mb-2 text-caption font-semibold text-warning">
                审核建议
              </h3>
              <ul className="space-y-1">
                {compliance.suggestions.map(
                  (suggestion, index) => (
                    <li
                      key={index}
                      className="text-caption text-warning/80"
                    >
                      · {suggestion}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════
           ⑤ Technical Evidence (Collapsible)
           ═══════════════════════════════════════ */}
        <section className="mt-10">
          <button
            type="button"
            onClick={() => setShowEvidence(!showEvidence)}
            className="group flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted group-hover:bg-primary-subtle transition-colors">
                <FileSearch
                  size={17}
                  className="text-muted-foreground group-hover:text-primary transition-colors"
                />
              </div>
              <div>
                <p className="text-h3">初筛技术依据</p>
                <p className="text-micro text-muted-foreground">
                  评分拆解、持仓证据、解释证据链
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SourceBadge
                source={fund.field_sources.reason}
              />
              {showEvidence ? (
                <ChevronUp size={18} className="text-muted-foreground" />
              ) : (
                <ChevronDown size={18} className="text-muted-foreground" />
              )}
            </div>
          </button>

          {showEvidence && (
            <div className="mt-4 animate-fade-in">
              <FundEvidencePanel
                fund={fund}
                scoringModel={options?.scoring_model ?? []}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* ── Risk Badge ── */
function RiskBadge({ level }: { level: string }) {
  const riskNum = parseInt(level.replace("R", "")) || 3;
  const color =
    riskNum <= 2
      ? "bg-risk-low-bg text-risk-low"
      : riskNum === 3
        ? "bg-risk-mid-bg text-risk-mid"
        : "bg-risk-high-bg text-risk-high";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-micro font-semibold",
        color,
      )}
    >
      风险 {level}
    </span>
  );
}

/* ── Metric Card ── */
function MetricCard({
  icon,
  label,
  value,
  trend,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  trend?: "up" | "down" | "good" | "ok" | "low";
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3.5 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-micro text-muted-foreground">
        {icon}
        {label}
      </div>
      <span
        className={cn(
          "text-h3 font-semibold tabular-nums",
          trend === "up" && "text-market-up",
          trend === "down" && "text-market-down",
          trend === "good" && "text-success",
          trend === "low" && "text-warning",
        )}
      >
        {value}
      </span>
    </div>
  );
}
