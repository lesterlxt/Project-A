import { RecommendedFund } from "../api/campaignApi";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils";

type Props = {
  funds: RecommendedFund[];
  selectedFundCode: string;
  onSelect: (fundCode: string) => void;
};

export function FundRankingTable({ funds, selectedFundCode, onSelect }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>候选基金</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {funds.length === 0 && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            当前筛选条件下暂无通过数据完整度和风险适当性检查的候选基金。
          </p>
        )}
        {funds.map((fund, index) => (
          <button
            type="button"
            key={fund.fund_code}
            onClick={() => onSelect(fund.fund_code)}
            className={cn(
              "grid w-full grid-cols-[32px_minmax(0,1fr)_72px] gap-3 rounded-md border p-3 text-left transition-colors hover:bg-accent/60",
              fund.fund_code === selectedFundCode ? "border-primary bg-accent" : "border-border bg-background",
            )}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-muted-foreground">
              {index + 1}
            </span>
            <span className="min-w-0 space-y-1">
              <span className="block truncate text-sm font-semibold">{fund.fund_name}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>{fund.fund_code}</span>
                <span>{fund.fund_type}</span>
                <span>{fund.compare_group}</span>
                <span>{fund.manager || "经理未知"}</span>
              </span>
              <span className="flex flex-wrap gap-1">
                {fund.matched_tags.slice(0, 4).map((tag) => (
                  <Badge key={tag} variant="muted">
                    {tag}
                  </Badge>
                ))}
              </span>
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <strong className="text-lg leading-none">{fund.score}</strong>
              <span className="text-xs text-muted-foreground">
                {fund.category_rank > 0 ? `同组 ${fund.category_rank}/${fund.category_total}` : ""}
                {fund.category_rank > 0 ? " · " : ""}质量 {fund.data_quality_score.toFixed(0)}
              </span>
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
