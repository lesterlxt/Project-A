import { ShieldCheck, ShieldAlert } from "lucide-react";
import { ComplianceResult } from "../api/campaignApi";
import { Badge } from "./ui/badge";

type Props = {
  compliance: ComplianceResult;
};

export function CompliancePanel({ compliance }: Props) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {compliance.passed ? (
          <ShieldCheck size={17} className="text-success" />
        ) : (
          <ShieldAlert size={17} className="text-warning" />
        )}
        <h2 className="text-h1">合规检查</h2>
        <Badge
          variant={compliance.passed ? "success" : "warning"}
          size="sm"
        >
          {compliance.passed ? "通过" : "需关注"}
        </Badge>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        {compliance.issues.length === 0 && (
          <div className="rounded-lg bg-success-subtle px-4 py-3">
            <p className="text-caption text-success">
              未命中禁用词规则，仍需人工复核
            </p>
          </div>
        )}

        {compliance.issues.length > 0 && (
          <div className="space-y-2">
            {compliance.issues.map((issue) => (
              <div
                key={`${issue.term}-${issue.message}`}
                className="rounded-lg border border-warning/30 bg-warning-subtle p-3"
              >
                <div className="flex items-center gap-2">
                  <strong className="text-caption text-warning">
                    {issue.term}
                  </strong>
                </div>
                <p className="mt-0.5 text-caption text-warning/80">
                  {issue.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {compliance.suggestions.length > 0 && (
          <div className="space-y-1.5 border-t border-border pt-3">
            {compliance.suggestions.map((suggestion) => (
              <p
                key={suggestion}
                className="text-caption text-muted-foreground"
              >
                {suggestion}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
