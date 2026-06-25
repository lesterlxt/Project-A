import { RecommendedFund, ScoreFormula } from "../api/campaignApi";
import { sourceLabel } from "./SourceBadge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type Props = {
  fund: RecommendedFund;
  scoringModel: ScoreFormula[];
};

export function ScoreBreakdown({ fund, scoringModel }: Props) {
  const items = Object.entries(fund.score_breakdown);
  const formulaByKey = new Map(scoringModel.map((item) => [item.key, item]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>分数拆解</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 rounded-md border bg-background p-3 text-xs leading-5 text-muted-foreground md:grid-cols-2">
          <SourceLine label="综合分来源" value="后端规则公式计算，DeepSeek 不直接给基金打分" />
          <SourceLine label="基金网站来源" value={fund.data_source || "暂无"} />
          <SourceLine label="热点来源" value="Google News RSS 标题 + DeepSeek 主题提炼" />
          <SourceLine label="行业来源" value={sourceLabel(fund.field_sources.industry_allocation ?? "missing")} />
          <SourceLine label="风险指标" value="基于净值序列计算波动率、最大回撤和表现稳定性" />
          <SourceLine label="适当性来源" value="后端规则配置，不替代人工销售适当性审核" />
        </div>
        {items.map(([key, value]) => {
          const width = Math.min(Math.abs(value) * 2.6, 100);
          const formula = formulaByKey.get(key);
          return (
            <div key={key} className="space-y-1.5">
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
              <p className="text-xs leading-5 text-muted-foreground">
                {formula ? `${formula.formula}。${formula.description}` : "后端规则公式计算。"}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SourceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 font-medium text-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
