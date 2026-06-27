"""
Feishu message card builders.

Each function takes structured data from existing backend types and returns
a Feishu interactive card JSON dict.  Cards use a unified dark-blue header
("wathet") to match the React workbench branding.
"""

from __future__ import annotations

from app.schemas import (
    CampaignResponse,
    HotspotAnalysisResponse,
    HotspotItem,
    MarketingCopy,
    RecommendedFund,
)

# ── Colour palette (shared across cards) ──────────────────────────────

HEADER_COLOUR = "wathet"  # Light blue — neutral & professional
CHANNEL_COLOUR_MAP = {
    "招商银行": "blue",
    "工商银行": "red",
    "建设银行": "blue",
    "农业银行": "green",
    "中国银行": "red",
}

# ── Helpers ───────────────────────────────────────────────────────────


def _mk_header(title: str, colour: str = HEADER_COLOUR) -> dict:
    return {
        "template": colour,
        "title": {"tag": "plain_text", "content": title},
    }


def _md(text: str) -> dict:
    return {"tag": "markdown", "content": text}


def _field(short: bool, long: str) -> dict:
    return {"is_short": short, "text": {"tag": "lark_md", "content": long}}


def _hr() -> dict:
    return {"tag": "hr"}


def _note(text: str) -> dict:
    return {"tag": "note", "elements": [{"tag": "plain_text", "content": text}]}


def _action(actions: list[dict]) -> dict:
    return {"tag": "action", "actions": actions}


def _button(text: str, url: str | None = None, value: dict | None = None) -> dict:
    btn: dict = {
        "tag": "button",
        "text": {"tag": "plain_text", "content": text},
        "type": "primary",
    }
    if url:
        btn["url"] = url
        btn["multi_url"] = {"url": url, "pc_url": url, "android_url": url, "ios_url": url}
    if value:
        btn["value"] = value
    return btn


def _score_bar(score: float, max_score: float = 100) -> str:
    """Render a simple ASCII score bar for inline use."""
    pct = min(score / max_score, 1.0)
    blocks = 10
    filled = int(round(pct * blocks))
    bar = "█" * filled + "░" * (blocks - filled)
    return f"{bar} {score:.0f}"


# ── Help / Welcome Card ────────────────────────────────────────────────


def build_help_card() -> dict:
    return {
        "config": {"wide_screen_mode": True},
        "header": _mk_header("🤖 Project A · 基金营销助手"),
        "elements": [
            _md("我是基金渠道营销助手，支持以下操作：\n"),
            _md(
                "🔥 **查热点**\n"
                "「今天有什么热点」「最近热点」\n\n"
                "🔍 **分析主题**\n"
                "「分析人工智能」「分析红利策略」\n\n"
                "📊 **生成推介**\n"
                "「给我生成人工智能的招行推介」「红利主题推荐3只基金」\n"
                "可选渠道：招商银行 / 工商银行 / 建设银行 / 农业银行\n\n"
                "🔎 **查基金**\n"
                "「帮我看看 000001」「查基金 110011」\n\n"
                "📋 **导出审核稿**\n"
                "「导出审核稿」「生成审核材料」"
            ),
            _hr(),
            _note("所有结果基于公开数据和 AI 分析，不构成投资建议。最终对外材料需经合规审核。"),
        ],
    }


# ── Hotspot List Card ──────────────────────────────────────────────────


def build_hotspot_list_card(items: list[HotspotItem], updated_at: str) -> dict:
    elements: list[dict] = []
    for i, item in enumerate(items[:5]):
        medal = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][i]
        elements.append(
            {
                "tag": "div",
                "fields": [
                    _field(
                        True,
                        f"{medal} **{item.name}**\n"
                        f"热度 {item.heat_score} · {item.source_detail or item.source}",
                    ),
                    _field(False, item.summary[:120] + ("..." if len(item.summary) > 120 else "")),
                ],
            }
        )
        if i < min(len(items), 5) - 1:
            elements.append(_hr())

    elements.append(_hr())
    elements.append(_note(f"更新时间：{updated_at}"))

    return {
        "config": {"wide_screen_mode": True},
        "header": _mk_header("🔥 今日市场热点 TOP 5"),
        "elements": elements,
    }


# ── Hotspot Analysis Card ──────────────────────────────────────────────


def build_analysis_card(analysis: HotspotAnalysisResponse) -> dict:
    elements: list[dict] = [_md(f"**{analysis.summary}**\n")]

    # Core drivers
    elements.append(_md("📌 **核心驱动因素**"))
    for d in analysis.core_drivers:
        elements.append(_md(f"• **{d.title}**：{d.description}"))

    # Industry chain
    chain = analysis.industry_chain
    elements.append(_md("\n🔗 **产业链**"))
    elements.append(
        {
            "tag": "div",
            "fields": [
                _field(True, f"**上游**\n" + "\n".join(f"• {u}" for u in chain.upstream[:3])),
                _field(True, f"**中游**\n" + "\n".join(f"• {m}" for m in chain.midstream[:3])),
                _field(True, f"**下游**\n" + "\n".join(f"• {d}" for d in chain.downstream[:3])),
            ],
        }
    )

    # Opportunities & Risks
    elements.append(_md("\n✅ **机会**"))
    for o in analysis.opportunities[:3]:
        elements.append(_md(f"• **{o.title}**：{o.description}"))
    elements.append(_md("\n⚠️ **风险**"))
    for r in analysis.risks[:3]:
        elements.append(_md(f"• **{r.title}**：{r.description}"))

    # Related directions
    if analysis.related_fund_directions:
        elements.append(_md(f"\n📂 **相关基金方向**：{' · '.join(analysis.related_fund_directions)}"))

    elements.append(_hr())
    elements.append(_note(analysis.compliance_note or "仅供参考，不构成投资建议。"))

    return {
        "config": {"wide_screen_mode": True},
        "header": _mk_header(f"📊 热点分析：{analysis.hotspot}"),
        "elements": elements,
    }


# ── Campaign Result Card ────────────────────────────────────────────────


def build_campaign_result_card(result: CampaignResponse) -> dict:
    strategy = result.channel_strategy
    header_colour = CHANNEL_COLOUR_MAP.get(strategy.channel, HEADER_COLOUR)

    elements: list[dict] = []

    # Summary section
    elements.append(
        _md(
            f"**渠道**：{strategy.channel}　"
            f"**通过**：{result.eligible_count} 只　"
            f"**拦截**：{result.excluded_count} 只　"
            f"**推荐**：{len(result.recommended_funds)} 只\n"
        )
    )
    elements.append(
        _md(f"**策略**：{strategy.strategy_summary or '基于热点匹配和客户画像的综合选品'}")
    )

    elements.append(_hr())

    # Fund list — each as a structured div
    for i, fund in enumerate(result.recommended_funds[:5]):
        rank = fund.category_rank or (i + 1)
        total = fund.category_total or "-"
        elements.append(
            {
                "tag": "div",
                "fields": [
                    _field(
                        True,
                        f"**{'🥇' if i == 0 else '🥈' if i == 1 else '🥉' if i == 2 else '▸'} "
                        f"{fund.fund_name}** ({fund.fund_code})\n"
                        f"{fund.fund_type} · {fund.risk_level}\n"
                        f"同类排名 {rank}/{total}",
                    ),
                    _field(
                        False,
                        f"**综合评分** {_score_bar(fund.score)}\n"
                        f"近一年收益 {_fmt_pct(fund.one_year_return)}\n"
                        f"经理 {fund.manager} · 规模 {fund.fund_size}",
                    ),
                ],
            }
        )
        if fund.reason:
            elements.append(_md(f"📌 {fund.reason[:200]}"))
        if i < len(result.recommended_funds) - 1:
            elements.append(_hr())

    # Excluded note
    if result.excluded_funds:
        elements.append(_hr())
        elements.append(
            _md(
                f"⚠️ **已拦截 {len(result.excluded_funds)} 只基金** "
                f"（数据不完整 / 风险不匹配），可在 Web 工作台查看详情。"
            )
        )

    # Compliance
    elements.append(_hr())
    if result.compliance.passed:
        elements.append(_md("✅ 基础合规规则**通过**"))
    else:
        elements.append(
            _md(
                f"⚠️ 命中 **{len(result.compliance.issues)}** 条合规规则：\n"
                + "\n".join(f"• {i.message}" for i in result.compliance.issues[:3])
            )
        )

    # Marketing copy quick peek
    copy = result.marketing_copy
    elements.append(_hr())
    elements.append(_md(f"📝 **{copy.headline}**"))

    # Action buttons
    actions = [
        _button("📋 查看营销话术", value={"action": "show_copy"}),
        _button("🐞 在 Web 工作台查看", url="http://localhost:5173/?tab=result"),
    ]
    elements.append(_action(actions))

    return {
        "config": {"wide_screen_mode": True},
        "header": _mk_header(
            f"📊 {result.hotspot_analysis.hotspot} · {strategy.channel}推介", colour=header_colour
        ),
        "elements": elements,
    }


# ── Full Marketing Copy Card ───────────────────────────────────────────


def build_copy_card(copy: MarketingCopy, channel: str) -> dict:
    header_colour = CHANNEL_COLOUR_MAP.get(channel, HEADER_COLOUR)
    elements: list[dict] = []

    elements.append(_md(f"**{copy.headline}**\n"))
    elements.append(_md(f"_{copy.one_liner}_\n"))

    elements.append(_md("─── 客户经理面谈话术 ───"))
    elements.append(_md(copy.relationship_manager_script[:1500]))

    elements.append(_md("─── 社交媒体文案 ───"))
    elements.append(_md(copy.social_post[:800]))

    if copy.selling_points:
        elements.append(_md("─── 核心卖点 ───"))
        for sp in copy.selling_points[:5]:
            elements.append(_md(f"• {sp}"))

    elements.append(_hr())
    elements.append(_md(f"⚠️ **风险揭示**\n{copy.risk_disclosure[:500]}"))

    actions = [_button("🐞 查看完整审核稿", url="http://localhost:5173/?tab=result")]
    elements.append(_action(actions))

    return {
        "config": {"wide_screen_mode": True},
        "header": _mk_header(f"📝 营销文案 · {channel}", colour=header_colour),
        "elements": elements,
    }


# ── Fund Detail Card ───────────────────────────────────────────────────


def build_fund_detail_card(fund: RecommendedFund) -> dict:
    elements: list[dict] = [
        _md(f"**{fund.fund_name}** ({fund.fund_code})\n"),
        {
            "tag": "div",
            "fields": [
                _field(True, f"**类型**\n{fund.fund_type}"),
                _field(True, f"**风险等级**\n{fund.risk_level}"),
                _field(True, f"**基金经理**\n{fund.manager}"),
                _field(True, f"**最新净值**\n{fund.latest_nav}"),
                _field(True, f"**近一年收益**\n{_fmt_pct(fund.one_year_return)}"),
                _field(True, f"**基金规模**\n{fund.fund_size}"),
            ],
        },
        _hr(),
        _md(
            f"**综合评分**：{_score_bar(fund.score)}\n"
            f"**同类排名**：{fund.category_rank}/{fund.category_total} ({fund.category_reason or '同类比较'})\n"
        ),
    ]

    if fund.reason:
        elements.append(_md(f"**推荐理由**：{fund.reason[:300]}"))
    if fund.positioning:
        elements.append(_md(f"**产品定位**：{' · '.join(fund.positioning[:5])}"))
    if fund.risk_warning:
        elements.append(_md(f"⚠️ {fund.risk_warning[:200]}"))

    return {
        "config": {"wide_screen_mode": True},
        "header": _mk_header(f"🔍 {fund.fund_name}"),
        "elements": elements,
    }


# ── Generic text / error / loading card ────────────────────────────────


def build_text_card(text: str, title: str = "💬 回复") -> dict:
    return {
        "config": {"wide_screen_mode": True},
        "header": _mk_header(title),
        "elements": [_md(text)],
    }


def build_loading_card(message: str = "正在处理，请稍候...") -> dict:
    return {
        "config": {"wide_screen_mode": True},
        "header": _mk_header("⏳ 处理中"),
        "elements": [_md(message)],
    }


def build_error_card(error: str) -> dict:
    return {
        "config": {"wide_screen_mode": True},
        "header": _mk_header("❌ 出错了", colour="red"),
        "elements": [_md(f"抱歉，处理请求时遇到问题：\n\n{error}")],
    }


# ── Utils ──────────────────────────────────────────────────────────────


def _fmt_pct(val: float | None) -> str:
    if val is None:
        return "N/A"
    return f"{val:+.2f}%"
