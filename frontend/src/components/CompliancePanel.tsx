import { ShieldCheck, ShieldAlert } from "lucide-react";
import { ComplianceResult } from "../api/campaignApi";

type Props = {
  compliance: ComplianceResult;
};

export function CompliancePanel({ compliance }: Props) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {compliance.passed ? <ShieldCheck size={17} className="text-muted-foreground" /> : <ShieldAlert size={17} className="text-muted-foreground" />}
        <h2 className="text-base font-semibold">合规检查</h2>
      </div>
      <div className="space-y-3 rounded-md border p-4">
        {compliance.issues.length === 0 && (
          <p className="text-sm text-muted-foreground">未命中禁用词规则，仍需人工复核。</p>
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

        {compliance.suggestions.length > 0 && (
          <div className="space-y-1.5">
          {compliance.suggestions.map((suggestion) => (
            <p key={suggestion} className="text-sm leading-6 text-muted-foreground">
              {suggestion}
            </p>
          ))}
          </div>
        )}
      </div>
    </section>
  );
}
