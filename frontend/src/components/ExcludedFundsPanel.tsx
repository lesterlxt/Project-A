import { AlertTriangle } from "lucide-react";
import { RecommendedFund } from "../api/campaignApi";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type Props = {
  funds: RecommendedFund[];
};

export function ExcludedFundsPanel({ funds }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle size={18} />
          未进入候选池
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {funds.length === 0 && (
          <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
            当前没有返回被排除基金样本。
          </p>
        )}
        {funds.slice(0, 8).map((fund) => (
          <div key={fund.fund_code} className="rounded-md border bg-background p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{fund.fund_name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  <span>{fund.fund_code}</span>
                  <span>{fund.fund_type}</span>
                  <span>{fund.risk_level}</span>
                </div>
              </div>
              <Badge variant="warning">质量 {fund.data_quality_score.toFixed(0)}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {fund.exclusion_reasons.join(" / ") || "未返回排除原因"}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
