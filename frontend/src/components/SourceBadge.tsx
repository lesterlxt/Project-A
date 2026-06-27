import { Badge } from "./ui/badge";

const sourceLabels: Record<string, string> = {
  raw: "真实接口",
  calculated: "系统计算",
  inferred: "规则推导",
  mapped: "持仓映射",
  mapped_from_holding_weight: "持仓权重映射",
  holding_count_fallback: "持仓数量映射",
  generated: "AI 生成",
  missing: "暂无数据",
};

const variants: Record<string, "success" | "info" | "warning" | "muted"> = {
  raw: "success",
  calculated: "info",
  inferred: "warning",
  mapped: "success",
  mapped_from_holding_weight: "success",
  holding_count_fallback: "warning",
  generated: "info",
  missing: "muted",
};

export function sourceLabel(source: string) {
  return sourceLabels[source] ?? source;
}

export function SourceBadge({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <Badge
      variant={variants[source] ?? "muted"}
      size="sm"
      className={className}
    >
      {sourceLabel(source)}
    </Badge>
  );
}
