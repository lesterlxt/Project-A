import { RecommendedFund } from "../api/campaignApi";
import { sourceLabel } from "./SourceBadge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const labels: Record<string, string> = {
  theme_relevance: "主题相关度",
  holding_match: "持仓匹配度",
  positioning_match: "产品定位匹配",
  performance_stability: "表现稳定性",
  channel_match: "渠道匹配度",
  compliance_penalty: "合规扣分",
};

const formulas: Record<string, string> = {
  theme_relevance: "命中热点主题、行业、关键词的去重比例 x 主题权重，上限由规则配置控制。",
  holding_match: "命中热点行业的行业暴露比例 x 持仓匹配权重；行业暴露可能来自真实映射或规则推导。",
  positioning_match: "基金产品定位标签命中热点主题的数量 x 单标签分值。",
  performance_stability: "基础分 - 波动率扣分 - 最大回撤扣分 - 近一年负收益扣分。",
  channel_match: "银行渠道风险偏好分 x 渠道权重 + 用户风险偏好分 x 偏好权重。",
  compliance_penalty: "当前为高风险产品匹配稳健型偏好时的规则扣分；P0 后由硬拦截优先处理。",
};

type Props = {
  fund: RecommendedFund;
};

export function ScoreBreakdown({ fund }: Props) {
  const items = Object.entries(fund.score_breakdown);

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
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{labels[key]}</span>
                <strong>{value}</strong>
              </div>
              <div className="h-2 rounded-full bg-secondary">
                <div
                  className={value < 0 ? "h-2 rounded-full bg-destructive" : "h-2 rounded-full bg-primary"}
                  style={{ width: `${width}%` }}
                />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{formulas[key]}</p>
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
