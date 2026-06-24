import { CheckCircle2, CircleDashed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type Props = {
  hasResult: boolean;
  loading: boolean;
};

const steps = ["热点分析", "基金匹配", "渠道策略", "文案生成", "合规检查"];

export function AgentPipelineStatus({ hasResult, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Agent 流程</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step, index) => {
          const done = hasResult || (loading && index === 0);
          return (
            <div key={step} className="flex items-center gap-3 rounded-md border bg-background p-2.5">
              {done ? (
                <CheckCircle2 size={16} className="text-emerald-600" />
              ) : (
                <CircleDashed size={16} className="text-muted-foreground" />
              )}
              <span className="text-sm">{step}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
