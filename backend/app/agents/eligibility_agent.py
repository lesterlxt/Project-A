from dataclasses import dataclass
from typing import Any

from app.services.fund_loader import Fund
from app.services.rule_config import load_rule_config


@dataclass(frozen=True)
class FundEligibility:
    fund: Fund
    is_eligible: bool
    data_quality_score: float
    missing_fields: list[str]
    exclusion_reasons: list[str]


class EligibilityAgent:
    """Applies pre-ranking data quality and suitability gates."""

    def screen(self, funds: list[Fund], risk_preference: str) -> list[FundEligibility]:
        return [self._screen_one(fund, risk_preference) for fund in funds]

    def _screen_one(self, fund: Fund, risk_preference: str) -> FundEligibility:
        config = load_rule_config().eligibility
        quality_score, missing_fields = self._data_quality(fund, config["data_quality_weights"])
        exclusion_reasons: list[str] = []

        required_missing = [
            field for field in config["required_fields_for_ranking"]
            if not self._has_field(fund, field)
        ]
        if required_missing:
            exclusion_reasons.append(f"关键字段缺失：{'、'.join(required_missing)}")

        minimum_score = float(config["minimum_data_quality_score"])
        if quality_score < minimum_score:
            exclusion_reasons.append(f"数据完整度不足：{quality_score:.0f}/{minimum_score:.0f}")

        allowed_risks = config["allowed_risk_levels_by_preference"].get(risk_preference, [])
        if not fund.risk_level or fund.risk_level == "未知":
            exclusion_reasons.append("风险等级未知，不能进入候选池")
        elif allowed_risks and fund.risk_level not in allowed_risks:
            exclusion_reasons.append(
                f"风险等级{fund.risk_level}不匹配{risk_preference}客户边界"
            )

        return FundEligibility(
            fund=fund,
            is_eligible=not exclusion_reasons,
            data_quality_score=quality_score,
            missing_fields=missing_fields,
            exclusion_reasons=exclusion_reasons,
        )

    def _data_quality(self, fund: Fund, weights: dict[str, Any]) -> tuple[float, list[str]]:
        total_weight = sum(float(weight) for weight in weights.values())
        earned = 0.0
        missing_fields: list[str] = []

        for field, raw_weight in weights.items():
            weight = float(raw_weight)
            if self._has_field(fund, field):
                earned += weight
            else:
                missing_fields.append(field)

        if total_weight <= 0:
            return 0.0, missing_fields
        return round(earned / total_weight * 100, 1), missing_fields

    def _has_field(self, fund: Fund, field: str) -> bool:
        value = getattr(fund, field)
        if value is None:
            return False
        if isinstance(value, str):
            return bool(value.strip()) and value.strip() not in {"未知", "暂无"}
        if isinstance(value, (list, dict)):
            return bool(value)
        return True
