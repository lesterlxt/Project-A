from app.schemas import DriverItem, HotspotAnalysisResponse, IndustryChain, OppRiskItem
from app.services.llm_client import DeepSeekClient, LLMError


class HotspotAgent:
    def __init__(self) -> None:
        self.llm = DeepSeekClient()

    def analyze(
        self,
        hotspot: str,
        evidence_headlines: list[str] | None = None,
    ) -> HotspotAnalysisResponse:
        normalized = hotspot.strip()
        if not self.llm.is_configured:
            raise LLMError("DEEPSEEK_API_KEY is required for hotspot analysis")
        return self._analyze_with_llm(normalized, evidence_headlines or [])

    def _analyze_with_llm(
        self,
        hotspot: str,
        evidence_headlines: list[str],
    ) -> HotspotAnalysisResponse:
        headlines_block = ""
        if evidence_headlines:
            headlines_block = "真实新闻标题如下：\n" + "\n".join(
                f"- {h}" for h in evidence_headlines[:15]
            )
        else:
            headlines_block = (
                "当前无真实新闻数据（可能由于网络原因无法抓取 Google News RSS），"
                "请基于你对市场的了解进行分析。\n"
                "如果对该热点了解充分，仍可输出完整分析，但 compliance_note 必须注明「基于模型知识，非实时新闻，仅供参考」。\n"
                "如果确实不了解该热点，才设置 insufficient_data=true。"
            )

        result = self.llm.chat_json(
            system_prompt=(
                "你是一名基金公司投研分析师，负责根据输入的真实新闻、热点事件和市场数据，"
                "为银行渠道销售人员生成「热点主题分析」简报。\n\n"
                "你必须基于输入信息进行分析，不得编造事实。\n"
                "如果输入新闻不足或无法支撑深度分析，请设置 insufficient_data=true 并在 summary 中说明缺少什么数据。\n"
                "输出必须是严格 JSON，不要输出 Markdown。\n\n"
                "分析要求：\n"
                "- 语言专业、简洁，适合基金公司内部投研简报\n"
                "- 多写完整分析句子，少写标签\n"
                "- 所有机会与风险都要有 title + description\n"
                "- 不得构成买入、卖出或收益承诺\n"
                "- 不得使用「推荐买入」「确定受益」「稳赚」「必涨」「保本」等表达\n"
                "- 不得推荐具体基金产品或交易行为"
            ),
            user_prompt=(
                f"请基于以下信息，对市场热点「{hotspot}」生成结构化分析简报。\n\n"
                f"{headlines_block}\n\n"
                "返回 JSON schema：\n"
                "{\n"
                '  "insufficient_data": false,\n'
                '  "summary": "80-150字主题概述，写完整句子",\n'
                '  "core_drivers": [\n'
                '    {"title": "驱动因素短标题(10-15字)", "description": "具体描述(30-60字)"}\n'
                "  ],\n"
                '  "industry_chain": {\n'
                '    "upstream": ["上游环节1", "上游环节2"],\n'
                '    "midstream": ["中游环节1"],\n'
                '    "downstream": ["下游环节1", "下游环节2"]\n'
                "  },\n"
                '  "opportunities": [\n'
                '    {"title": "机会短标题(10-15字)", "description": "具体描述(30-60字)"}\n'
                "  ],\n"
                '  "risks": [\n'
                '    {"title": "风险短标题(10-15字)", "description": "具体描述(30-60字)"}\n'
                "  ],\n"
                '  "related_fund_directions": ["AI主题基金", "半导体指数", "云计算ETF"],\n'
                '  "evidence_headlines": ["引用的新闻标题1", "引用的新闻标题2"],\n'
                '  "compliance_note": "合规提示(20-40字)",\n'
                '  "themes": ["AI", "算力"],\n'
                '  "industries": ["半导体", "计算机"],\n'
                '  "keywords": ["GPU", "数据中心"]\n'
                "}\n\n"
                "字段要求：\n"
                "- core_drivers 列出 2-4 个核心驱动，每个都要有 title 和 description\n"
                "- industry_chain 按上游/中游/下游分类，每类 1-3 个环节\n"
                "- opportunities 列出 2-4 个机会，risks 列出 2-4 个风险，各带 title+description\n"
                "- related_fund_directions 列出 3-5 个相关基金方向（如 AI主题、半导体指数），不列具体基金名\n"
                "- evidence_headlines 从输入新闻中选取 2-5 条最相关的标题\n"
                "- compliance_note 写合规提示，如「以上分析基于公开新闻，不构成投资建议」\n"
                "- themes/industries/keywords 保留作为标签索引，各 3-6 个"
            ),
            temperature=0.25,
        )

        raw_opportunities = result.get("opportunities") or []
        raw_risks = result.get("risks") or []
        raw_drivers = result.get("core_drivers") or []
        raw_chain = result.get("industry_chain") or {}

        return HotspotAnalysisResponse(
            hotspot=hotspot,
            insufficient_data=bool(result.get("insufficient_data", False)),
            summary=str(result.get("summary", "")),
            core_drivers=[
                DriverItem(title=str(d.get("title", "")), description=str(d.get("description", "")))
                for d in raw_drivers if isinstance(d, dict)
            ],
            industry_chain=IndustryChain(
                upstream=[str(s) for s in raw_chain.get("upstream", [])],
                midstream=[str(s) for s in raw_chain.get("midstream", [])],
                downstream=[str(s) for s in raw_chain.get("downstream", [])],
            ),
            opportunities=[
                OppRiskItem(title=str(o.get("title", "")), description=str(o.get("description", "")))
                for o in raw_opportunities if isinstance(o, dict)
            ],
            risks=[
                OppRiskItem(title=str(r.get("title", "")), description=str(r.get("description", "")))
                for r in raw_risks if isinstance(r, dict)
            ],
            related_fund_directions=[str(item) for item in result.get("related_fund_directions", [])],
            evidence_headlines=[str(item) for item in result.get("evidence_headlines", [])],
            compliance_note=str(result.get("compliance_note", "")),
            themes=[str(item) for item in result.get("themes", [])],
            industries=[str(item) for item in result.get("industries", [])],
            keywords=[str(item) for item in result.get("keywords", [])],
        )
