from app.schemas import HotspotAnalysisResponse
from app.services.llm_client import DeepSeekClient, LLMError


class HotspotAgent:
    def __init__(self) -> None:
        self.llm = DeepSeekClient()

    def analyze(self, hotspot: str) -> HotspotAnalysisResponse:
        normalized = hotspot.strip()
        if not self.llm.is_configured:
            raise LLMError("DEEPSEEK_API_KEY is required for hotspot analysis")
        return self._analyze_with_llm(normalized)

    def _analyze_with_llm(self, hotspot: str) -> HotspotAnalysisResponse:
        result = self.llm.chat_json(
            system_prompt=(
                "你是基金公司渠道营销和产业主题研究助手。"
                "你只输出严格 JSON，不输出 Markdown。"
                "内容必须合规，不能写任何收益承诺或买入建议。"
            ),
            user_prompt=(
                f"请分析市场热点：{hotspot}\n"
                "返回 JSON 字段：summary, themes, industries, keywords, opportunities, risks。\n"
                "要求：summary 是一句中文摘要；themes、industries、keywords、opportunities、risks 都是中文字符串数组。\n"
                "themes 必须是 3-6 个短主题标签，例如：AI、算力、半导体、机器人、红利、创新药，单个标签不要超过 8 个中文字符。\n"
                "industries 必须是 3-6 个标准短行业名，例如：通信设备、半导体、计算机、机械设备、医药生物、银行。\n"
                "keywords 必须是 5-8 个短关键词，例如：光模块、服务器、GPU、数据中心。\n"
                "opportunities 2-4 个，risks 2-4 个。不要把完整句子放进 themes、industries 或 keywords。"
            ),
            temperature=0.15,
        )
        return HotspotAnalysisResponse(
            hotspot=hotspot,
            summary=str(result["summary"]),
            themes=[str(item) for item in result["themes"]],
            industries=[str(item) for item in result["industries"]],
            keywords=[str(item) for item in result["keywords"]],
            opportunities=[str(item) for item in result["opportunities"]],
            risks=[str(item) for item in result["risks"]],
        )
