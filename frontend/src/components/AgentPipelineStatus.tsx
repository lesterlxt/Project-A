import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  SkipForward,
} from "lucide-react";
import { AgentEvent } from "../api/campaignApi";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils";

type Props = {
  events: AgentEvent[];
  hasResult: boolean;
  loading: boolean;
};

const STEPS = [
  { key: "load_funds", label: "加载基金池", desc: "SQLite 本地基金数据" },
  { key: "analyze_hotspot", label: "热点分析", desc: "DeepSeek 提炼市场热点" },
  {
    key: "screen_eligibility",
    label: "资格筛选",
    desc: "数据质量与适当性检查",
  },
  { key: "build_channel", label: "渠道策略", desc: "银行渠道画像适配" },
  { key: "score_funds", label: "基金评分", desc: "多维度评分与同类排名" },
  { key: "generate_copy", label: "文案生成", desc: "差异化营销文案" },
  { key: "check_compliance", label: "合规检查", desc: "禁用词与风险语句核验" },
];

type StepStatus = "waiting" | "running" | "done" | "failed" | "skipped";

export function AgentPipelineStatus({
  events,
  hasResult,
  loading,
}: Props) {
  // Build status map from events
  const statusMap: Record<string, StepStatus> = {};
  const messageMap: Record<string, string> = {};
  const durationMap: Record<string, number | null> = {};

  for (const step of STEPS) {
    statusMap[step.key] = "waiting";
  }

  for (const event of events) {
    const step = event.step;
    if (event.status === "started") {
      statusMap[step] = "running";
      messageMap[step] = event.message;
    } else if (event.status === "completed") {
      statusMap[step] = "done";
      messageMap[step] = event.message;
      durationMap[step] = event.duration_ms;
    } else if (event.status === "failed") {
      statusMap[step] = "failed";
      messageMap[step] = event.message;
    } else if (event.status === "skipped") {
      statusMap[step] = "skipped";
      messageMap[step] = event.message;
    }
  }

  // Backward compatibility: if no events but hasResult, mark all as done
  if (events.length === 0 && hasResult) {
    for (const step of STEPS) {
      statusMap[step.key] = "done";
    }
  }

  const isActive = loading || events.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>分析流程</CardTitle>
          {isActive && (
            <span className="text-micro text-muted-foreground">
              {Object.values(statusMap).filter((s) => s === "done")
                .length}
              /{STEPS.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

          <div className="relative space-y-0.5">
            {STEPS.map((step, index) => {
              const status = statusMap[step.key] ?? "waiting";
              const message =
                messageMap[step.key] ?? step.desc;
              const duration = durationMap[step.key];

              return (
                <div
                  key={step.key}
                  className="flex items-start gap-3 py-1.5"
                >
                  {/* Status indicator */}
                  <span className="relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-card">
                    <StatusIcon status={status} />
                  </span>

                  {/* Label + message */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "text-sm font-medium leading-tight transition-colors",
                          status === "done" && "text-foreground",
                          status === "running" && "text-primary",
                          status === "failed" && "text-danger",
                          status === "skipped" && "text-muted-foreground/50",
                          status === "waiting" && "text-muted-foreground/40",
                        )}
                      >
                        {step.label}
                      </p>
                      {duration !== null &&
                        duration !== undefined &&
                        status === "done" && (
                          <span className="text-micro text-muted-foreground">
                            {formatDuration(duration)}
                          </span>
                        )}
                    </div>
                    <p
                      className={cn(
                        "mt-0.5 text-micro transition-colors",
                        status === "running" && "text-primary/70",
                        status === "failed" && "text-danger/70",
                        status === "done" && "text-muted-foreground",
                        status === "skipped" && "text-muted-foreground/40",
                        status === "waiting" && "text-muted-foreground/30",
                      )}
                    >
                      {message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "running":
      return (
        <Loader2 size={14} className="animate-spin text-primary" />
      );
    case "done":
      return <CheckCircle2 size={14} className="text-success" />;
    case "failed":
      return <XCircle size={14} className="text-danger" />;
    case "skipped":
      return (
        <SkipForward size={14} className="text-muted-foreground/40" />
      );
    default:
      return <Circle size={14} className="text-muted-foreground/25" />;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
