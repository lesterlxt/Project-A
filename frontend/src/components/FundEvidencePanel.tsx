import { FileSearch } from "lucide-react";
import { RecommendedFund, ScoreFormula } from "../api/campaignApi";
import { Badge } from "./ui/badge";
import { SourceBadge } from "./SourceBadge";

type Props = {
  fund: RecommendedFund;
  scoringModel: ScoreFormula[];
};

export function FundEvidencePanel({ fund, scoringModel }: Props) {
  const industries = Object.entries(fund.industry_allocation);
  const items = Object.entries(fund.score_breakdown);
  const formulaByKey = new Map(scoringModel.map((item) => [item.key, item]));

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <FileSearch size={17} className="text-muted-foreground" />
        <h2 className="text-base font-semibold">初筛依据与评分</h2>
        <Badge variant={fund.is_enriched ? "success" : "warning"}>
          {fund.is_enriched ? "详情字段" : "基础字段"}
        </Badge>
      </div>

      <div className="space-y-6 rounded-md border p-5">
        {/* Key metrics row */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Metric label="候选状态" value={fund.is_eligible ? "已进入候选池" : "未进入候选池"} source="calculated" />
          <Metric label="数据质量" value={`${fund.data_quality_score.toFixed(0)}/100`} source={fund.field_sources.data_quality_score ?? "calculated"} />
          <Metric label="缺失字段" value={`${fund.missing_fields.length} 个`} source="calculated" />
          <Metric label="比较分组" value={fund.compare_group} source="inferred" />
          <Metric label="同组排名" value={fund.category_rank ? `${fund.category_rank}/${fund.category_total}` : "--"} source="calculated" />
        </div>

        {/* Fund basic info */}
        <div>
          <div className="mb-2 text-sm font-medium">基金信息</div>
          <div className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <InfoRow label="代码" value={fund.fund_code} source={fund.field_sources.fund_code} />
            <InfoRow label="名称" value={fund.fund_name} source={fund.field_sources.fund_name} />
            <InfoRow label="类型" value={fund.fund_type} source={fund.field_sources.fund_type} />
            <InfoRow label="经理" value={fund.manager || "--"} source={fund.field_sources.manager} />
            <InfoRow label="风险等级" value={fund.risk_level} source={fund.field_sources.risk_level} />
            <InfoRow label="最新净值" value={fund.latest_nav || "--"} source={fund.field_sources.latest_nav} />
            <InfoRow label="估算涨幅" value={fund.estimated_growth || "--"} source={fund.field_sources.estimated_growth} />
            <InfoRow label="近1年收益" value={formatPct(fund.one_year_return)} source={fund.field_sources.one_year_return} />
            <InfoRow label="波动率" value={formatPct(fund.volatility)} source={fund.field_sources.volatility} />
            <InfoRow label="最大回撤" value={formatPct(fund.max_drawdown)} source={fund.field_sources.max_drawdown} />
          </div>
        </div>

        {/* Score breakdown bars */}
        <div>
          <div className="mb-2 text-sm font-medium">分数拆解</div>
          <div className="space-y-2.5">
            {items.map(([key, value]) => {
              const width = Math.min(Math.abs(value) * 2.6, 100);
              const formula = formulaByKey.get(key);
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{formula?.label ?? key}</span>
                    <strong>{value}</strong>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div
                      className={value < 0 ? "h-2 rounded-full bg-destructive" : "h-2 rounded-full bg-primary"}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  {formula && (
                    <p className="text-xs leading-5 text-muted-foreground">{formula.formula}。{formula.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Screening reason */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <div className="text-sm font-medium">初筛理由</div>
            <SourceBadge source={fund.field_sources.reason} />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{fund.reason}</p>
        </div>

        {/* Exclusion reasons if any */}
        {!fund.is_eligible && fund.exclusion_reasons.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="text-sm font-medium">排除原因</div>
              <SourceBadge source={fund.field_sources.exclusion_reasons ?? "calculated"} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{fund.exclusion_reasons.join(" / ")}</p>
          </div>
        )}

        {/* Missing fields if any */}
        {fund.missing_fields.length > 0 && (
          <div>
            <div className="mb-1.5 text-sm font-medium">缺失字段</div>
            <p className="text-sm text-muted-foreground">{fund.missing_fields.join(" / ")}</p>
          </div>
        )}

        {/* Positioning tags */}
        <div>
          <div className="mb-1.5 text-sm font-medium">产品定位</div>
          <div className="flex flex-wrap gap-1.5">
            {fund.positioning.slice(0, 10).map((tag) => (
              <Badge key={tag} variant="muted">{tag}</Badge>
            ))}
            <SourceBadge source={fund.field_sources.positioning} />
          </div>
        </div>

        {/* Holdings & industry */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="text-sm font-medium">持仓股票代码</div>
              <SourceBadge source={fund.field_sources.top_holdings} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {fund.top_holdings.slice(0, 10).join(" / ") || "--"}
            </p>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="text-sm font-medium">行业配置</div>
              <SourceBadge source={fund.field_sources.industry_allocation} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {industries.length ? industries.map(([name, value]) => `${name} ${value.toFixed(1)}%`).join(" / ") : "--"}
            </p>
          </div>
        </div>

        {/* Explanation points */}
        {fund.explanation_points.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">解释证据链</div>
            <div className="space-y-2">
              {fund.explanation_points.map((point) => (
                <div key={`${point.label}-${point.text}`} className="rounded-md border bg-background p-3">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">{point.label}</div>
                    <SourceBadge source={point.source} />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{point.text}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    依据：{point.evidence_fields.join(" / ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
      <SourceBadge source={source} />
    </div>
  );
}

function InfoRow({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="truncate">{value}</span>
      <SourceBadge source={source} />
    </div>
  );
}

function formatPct(value: number | null) {
  if (value === null) return "--";
  return `${value.toFixed(2)}%`;
}
