import json
from functools import lru_cache
from pathlib import Path
from typing import Any


RULES_PATH = Path(__file__).resolve().parents[1] / "data" / "recommendation_rules.json"
CHANNELS_PATH = Path(__file__).resolve().parents[1] / "data" / "channels.json"


class RuleConfigError(RuntimeError):
    pass


class RuleConfig:
    def __init__(self, data: dict[str, Any], channels: dict[str, Any]) -> None:
        self.data = data
        self.channels = channels

    @property
    def ui(self) -> dict[str, Any]:
        return self.data["ui"]

    @property
    def fund_sync(self) -> dict[str, Any]:
        return self.data["fund_sync"]

    @property
    def risk_level_rules(self) -> list[dict[str, str]]:
        return self.data["risk_level_rules"]

    @property
    def suitable_clients_by_risk(self) -> dict[str, str]:
        return self.data["suitable_clients_by_risk"]

    @property
    def fund_type_filter_rules(self) -> dict[str, dict[str, list[str]]]:
        return self.data["fund_type_filter_rules"]

    @property
    def fund_category_rules(self) -> list[dict[str, Any]]:
        return self.data["fund_category_rules"]

    @property
    def channel_risk_scores(self) -> dict[str, dict[str, int]]:
        return self.data["channel_risk_scores"]

    @property
    def preference_risk_scores(self) -> dict[str, dict[str, int]]:
        return self.data["preference_risk_scores"]

    @property
    def scoring(self) -> dict[str, float]:
        return self.data["scoring"]

    @property
    def performance_score(self) -> dict[str, float]:
        return self.data["performance_score"]

    @property
    def eligibility(self) -> dict[str, Any]:
        return self.data["eligibility"]

    @property
    def industry_keyword_rules(self) -> list[dict[str, str | float]]:
        return self.data["industry_keyword_rules"]

    def options(self) -> dict[str, Any]:
        channels = [name for name in self.channels if name != "默认渠道"]
        return {
            "channels": channels,
            "risk_preferences": self.ui["risk_preferences"],
            "fund_type_filters": self.ui["fund_type_filters"],
            "defaults": {
                "hotspot": self.ui["default_hotspot"],
                "channel": self.ui["default_channel"],
                "risk_preference": self.ui["default_risk_preference"],
                "fund_type_filter": self.ui["default_fund_type_filter"],
                "top_k": self.ui["default_top_k"],
            },
            "fund_sync_defaults": {
                "limit": self.fund_sync["default_limit"],
                "enrich_limit": self.fund_sync["default_enrich_limit"],
                "keywords": self.fund_sync["default_keywords"],
            },
            "scoring_model": self.scoring_model(),
        }

    def scoring_model(self) -> list[dict[str, Any]]:
        scoring = self.scoring
        performance = self.performance_score
        return [
            {
                "key": "theme_relevance",
                "label": "主题相关度",
                "formula": (
                    f"min({scoring['theme_relevance_max']}, "
                    f"热点标签去重命中比例 x {scoring['theme_relevance_multiplier']})"
                ),
                "description": "衡量基金名称、类型、定位、持仓和行业字段与热点主题、行业、关键词的匹配程度。",
                "max_score": scoring["theme_relevance_max"],
                "evidence_fields": ["themes", "industries", "keywords", "fund_name", "fund_type", "positioning"],
            },
            {
                "key": "holding_match",
                "label": "持仓匹配度",
                "formula": (
                    f"min({scoring['holding_match_max']}, "
                    f"热点行业暴露合计 x {scoring['holding_match_multiplier']})"
                ),
                "description": "衡量基金行业配置中命中热点行业的暴露程度；行业暴露可能来自真实映射或规则推导。",
                "max_score": scoring["holding_match_max"],
                "evidence_fields": ["industry_allocation", "top_holdings"],
            },
            {
                "key": "positioning_match",
                "label": "产品定位匹配",
                "formula": (
                    f"min({scoring['positioning_match_max']}, "
                    f"命中主题数 x {scoring['positioning_match_per_hit']})"
                ),
                "description": "衡量基金产品定位标签与热点主题是否直接匹配。",
                "max_score": scoring["positioning_match_max"],
                "evidence_fields": ["positioning", "themes"],
            },
            {
                "key": "performance_stability",
                "label": "表现稳定性",
                "formula": (
                    f"{performance['base_score']} - 波动率扣分 - 最大回撤扣分 - 近一年负收益扣分"
                ),
                "description": (
                    f"波动率高于 {performance['medium_volatility_threshold']}% / "
                    f"{performance['high_volatility_threshold']}% 分级扣分，"
                    f"最大回撤高于 {performance['medium_drawdown_threshold']}% / "
                    f"{performance['high_drawdown_threshold']}% 分级扣分。"
                ),
                "max_score": performance["base_score"],
                "evidence_fields": ["one_year_return", "volatility", "max_drawdown"],
            },
            {
                "key": "channel_match",
                "label": "渠道匹配度",
                "formula": (
                    f"银行渠道风险分 x {scoring['channel_score_weight']} + "
                    f"客户风险偏好分 x {scoring['preference_score_weight']}"
                ),
                "description": "衡量基金风险等级与银行渠道画像、客户风险偏好的匹配程度。",
                "max_score": 10,
                "evidence_fields": ["risk_level", "channel", "risk_preference"],
            },
            {
                "key": "compliance_penalty",
                "label": "合规扣分",
                "formula": f"高风险产品匹配稳健型偏好时扣 {abs(scoring['compliance_penalty_high_risk_for_conservative'])} 分",
                "description": "P0 阶段已由适当性硬拦截优先处理，扣分规则保留用于解释边界。",
                "max_score": 0,
                "evidence_fields": ["risk_level", "risk_preference"],
            },
        ]


@lru_cache(maxsize=1)
def load_rule_config() -> RuleConfig:
    if not RULES_PATH.exists():
        raise RuleConfigError(f"Rule config not found: {RULES_PATH}")
    if not CHANNELS_PATH.exists():
        raise RuleConfigError(f"Channel config not found: {CHANNELS_PATH}")

    rules = json.loads(RULES_PATH.read_text(encoding="utf-8"))
    channels = json.loads(CHANNELS_PATH.read_text(encoding="utf-8"))
    return RuleConfig(rules, channels)
