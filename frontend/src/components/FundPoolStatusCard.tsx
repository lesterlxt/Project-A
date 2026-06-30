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

export function FundPoolStatusCard({
  status,
  syncing,
  message,
  onSync,
}: Props) {
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
          <CardTitle>
            <Database size={17} className="text-primary" />
            基金池状态
          </CardTitle>
          <Badge
            variant={status?.available ? "success" : "warning"}
            size="sm"
          >
            {status?.available ? "就绪" : "未就绪"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Count */}
        <div className="flex items-end justify-between">
          <div className="text-caption text-muted-foreground">易方达候选基金</div>
          <span className="text-data tabular-nums text-foreground">
            {(status?.total_count ?? 0).toLocaleString("zh-CN")}
          </span>
        </div>

        {/* Meta */}
        <div className="space-y-2 rounded-md bg-muted/50 px-3 py-2.5 text-caption leading-relaxed text-muted-foreground">
          <div className="flex justify-between">
            <span>来源</span>
            <span className="text-foreground/70">
              {status?.source || "易方达自有基金池"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>存储</span>
            <span className="text-foreground/70">
              {status?.storage || "SQLite"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>更新</span>
            <span className="text-foreground/70">{updatedAt}</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onSync}
          disabled={syncing}
        >
          <RefreshCw
            size={14}
            className={syncing ? "animate-spin" : ""}
          />
          {syncing ? "同步中..." : "同步易方达基金池"}
        </Button>

        {message && (
          <p className="rounded-md bg-success-subtle px-3 py-2 text-micro text-success">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
