import { FileSearch } from "lucide-react";
import {
  RecommendedFund,
  ScoreFormula,
} from "../api/campaignApi";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Separator } from "./ui/separator";
import { SourceBadge } from "./SourceBadge";
import { cn } from "../lib/utils";

type Props = {
  fund: RecommendedFund;
  scoringModel: ScoreFormula[];
};

export function FundEvidencePanel({ fund, scoringModel }: Props) {
  const industries = Object.entries(fund.industry_allocation);
  const items = Object.entries(fund.score_breakdown);
  const formulaByKey = new Map(
    scoringModel.map((item) => [item.key, item]),
  );

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSearch
              size={17}
              className="text-primary"
            />
            <h2 className="text-h2">初筛依据与评分</h2>
          </div>
          <Badge
            variant={fund.is_enriched ? "success" : "warning"}
          >
            {fund.is_enriched ? "详情字段" : "基础字段"}
          </Badge>
        </div>

        {/* Key Metrics Row */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-caption">
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">候选状态</span>
            <span className="font-medium">
              {fund.is_eligible ? "已进入候选池" : "未进入候选池"}
            </span>
            <SourceBadge source="calculated" />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">数据质量</span>
            <span className="font-medium">
              {fund.data_quality_score.toFixed(0)}/100
            </span>
            <SourceBadge source="calculated" />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">缺失字段</span>
            <span className="font-medium">
              {fund.missing_fields.length} 个
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">比较分组</span>
            <span className="font-medium">
              {fund.compare_group}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">同组排名</span>
            <span className="font-medium">
              {fund.category_rank
                ? `${fund.category_rank}/${fund.category_total}`
                : "--"}
            </span>
          </span>
        </div>

        <Separator />

        {/* Fund Info Grid */}
        <div>
          <h3 className="mb-3 text-h3">基金信息</h3>
          <div className="grid gap-x-4 gap-y-2 text-caption sm:grid-cols-2 lg:grid-cols-4">
            <InfoRow
              label="代码"
              value={fund.fund_code}
              source={fund.field_sources.fund_code}
            />
            <InfoRow
              label="名称"
              value={fund.fund_name}
              source={fund.field_sources.fund_name}
            />
            <InfoRow
              label="类型"
              value={fund.fund_type}
              source={fund.field_sources.fund_type}
            />
            <InfoRow
              label="经理"
              value={fund.manager || "--"}
              source={fund.field_sources.manager}
            />
            <InfoRow
              label="风险等级"
              value={fund.risk_level}
              source={fund.field_sources.risk_level}
            />
            <InfoRow
              label="最新净值"
              value={fund.latest_nav || "--"}
              source={fund.field_sources.latest_nav}
            />
            <InfoRow
              label="近1年收益"
              value={formatPct(fund.one_year_return)}
              source={fund.field_sources.one_year_return}
            />
            <InfoRow
              label="波动率"
              value={formatPct(fund.volatility)}
              source={fund.field_sources.volatility}
            />
            <InfoRow
              label="最大回撤"
              value={formatPct(fund.max_drawdown)}
              source={fund.field_sources.max_drawdown}
            />
            {(fund as any).manager_tenure && (
              <InfoRow
                label="经理任期"
                value={(fund as any).manager_tenure}
                source={
                  fund.field_sources.manager_tenure ?? "missing"
                }
              />
            )}
            {(fund as any).fund_size && (
              <InfoRow
                label="基金规模"
                value={(fund as any).fund_size}
                source={
                  fund.field_sources.fund_size ?? "missing"
                }
              />
            )}
            {(fund as any).inception_date && (
              <InfoRow
                label="成立日期"
                value={(fund as any).inception_date}
                source={
                  fund.field_sources.inception_date ??
                  "missing"
                }
              />
            )}
            {(fund as any).management_fee && (
              <InfoRow
                label="管理费率"
                value={(fund as any).management_fee}
                source={
                  fund.field_sources.management_fee ??
                  "missing"
                }
              />
            )}
            {(fund as any).custody_fee && (
              <InfoRow
                label="托管费率"
                value={(fund as any).custody_fee}
                source={
                  fund.field_sources.custody_fee ?? "missing"
                }
              />
            )}
          </div>
        </div>

        <Separator />

        {/* Score Breakdown */}
        <div>
          <h3 className="mb-3 text-h3">分数拆解</h3>
          <div className="space-y-3">
            {items.map(([key, value]) => {
              const width = Math.min(
                Math.abs(value) * 2.6,
                100,
              );
              const formula = formulaByKey.get(key);
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-caption">
                    <span className="text-muted-foreground">
                      {formula?.label ?? key}
                    </span>
                    <strong className="tabular-nums">
                      {value}
                    </strong>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-all duration-500",
                        value < 0 ? "bg-danger" : "bg-primary",
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  {formula && (
                    <p className="text-micro leading-relaxed text-muted-foreground">
                      {formula.formula}。{formula.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Screening Reason */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-h3">初筛理由</h3>
            <SourceBadge source={fund.field_sources.reason} />
          </div>
          <p className="text-caption leading-relaxed text-muted-foreground">
            {fund.reason}
          </p>
        </div>

        {/* Exclusion Reasons */}
        {!fund.is_eligible && fund.exclusion_reasons.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-h3 text-danger">排除原因</h3>
              <SourceBadge
                source={
                  fund.field_sources.exclusion_reasons ??
                  "calculated"
                }
              />
            </div>
            <p className="text-caption leading-relaxed text-danger/80">
              {fund.exclusion_reasons.join(" / ")}
            </p>
          </div>
        )}

        {/* Missing Fields */}
        {fund.missing_fields.length > 0 && (
          <div>
            <h3 className="mb-2 text-h3">缺失字段</h3>
            <p className="text-caption text-muted-foreground">
              {fund.missing_fields.join(" / ")}
            </p>
          </div>
        )}

        {/* Positioning Tags */}
        <div>
          <h3 className="mb-2 text-h3">产品定位</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {fund.positioning.slice(0, 10).map((tag) => (
              <Badge key={tag} variant="muted" size="sm">
                {tag}
              </Badge>
            ))}
            <SourceBadge
              source={fund.field_sources.positioning}
            />
          </div>
        </div>

        <Separator />

        {/* Holdings & Industry */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-h3">持仓股票代码</h3>
              <SourceBadge
                source={fund.field_sources.top_holdings}
              />
            </div>
            <p className="text-caption leading-relaxed text-muted-foreground">
              {fund.top_holdings.slice(0, 10).join(" / ") ||
                "--"}
            </p>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-h3">行业配置</h3>
              <SourceBadge
                source={
                  fund.field_sources.industry_allocation ??
                  "missing"
                }
              />
            </div>
            <p className="text-caption leading-relaxed text-muted-foreground">
              {industries.length
                ? industries
                    .map(
                      ([name, value]) =>
                        `${name} ${value.toFixed(1)}%`,
                    )
                    .join(" / ")
                : "--"}
            </p>
            {fund.field_sources.industry_allocation ===
              "holding_count_fallback" && (
              <p className="mt-1 text-micro italic text-warning">
                当前行业暴露基于持仓股票数量聚合，非真实持仓权重。建议人工确认。
              </p>
            )}
          </div>
        </div>

        {/* Explanation Points */}
        {fund.explanation_points.length > 0 && (
          <div>
            <h3 className="mb-3 text-h3">解释证据链</h3>
            <div className="space-y-2">
              {fund.explanation_points.map((point) => (
                <div
                  key={`${point.label}-${point.text}`}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-caption font-semibold">
                      {point.label}
                    </h4>
                    <SourceBadge source={point.source} />
                  </div>
                  <p className="text-caption leading-relaxed text-muted-foreground">
                    {point.text}
                  </p>
                  <p className="mt-2 text-micro text-muted-foreground">
                    依据：{point.evidence_fields.join(" / ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({
  label,
  value,
  source,
}: {
  label: string;
  value: string;
  source: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="shrink-0 text-micro text-muted-foreground">
        {label}
      </span>
      <span className="truncate">{value}</span>
      <SourceBadge source={source} />
    </div>
  );
}

function formatPct(value: number | null) {
  if (value === null) return "--";
  return `${value.toFixed(2)}%`;
}
