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
                "你的分析要有深度，不能只是堆砌标签，要写出有逻辑的市场观察。"
            ),
            user_prompt=(
                f"请对市场热点「{hotspot}」进行深度分析，返回以下 JSON 字段：\n\n"
                "summary：2-3 句中文摘要，概括该热点的当前市场关注度和核心逻辑。\n\n"
                "market_background：一段 80-120 字的中文市场背景，描述该热点近期的驱动因素（政策、产业动态、资金流向、海外映射等），"
                "要写成连贯的段落而非列表。\n\n"
                "industry_analysis：一段 80-120 字的中文行业分析，说明该热点如何传导到具体产业链环节，"
                "哪些上下游受益，哪些环节需要关注风险。要写成连贯段落。\n\n"
                "investment_logic：一段 60-100 字的中文配置逻辑，从基金选品角度说明该热点对应的基金类型、"
                "持仓特征和渠道沟通要点。不要推荐具体基金，只说类型和方向。\n\n"
                "themes：3-6 个短主题标签，例如 AI、算力、半导体、机器人、红利、创新药。每个不超过 8 个字。\n"
                "industries：3-6 个标准行业名，例如 通信设备、半导体、计算机、机械设备、医药生物、银行。\n"
                "keywords：5-8 个短关键词，例如 光模块、服务器、GPU、数据中心。\n"
                "opportunities：2-4 个机会点，每个是一句 15-25 字的简短描述。\n"
                "risks：2-4 个风险点，每个是一句 15-25 字的简短描述。\n\n"
                "注意：market_background、industry_analysis、investment_logic 必须是连贯的段落文字，"
                "不能是列表或标签堆砌。themes、industries、keywords 是标签数组，用于快速索引。"
            ),
            temperature=0.25,
        )
        return HotspotAnalysisResponse(
            hotspot=hotspot,
            summary=str(result.get("summary", "")),
            market_background=str(result.get("market_background", "")),
            industry_analysis=str(result.get("industry_analysis", "")),
            investment_logic=str(result.get("investment_logic", "")),
            themes=[str(item) for item in result.get("themes", [])],
            industries=[str(item) for item in result.get("industries", [])],
            keywords=[str(item) for item in result.get("keywords", [])],
            opportunities=[str(item) for item in result.get("opportunities", [])],
            risks=[str(item) for item in result.get("risks", [])],
        )
