import { RecommendedFund } from "../api/campaignApi";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const labels: Record<string, string> = {
  theme_relevance: "主题相关度",
  holding_match: "持仓匹配度",
  positioning_match: "产品定位匹配",
  performance_stability: "表现稳定性",
  channel_match: "渠道匹配度",
  compliance_penalty: "合规扣分",
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
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
