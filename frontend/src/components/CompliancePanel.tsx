import { ShieldCheck, ShieldAlert } from "lucide-react";
import { ComplianceResult } from "../api/campaignApi";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type Props = {
  compliance: ComplianceResult;
};

export function CompliancePanel({ compliance }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            {compliance.passed ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
            合规检查
          </CardTitle>
          <Badge variant={compliance.passed ? "success" : "warning"}>
            {compliance.passed ? "基础规则通过" : "需处理"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {compliance.issues.length === 0 && (
          <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
            暂未命中禁用词规则，仍需人工合规复核。
          </p>
        )}

        {compliance.issues.length > 0 && (
          <div className="space-y-2">
          {compliance.issues.map((issue) => (
            <div key={`${issue.term}-${issue.message}`} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
              <strong>{issue.term}</strong>
              <span className="ml-2 text-amber-900">{issue.message}</span>
            </div>
          ))}
          </div>
        )}

        <div className="space-y-2">
        {compliance.suggestions.map((suggestion) => (
          <p key={suggestion} className="text-sm leading-6 text-muted-foreground">
            {suggestion}
          </p>
        ))}
        </div>
      </CardContent>
    </Card>
  );
}
