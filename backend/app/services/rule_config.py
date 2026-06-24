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
        }


@lru_cache(maxsize=1)
def load_rule_config() -> RuleConfig:
    if not RULES_PATH.exists():
        raise RuleConfigError(f"Rule config not found: {RULES_PATH}")
    if not CHANNELS_PATH.exists():
        raise RuleConfigError(f"Channel config not found: {CHANNELS_PATH}")

    rules = json.loads(RULES_PATH.read_text(encoding="utf-8"))
    channels = json.loads(CHANNELS_PATH.read_text(encoding="utf-8"))
    return RuleConfig(rules, channels)
