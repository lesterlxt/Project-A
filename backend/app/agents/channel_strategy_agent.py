import json
from pathlib import Path

from app.schemas import ChannelStrategy


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "channels.json"


class ChannelStrategyAgent:
    def __init__(self, data_path: Path = DATA_PATH) -> None:
        self.data_path = data_path

    def build(self, channel: str) -> ChannelStrategy:
        channels = json.loads(self.data_path.read_text(encoding="utf-8"))
        profile = channels.get(channel) or channels["默认渠道"]
        strategy_summary = (
            f"{channel}的表达重点应围绕{profile['messaging_focus'][0]}，"
            f"同时避免{profile['forbidden_angles'][0]}。"
        )
        return ChannelStrategy(
            channel=channel,
            client_profile=profile["client_profile"],
            messaging_focus=profile["messaging_focus"],
            forbidden_angles=profile["forbidden_angles"],
            strategy_summary=strategy_summary,
        )
