# Project A

AI 热点驱动的基金智能选品与营销生成平台 MVP。

面向银行渠道销售场景，从市场热点出发，自动分析主题、匹配基金池、生成营销文案并完成基础合规检查。

## 功能

- **实时热点抓取** — Google News RSS + DeepSeek 聚合，每日 Top 5 热点
- **大规模基金池** — 东方财富公开数据 → SQLite，3000+ 只真实基金
- **五维评分引擎** — 主题相关度 / 持仓匹配 / 产品定位 / 表现稳定性 / 渠道匹配
- **渠道画像** — 招商/工商/建设/农业银行客户画像与表达策略
- **营销文案生成** — DeepSeek 生成话术、社媒文案、长文，包含风险提示
- **合规检查** — 禁用词扫描 + 必选风险语句核验

## 架构

```
frontend (React + TypeScript + Vite)     backend (FastAPI + DeepSeek)
┌──────────────────────────────┐       ┌──────────────────────────┐
│  CampaignWorkbench           │  POST │  /api/run-campaign       │
│  ├─ 热点选择 / 渠道 / 偏好   │ ────→ │  ├─ HotspotAgent (LLM)   │
│  ├─ FundRankingTable         │       │  ├─ FundLoader (SQLite)  │
│  ├─ ScoreBreakdown           │       │  ├─ FundScorer (5-dim)   │
│  ├─ MarketingCopyPanel       │       │  ├─ ChannelStrategyAgent │
│  └─ CompliancePanel          │ ←──── │  ├─ CopywritingAgent(LLM)│
└──────────────────────────────┘       │  └─ ComplianceChecker    │
        http://127.0.0.1:5173         └──────────────────────────┘
                                             http://127.0.0.1:8000
```

## 快速开始

### 1. 环境准备

```bash
# 后端
conda create -n agent311 python=3.11 -y
conda activate agent311
cd backend && pip install -r requirements.txt

# 前端
cd frontend && npm install
```

### 2. 配置 DeepSeek API Key

在项目根目录创建 `.env`：

```env
DEEPSEEK_API_KEY=sk-your-key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

### 3. 同步基金池

首次使用需要从东方财富拉取基金数据：

```bash
curl -X POST http://127.0.0.1:8000/api/funds/sync \
  -H "Content-Type: application/json" \
  -d '{"limit": 3000, "enrich_limit": 100}'
```

> 约 60 秒完成：Phase 1 批量入库 3000 只基础信息，Phase 2 10 线程并行抓取 100 只详细数据（经理/持仓/收益/波动率）。

数据存储在 `backend/app/data/funds.db`（SQLite，3000+ 行，已 gitignore）。

### 4. 启动服务

```bash
# 后端
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# 前端（新终端）
cd frontend
npm run dev
```

- 工作台: http://127.0.0.1:5173
- Swagger: http://127.0.0.1:8000/docs

### 5. 使用

1. 点击「同步真实基金池」拉取最新基金数据
2. 选择热点 / 渠道 / 风险偏好 → 点击「开始分析」
3. 查看推荐基金排名、分数拆解、营销文案和合规结果

## API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/llm-status` | DeepSeek 配置状态 |
| GET | `/api/hotspots/today` | 今日热点 Top 5 |
| POST | `/api/funds/sync` | 同步基金池（东方财富 → SQLite） |
| POST | `/api/analyze-hotspot` | 单个热点深度分析 |
| POST | `/api/run-campaign` | 完整营销活动流水线 |

### run-campaign 示例

```json
{
  "hotspot": "AI算力",
  "channel": "招商银行",
  "risk_preference": "平衡型",
  "fund_type_filter": "全部",
  "top_k": 5
}
```

## 项目结构

```
backend/app/
├── main.py              # FastAPI 入口
├── schemas.py           # Pydantic 数据模型
├── agents/              # LLM 驱动的 Agent
│   ├── hotspot_agent.py         # 热点分析
│   ├── channel_strategy_agent.py # 渠道策略
│   └── copywriting_agent.py     # 文案生成
├── services/            # 核心服务
│   ├── fund_data_provider.py    # 东方财富数据抓取 + SQLite
│   ├── fund_loader.py           # SQLite/CSV 基金加载
│   ├── fund_scorer.py           # 五维评分引擎
│   ├── compliance.py            # 合规检查
│   ├── hotspot_provider.py      # Google News RSS 热点
│   └── llm_client.py            # DeepSeek HTTP 客户端
├── orchestrator/        # 流水线编排
│   └── campaign_orchestrator.py
└── data/                # 数据文件
    ├── funds.db          # SQLite 基金池 (gitignored)
    ├── channels.json     # 银行渠道画像
    └── compliance_rules.json # 合规规则
```
