import { AlertTriangle } from "lucide-react";
import { RecommendedFund } from "../api/campaignApi";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";

type Props = {
  funds: RecommendedFund[];
};

export function ExcludedFundsPanel({ funds }: Props) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle size={17} className="text-warning" />
        <h2 className="text-h1">未进入候选池</h2>
        <Badge variant="warning" size="sm">
          {funds.length} 只
        </Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          {funds.length === 0 && (
            <div className="px-5 py-6 text-center text-caption text-muted-foreground">
              当前没有返回被排除基金样本
            </div>
          )}
          <div className="divide-y">
            {funds.slice(0, 8).map((fund) => (
              <div key={fund.fund_code} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body font-semibold">
                      {fund.fund_name}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted-foreground">
                      <span className="font-mono">
                        {fund.fund_code}
                      </span>
                      <span>{fund.fund_type}</span>
                      <span>{fund.compare_group}</span>
                      <span>风险 {fund.risk_level}</span>
                    </div>
                  </div>
                  <Badge variant="warning" size="sm">
                    质量 {fund.data_quality_score.toFixed(0)}
                  </Badge>
                </div>
                <p className="mt-2 text-caption leading-relaxed text-muted-foreground">
                  {fund.exclusion_reasons.join(" / ") ||
                    "未返回排除原因"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
