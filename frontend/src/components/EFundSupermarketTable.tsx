import { Building2, RefreshCw } from "lucide-react";
import { EFundSupermarketResponse } from "../api/campaignApi";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type Props = {
  data: EFundSupermarketResponse | null;
  loading: boolean;
  error: string;
};

export function EFundSupermarketTable({ data, loading, error }: Props) {
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
              <Building2 size={18} />
              易方达官网基金超市
            </CardTitle>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              官方产品页样本，对照本地基金池覆盖。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>官方页面数据</span>
            <span>·</span>
            <span>{data?.total_count ? `${data.total_count} 只` : "未加载"}</span>
            <span>·</span>
            <span>更新 {updatedTime}</span>
            {loading && <RefreshCw size={14} className="animate-spin" />}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">{error}</div>}
        {!error && !loading && rows.length === 0 && (
          <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
            易方达官网基金超市数据暂不可用。
          </div>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto border-y">
            <table className="min-w-[820px] w-full border-collapse text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="border-b px-3 py-2 font-medium">基金</th>
                  <th className="border-b px-3 py-2 font-medium">类型 / 风险</th>
                  <th className="border-b px-3 py-2 font-medium">基金经理</th>
                  <th className="border-b px-3 py-2 text-right font-medium">单位净值</th>
                  <th className="border-b px-3 py-2 text-right font-medium">日涨跌</th>
                  <th className="border-b px-3 py-2 text-right font-medium">近1月</th>
                  <th className="border-b px-3 py-2 text-right font-medium">近1年</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.fund_code} className="border-t">
                    <td className="px-3 py-3">
                      <div className="font-medium text-foreground">{row.fund_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{row.fund_code}</div>
                    </td>
                    <td className="px-3 py-3 text-xs leading-5 text-muted-foreground">
                      {row.fund_type || "--"} / {row.risk_level || "--"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{row.manager || "--"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <div className="font-medium">{row.net_value || "--"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{row.trade_date || "--"}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums"><Percent value={row.daily_change_percent} /></td>
                    <td className="px-3 py-3 text-right tabular-nums"><Percent value={row.one_month_percent} /></td>
                    <td className="px-3 py-3 text-right tabular-nums"><Percent value={row.one_year_percent} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          来源：{data?.source || "易方达官网基金产品页"}；非交易入口。
        </p>
      </CardContent>
    </Card>
  );
}

function Percent({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">--</span>;
  return (
    <span className={cn("font-medium", value > 0 && "text-red-600", value < 0 && "text-emerald-600")}>
      {value > 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}
