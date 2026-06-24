from app.schemas import HotspotAnalysisResponse
from app.services.llm_client import DeepSeekClient, LLMError


HOTSPOT_LIBRARY = {
    "AI算力": {
        "summary": "AI模型训练和推理需求提升，带动服务器、光模块、半导体和云计算基础设施关注度上升。",
        "themes": ["AI", "算力", "半导体", "通信设备", "云计算"],
        "industries": ["通信设备", "半导体", "计算机", "电子", "云服务"],
        "keywords": ["光模块", "服务器", "GPU", "芯片", "数据中心", "云计算", "CPO"],
        "opportunities": ["AI基础设施投入提升", "国产算力产业链扩容", "云厂商资本开支回暖"],
        "risks": ["主题交易拥挤", "估值波动较大", "业绩兑现节奏不确定"],
    },
    "人形机器人": {
        "summary": "人形机器人产业化预期升温，带动高端制造、自动化设备和核心零部件关注。",
        "themes": ["机器人", "智能制造", "高端装备", "自动化", "AI硬件"],
        "industries": ["机械设备", "电子", "计算机", "汽车零部件"],
        "keywords": ["减速器", "伺服系统", "传感器", "控制器", "自动化", "工业机器人"],
        "opportunities": ["产业链国产替代", "制造业自动化升级", "AI与硬件结合"],
        "risks": ["商业化进度不确定", "部分公司估值较高", "订单兑现需要观察"],
    },
    "红利低波": {
        "summary": "市场风险偏好下降时，高股息、低波动和现金流稳定资产更容易受到关注。",
        "themes": ["红利", "低波", "价值", "高股息", "防御"],
        "industries": ["银行", "公用事业", "煤炭", "交通运输", "电力"],
        "keywords": ["高股息", "现金流", "分红", "低估值", "央国企"],
        "opportunities": ["分红稳定性较强", "低利率环境下配置价值提升", "组合防御属性较好"],
        "risks": ["利率变化影响估值", "成长弹性相对有限", "行业政策变化"],
    },
    "创新药": {
        "summary": "创新药审批、出海和医保政策变化推动医药成长资产重新受到关注。",
        "themes": ["创新药", "医药", "生物科技", "CXO", "医疗服务"],
        "industries": ["医药生物", "医疗器械", "医疗服务"],
        "keywords": ["临床管线", "出海授权", "医保谈判", "创新药", "CXO"],
        "opportunities": ["国产创新药出海", "政策预期改善", "估值修复空间"],
        "risks": ["研发失败风险", "政策价格压力", "行业波动较大"],
    },
}


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

    def _analyze_with_fallback(self, normalized: str) -> HotspotAnalysisResponse:
        data = HOTSPOT_LIBRARY.get(normalized)

        if data is None:
            data = {
                "summary": f"{normalized} 是一个需要结合新闻、产业链和基金持仓进一步验证的市场热点。",
                "themes": [normalized],
                "industries": [],
                "keywords": [normalized],
                "opportunities": ["市场关注度提升可能带来阶段性配置需求"],
                "risks": ["主题定义不明确，需要人工确认相关行业和标的"],
            }

        return HotspotAnalysisResponse(hotspot=normalized, **data)
