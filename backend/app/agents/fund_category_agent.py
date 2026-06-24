from dataclasses import dataclass

from app.services.fund_loader import Fund
from app.services.rule_config import load_rule_config


@dataclass(frozen=True)
class FundCategory:
    category: str
    label: str
    reason: str


class FundCategoryAgent:
    """Classifies funds into comparable product buckets."""

    def classify(self, fund: Fund) -> FundCategory:
        fund_type = fund.fund_type or ""
        for rule in load_rule_config().fund_category_rules:
            tokens = [str(item) for item in rule.get("contains", [])]
            if any(token in fund_type for token in tokens):
                return FundCategory(
                    category=str(rule["category"]),
                    label=str(rule["label"]),
                    reason=str(rule["reason"]),
                )

        return FundCategory(
            category="other",
            label="其他基金",
            reason="基金类型未命中当前分类规则，暂归入其他基金比较组。",
        )
