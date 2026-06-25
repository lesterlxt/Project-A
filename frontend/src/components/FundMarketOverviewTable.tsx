import { AlertCircle, RefreshCw, Table2 } from "lucide-react";
import type { ReactNode } from "react";
import { MarketOverviewResponse } from "../api/campaignApi";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type Props = {
  data: MarketOverviewResponse | null;
  loading: boolean;
  error: string;
};

export function FundMarketOverviewTable({ data, loading, error }: Props) {
  const rows = data?.items ?? [];
  const updatedTime = data?.updated_at
    ? new Date(data.updated_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Table2 size={18} />
              市场与基金配置参考
            </CardTitle>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              银行渠道沟通参考，不构成投资建议。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>真实行情</span>
            <span>·</span>
            <span>更新 {updatedTime}</span>
            {loading && <RefreshCw size={14} className="animate-spin text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {!error && !loading && rows.length === 0 && (
          <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
            市场数据暂不可用，请稍后重试。
          </div>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto border-y">
            <table className="min-w-[1040px] w-full border-collapse bg-white text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <Th>市场维度</Th>
                  <Th>代表指标</Th>
                  <Th align="right">最新值</Th>
                  <Th align="right">今日涨跌/变化</Th>
                  <Th align="right">近1月表现</Th>
                  <Th>市场解读</Th>
                  <Th>可关联基金类型</Th>
                  <Th>渠道沟通参考</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.market_dimension}-${row.indicator_name}`} className="border-t">
                    <Td className="font-medium text-foreground">{row.market_dimension}</Td>
                    <Td>{row.indicator_name}</Td>
                    <Td align="right">{formatLatest(row.indicator_name, row.latest_value)}</Td>
                    <Td align="right">
                      <ChangeValue percent={row.change_percent} value={row.change_value} isYield={isYield(row.indicator_name)} />
                    </Td>
                    <Td align="right">
                      <ChangeValue percent={row.one_month_percent} />
                    </Td>
                    <Td className="max-w-[230px] text-xs leading-5 text-muted-foreground">{row.interpretation}</Td>
                    <Td className="max-w-[190px] text-xs leading-5 text-muted-foreground">
                      {row.related_fund_types.join(" / ")}
                    </Td>
                    <Td className="max-w-[220px] text-xs leading-5 text-muted-foreground">{row.channel_scenario}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          来源：{data?.source || "公开行情接口"}；每 30 秒自动刷新。
        </p>
      </CardContent>
    </Card>
  );
}

function Th({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return <th className={cn("border-b px-3 py-2 font-medium", align === "right" && "text-right")}>{children}</th>;
}

function Td({
  children,
  align = "left",
  className,
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return <td className={cn("px-3 py-3 align-top", align === "right" && "text-right tabular-nums", className)}>{children}</td>;
}

function ChangeValue({
  percent,
  value,
  isYield = false,
}: {
  percent: number | null;
  value?: number | null;
  isYield?: boolean;
}) {
  if (percent === null) return <span className="text-muted-foreground">--</span>;
  const positive = percent > 0;
  const negative = percent < 0;
  return (
    <span className={cn("font-medium", positive && "text-red-600", negative && "text-emerald-600")}>
      {formatSigned(percent)}%
      {value !== undefined && value !== null && (
        <span className="ml-1 text-xs opacity-80">
          ({formatSigned(value)}{isYield ? "pct" : ""})
        </span>
      )}
    </span>
  );
}

function formatLatest(name: string, value: number | null) {
  if (value === null) return "--";
  if (isYield(name)) return `${value.toFixed(2)}%`;
  return value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSigned(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}`;
}

function isYield(name: string) {
  return name.includes("收益率");
}
