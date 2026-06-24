import json
from pathlib import Path

from app.schemas import ComplianceIssue, ComplianceResult, MarketingCopy


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "compliance_rules.json"


class ComplianceChecker:
    def __init__(self, data_path: Path = DATA_PATH) -> None:
        self.data_path = data_path

    def check(self, marketing_copy: MarketingCopy) -> ComplianceResult:
        rules = json.loads(self.data_path.read_text(encoding="utf-8"))
        full_text = " ".join(marketing_copy.model_dump().values())
        issues: list[ComplianceIssue] = []

        for term in rules["banned_terms"]:
            if term in full_text:
                issues.append(
                    ComplianceIssue(
                        term=term,
                        severity="high",
                        message=f"文案出现禁用或高风险表达：{term}",
                    )
                )

        suggestions = []
        for required in rules["required_risk_phrases"]:
            if required not in full_text:
                suggestions.append(f"建议补充风险提示：{required}")

        if not issues and not suggestions:
            suggestions.append("未发现明显禁用词，建议仍由合规人员进行最终审核。")

        return ComplianceResult(
            passed=not issues,
            issues=issues,
            suggestions=suggestions,
        )
