import { ShieldCheck, ShieldAlert } from "lucide-react";
import { ComplianceResult } from "../api/campaignApi";

type Props = {
  compliance: ComplianceResult;
};

export function CompliancePanel({ compliance }: Props) {
  return (
    <section className="section-block">
      <div className="section-title">
        {compliance.passed ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
        <h2>合规检查</h2>
      </div>
      <div className={compliance.passed ? "status passed" : "status blocked"}>
        {compliance.passed ? "基础规则通过" : "发现高风险表达"}
      </div>

      {compliance.issues.length > 0 && (
        <div className="issue-list">
          {compliance.issues.map((issue) => (
            <div key={`${issue.term}-${issue.message}`} className="issue">
              <strong>{issue.term}</strong>
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="suggestions">
        {compliance.suggestions.map((suggestion) => (
          <p key={suggestion}>{suggestion}</p>
        ))}
      </div>
    </section>
  );
}
