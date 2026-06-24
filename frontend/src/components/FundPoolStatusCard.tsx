import { Database, RefreshCw } from "lucide-react";
import { FundPoolStatus } from "../api/campaignApi";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type Props = {
  status: FundPoolStatus | null;
  syncing: boolean;
  message: string;
  onSync: () => void;
};

export function FundPoolStatusCard({ status, syncing, message, onSync }: Props) {
  const updatedAt = status?.latest_updated_at
    ? new Date(status.latest_updated_at).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "未同步";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Database size={18} />
            基金池
          </CardTitle>
          <Badge variant={status?.available ? "success" : "warning"}>{status?.available ? "SQLite" : "未就绪"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="基金数量" value={status?.total_count ?? 0} />
          <Metric label="增强数据" value={status?.enriched_count ?? 0} />
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>来源：{status?.source || "东方财富 / 天天基金公开接口"}</p>
          <p>更新：{updatedAt}</p>
          <p>存储：{status?.storage || "SQLite"}</p>
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={onSync} disabled={syncing}>
          <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
          {syncing ? "同步中..." : "同步真实基金池"}
        </Button>
        {message && <p className="text-xs leading-5 text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value.toLocaleString("zh-CN")}</div>
    </div>
  );
}
