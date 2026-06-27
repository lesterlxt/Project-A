import { RecommendedFund } from "../api/campaignApi";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils";
import { Star, TrendingUp, Shield } from "lucide-react";

type Props = {
  funds: RecommendedFund[];
  selectedFundCode: string;
  onSelect: (fundCode: string) => void;
};

export function FundRankingTable({
  funds,
  selectedFundCode,
  onSelect,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>
            <Star size={17} className="text-gold" />
            候选基金
          </CardTitle>
          <span className="text-caption text-muted-foreground">
            {funds.length} 只通过初筛
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {funds.length === 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning-subtle px-4 py-5 text-center">
            <p className="text-body font-medium text-warning">
              当前筛选条件下暂无通过数据完整度和风险适当性检查的候选基金
            </p>
            <p className="mt-1 text-caption text-warning/70">
              请尝试调整热点主题、风险偏好或基金类型筛选条件
            </p>
          </div>
        )}

        <div className="space-y-2">
          {funds.map((fund, index) => {
            const isSelected = fund.fund_code === selectedFundCode;
            const isTop = index < 3;

            return (
              <button
                type="button"
                key={fund.fund_code}
                onClick={() => onSelect(fund.fund_code)}
                className={cn(
                  "group grid w-full grid-cols-[40px_minmax(0,1fr)_80px] gap-4 rounded-lg border p-4 text-left transition-all duration-200",
                  isSelected
                    ? "border-primary bg-primary-subtle/50 shadow-sm"
                    : "border-border bg-card hover:border-primary/30 hover:bg-card-hover hover:shadow-sm",
                )}
              >
                {/* Rank badge */}
                <div className="flex items-start pt-0.5">
                  {isTop ? (
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg text-micro font-bold",
                        index === 0
                          ? "bg-gold text-gold-foreground"
                          : index === 1
                            ? "bg-muted-foreground/30 text-foreground"
                            : "bg-muted-foreground/15 text-foreground/70",
                      )}
                    >
                      {index + 1}
                    </span>
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-micro font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Fund info */}
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-h3 text-foreground group-hover:text-primary transition-colors">
                      {fund.fund_name}
                    </span>
                    {fund.is_eligible && (
                      <Badge variant="success" size="sm">
                        候选
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
                    <span className="font-mono">{fund.fund_code}</span>
                    <span className="hidden sm:inline">·</span>
                    <span>{fund.fund_type}</span>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline">{fund.compare_group}</span>
                  </div>

                  {/* Tags */}
                  {fund.matched_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {fund.matched_tags.slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="info" size="sm">
                          {tag}
                        </Badge>
                      ))}
                      {fund.matched_tags.length > 4 && (
                        <span className="text-micro text-muted-foreground self-center ml-0.5">
                          +{fund.matched_tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Mini metrics inline */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-muted-foreground">
                    {fund.manager && fund.manager !== "未知" && (
                      <span>{fund.manager}</span>
                    )}
                    <span>风险 {fund.risk_level}</span>
                    <span>质量 {fund.data_quality_score.toFixed(0)}</span>
                  </div>
                </div>

                {/* Score */}
                <div className="flex flex-col items-end justify-center gap-0.5">
                  <span
                    className={cn(
                      "text-data tabular-nums",
                      isSelected ? "text-primary" : "text-foreground",
                    )}
                  >
                    {fund.score}
                  </span>
                  <span className="text-micro text-muted-foreground">
                    {fund.category_rank > 0
                      ? `#${fund.category_rank}/${fund.category_total}`
                      : "--"}
                  </span>
                  {/* Mini trend indicator */}
                  {fund.one_year_return !== null && (
                    <span
                      className={cn(
                        "flex items-center gap-0.5 text-micro font-medium",
                        fund.one_year_return >= 0
                          ? "text-market-up"
                          : "text-market-down",
                      )}
                    >
                      <TrendingUp
                        size={10}
                        className={
                          fund.one_year_return < 0 ? "rotate-180" : ""
                        }
                      />
                      {fund.one_year_return >= 0 ? "+" : ""}
                      {fund.one_year_return.toFixed(1)}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
