import { Badge } from "./ui/badge";

const sourceLabels: Record<string, string> = {
  raw: "真实接口",
  calculated: "系统计算",
  inferred: "规则推导",
  mapped: "持仓映射",
  generated: "AI生成",
  missing: "暂无数据",
};

const variants: Record<string, "success" | "info" | "warning" | "muted"> = {
  raw: "success",
  calculated: "info",
  inferred: "warning",
  mapped: "success",
  generated: "info",
  missing: "muted",
};

export function sourceLabel(source: string) {
  return sourceLabels[source] ?? source;
}

export function SourceBadge({ source }: { source: string }) {
  return <Badge variant={variants[source] ?? "muted"}>{sourceLabel(source)}</Badge>;
}
