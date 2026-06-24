# Project A

AI 热点驱动的基金智能选品与银行渠道营销生成平台。

这个项目的目标不是做一个直接面向散户的“买哪只基金”工具，而是做一个嵌入基金公司/银行渠道业务流程的 AI Agent 系统：自动发现市场热点，分析热点对应的行业和主题，从基金池中筛出适合渠道推广的候选基金，并生成面向不同银行渠道的营销材料、风险提示和审核稿。

最终形态是双端产品：

- **React 工作台**：给产品经理、渠道经理、合规/投研同事使用，展示选品依据、数据来源、评分拆解、营销文案和审核状态。
- **飞书 Chatbot**：给业务同事在日常工作流里直接问热点、查基金、生成推介话术、导出审核稿。

## 业务场景

原始选题：

```text
A 项目：AI 热点驱动的基金智能选品与营销生成平台

利用 AI 自动抓取市场热点（如 AI、机器人、红利、创新药等），分析热点对应的行业和投资主题，并结合基金持仓、产品定位和不同银行渠道客户特征，自动推荐最适合推广的基金产品，同时生成招行版、工行版等差异化营销文案和产品推介材料。
```

当前项目会坚持这个方向，但把“推荐”改造成更可审查的业务流程：

```text
市场热点
-> 热点/行业/主题分析
-> 基金数据同步与质量检查
-> 风险适当性和数据完整度过滤
-> 候选基金排序与评分拆解
-> 渠道差异化营销文案
-> 合规规则检查
-> 人工复核与审核稿导出
```

## 当前定位

当前系统更准确的定位是：

```text
基金渠道营销辅助系统 / 内部选品与推介材料生成工具
```

它不是：

- 面向终端投资者的自动投资建议系统
- 自动销售决策系统
- 可以替代投研、合规或销售适当性审核的系统

所有 AI 输出都必须可解释、可追溯、可人工复核。

## 当前功能

- **热点发现**：Google News RSS + DeepSeek 提炼每日市场热点。
- **热点研究 Agent**：把热点拆成主题、行业、关键词、机会和风险。
- **基金池同步**：从东方财富/天天基金公开接口同步基金基础信息、净值、经理、持仓代码、收益和风险指标。
- **规则配置化**：基金同步关键词、风险等级推导、评分权重、基金类型筛选、渠道风险偏好等集中放在 `recommendation_rules.json`。
- **候选基金排序**：基于主题相关度、持仓/行业匹配、产品定位、表现稳定性和渠道匹配计算分数。
- **字段来源标记**：前端区分真实接口字段、系统计算字段、规则推导字段、AI 生成字段和缺失字段。
- **渠道营销文案**：根据不同银行渠道画像生成客户经理话术、社媒文案和长文。
- **基础合规检查**：禁用词扫描和必要风险语句核验。
- **审核稿导出**：导出 Markdown 审核稿，供人工复核。

## 多 Agent 目标架构

当前后端还是线性编排，但项目目标是演进成多 Agent 协作系统。每个 Agent 必须有清晰的输入、输出、边界和拒绝条件。

```text
HotspotResearchAgent
  输入：热点、新闻标题
  输出：主题、行业、关键词、机会、风险
  边界：不能直接推荐基金

FundDataAgent
  输入：基金池和外部数据源
  输出：基金字段、数据来源、更新时间、字段完整度
  边界：不能生成投资结论

EligibilityAgent
  输入：基金数据、用户/渠道风险偏好
  输出：eligible / excluded / exclusion_reasons / data_quality_score
  边界：风险不匹配或关键数据缺失时必须拦截

ScoringAgent
  输入：通过资格检查的基金
  输出：同类分数、评分拆解、指标计算说明
  边界：不同基金类型不能简单混排

ExplanationAgent
  输入：结构化指标和字段来源
  输出：推荐依据、主要风险、不确定性说明
  边界：不能编造数据，不确定必须说明

ChannelMarketingAgent
  输入：候选基金、渠道画像、合规边界
  输出：招行/工行/建行/农行等差异化营销话术
  边界：不能承诺收益，不能直接给买入指令

ComplianceAgent
  输入：推荐解释和营销文案
  输出：通过/需修改/禁止使用、命中规则、修改建议
  边界：基础规则通过不等于正式合规通过

ReviewOrchestrator
  输入：各 Agent 的结构化输出
  输出：前端展示结果、飞书回复、审核稿
  边界：最终对外材料必须经过人工复核
```

后续是否引入 LangGraph，取决于状态流是否稳定。短期先把 Agent 之间的数据结构、可解释字段、拦截规则和审核流程做好。

## 技术亮点

- **业务嵌入**：围绕基金公司/银行渠道的真实营销流程，而不是通用聊天机器人。
- **多 Agent 分工**：热点研究、基金数据、资格过滤、评分、解释、营销、合规、审核分层。
- **数据可信边界**：每个字段标记来源，前端展示“真实接口 / 系统计算 / 规则推导 / AI 生成 / 缺失”。
- **适当性优先**：风险等级和数据完整度先拦截，再排序。
- **可解释推荐**：前端展示每个指标怎么来的、为什么纳入、为什么排除。
- **双端交互**：React 工作台承载完整审核视图，飞书 Chatbot 承载业务日常问答和快速生成。
- **合规前置**：营销文案生成后自动做基础规则检查，并导出人工审核稿。

## 当前最重要的缺口

P0 已开始落地：

1. 已新增数据完整度过滤。
2. 已新增风险适当性硬拦截。
3. 前端主流程已改成“候选基金 / 系统初筛”。
4. 每只返回基金会输出 `exclusion_reasons` 和 `data_quality_score`。

P0 仍可继续增强：

- 展示更多被排除基金，后续可做分页。
- 把评分公式从后端配置完整返回给前端。
- 把不同基金类型分桶后再排序。

P1 后续完善：

5. 基金类型分桶评分。
6. 真实行业映射表。
7. 推荐解释必须引用字段来源。

P2 技术升级：

8. 多 Agent 编排。
9. LangGraph 状态机。
10. 人工审核工作流。

## 数据边界

当前基金池来自公开接口：

- `fund.eastmoney.com/js/fundcode_search.js`
- `fund.eastmoney.com/pingzhongdata/{fund_code}.js`
- `fundgz.1234567.com.cn/js/{fund_code}.js`

需要注意：

- `funds.db` 是本地 SQLite 缓存，已被 `.gitignore` 忽略。
- 旧的 CSV mock/fallback 数据已删除。
- 当前行业配置仍可能来自规则推导；真实行业映射入口已预留，但需要后续灌入 `stock_industry_map`。
- 当前持仓只有股票代码，不等于真实持仓权重；正式行业暴露应基于持仓权重聚合。

## 快速开始

### 后端

```bash
conda create -n agent311 python=3.11 -y
conda activate agent311
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

项目根目录创建 `.env`：

```env
DEEPSEEK_API_KEY=sk-your-key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

可选：复制前端环境变量示例。

```bash
cp frontend/.env.example frontend/.env
```

默认地址：

- React 工作台: http://127.0.0.1:5173
- FastAPI Swagger: http://127.0.0.1:8000/docs

### 同步基金池

```bash
curl -X POST http://127.0.0.1:8000/api/funds/sync \
  -H "Content-Type: application/json" \
  -d '{"limit": 3000, "enrich_limit": 100}'
```

## API

| Method | Path | 说明 |
| ------ | ---- | ---- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/llm-status` | DeepSeek 配置状态 |
| GET | `/api/options` | 前端选项和默认参数 |
| GET | `/api/hotspots/today` | 今日热点 Top 5 |
| GET | `/api/funds/status` | 基金池状态 |
| POST | `/api/funds/sync` | 同步基金池 |
| POST | `/api/analyze-hotspot` | 单个热点深度分析 |
| POST | `/api/run-campaign` | 完整选品和营销流水线 |

## 项目结构

```text
backend/app/
├── main.py
├── schemas.py
├── agents/
│   ├── hotspot_agent.py
│   ├── fund_data_agent.py
│   ├── channel_strategy_agent.py
│   └── copywriting_agent.py
├── orchestrator/
│   └── campaign_orchestrator.py
├── services/
│   ├── fund_data_provider.py
│   ├── fund_loader.py
│   ├── fund_scorer.py
│   ├── stock_industry_mapper.py
│   ├── rule_config.py
│   ├── compliance.py
│   ├── hotspot_provider.py
│   └── llm_client.py
└── data/
    ├── recommendation_rules.json
    ├── channels.json
    └── compliance_rules.json

frontend/src/
├── pages/CampaignWorkbench.tsx
├── api/campaignApi.ts
├── components/
│   ├── ControlPanel.tsx
│   ├── FundPoolStatusCard.tsx
│   ├── AgentPipelineStatus.tsx
│   ├── FundRankingTable.tsx
│   ├── ScoreBreakdown.tsx
│   ├── FundEvidencePanel.tsx
│   ├── MarketingCopyPanel.tsx
│   ├── CompliancePanel.tsx
│   ├── ReviewActions.tsx
│   └── SourceBadge.tsx
└── styles.css
```

## 合规声明

本项目仅用于基金产品研究、渠道营销材料生成和内部审核辅助，不构成投资建议、收益承诺或销售适当性结论。正式对外材料必须以基金合同、招募说明书、产品资料概要、销售适当性规则和合规审核意见为准。
