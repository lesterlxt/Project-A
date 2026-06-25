# Project A Handoff Context

## Product Positioning

Project A is an AI hotspot-driven fund selection and bank-channel marketing platform.

The business goal is to help fund company / bank channel teams turn market hotspots into reviewable product promotion materials:

```text
market hotspot
-> theme and industry analysis
-> fund pool matching
-> data quality and suitability checks
-> candidate fund ranking
-> channel-specific marketing copy
-> compliance pre-check
-> human review and export
```

This is not a direct retail investment-advice tool. It should be positioned as an internal assistant for product, channel, sales enablement, and compliance review workflows.

## Target End State

The final product direction has two user-facing surfaces:

```text
React App
  Full workbench for product/channel/compliance users.
  Shows evidence, scores, field sources, risk boundaries, copy drafts, and review exports.

Feishu Chatbot
  Conversational business entrypoint.
  Lets channel teams ask for hotspot summaries, candidate funds, channel copy, and review drafts from Feishu.
```

Both surfaces should call the same backend Agent workflow and return the same structured evidence.

## Why Multi-Agent Matters

Multi-agent is a core technical and presentation highlight, but it must be tied to the business process. Do not add agents just as class names.

Expected agent responsibilities:

```text
HotspotResearchAgent
  Analyze market hotspots, industries, keywords, opportunities, risks.
  Must not recommend funds.

FundDataAgent
  Sync and load fund data.
  Must return data source, update time, and missing fields.

EligibilityAgent
  Decide whether each fund can enter candidate ranking.
  Must output eligible, data_quality_score, and exclusion_reasons.

ScoringAgent
  Score eligible funds within comparable categories.
  Must expose formulas, metric inputs, and score breakdown.

ExplanationAgent
  Generate recommendation explanations based only on structured data.
  Must cite field sources and uncertainty.

ChannelMarketingAgent
  Generate channel-specific copy for banks such as 招商银行 / 工商银行.
  Must follow channel profile and compliance boundaries.

ComplianceAgent
  Check copy and explanations for banned terms, missing risk language, and suitability issues.
  Must distinguish basic rule pass from formal compliance approval.

ReviewOrchestrator
  Merge agent outputs for React and Feishu.
  Must preserve audit trail and human review state.
```

Current code is still a mostly linear orchestrator. That is acceptable for now. The immediate goal is to stabilize the data contracts before introducing LangGraph.

## Current Tech Stack

Frontend:

```text
React + TypeScript + Vite
Tailwind CSS
local shadcn/ui-style components
lucide-react icons
```

Current React layout:

```text
Left sidebar:
  ControlPanel with only analysis parameters and action button
  FundPoolStatusCard
  AgentPipelineStatus

Right side before analysis:
  PreAnalysisDashboard
  Uses a single vertical main column.
  Shows current config, hotspot news, market/fund allocation reference,
  E Fund official supermarket sample, fund-pool structure, and analysis boundary.

Right side after analysis:
  ReviewActions
  candidate funds / excluded funds
  hotspot analysis
  score breakdown
  evidence panel
  marketing copy
  compliance panel
  suitability boundary
```

`/api/options` also returns scoring formula metadata. The pre-analysis dashboard and `ScoreBreakdown` render this backend-driven model instead of duplicating formula text in frontend components.

`/api/market/overview` returns the dashboard market reference table. Current quotes come from Eastmoney, A-share one-month performance uses Tencent daily kline, and overseas/history fallbacks use Yahoo Finance chart data. The frontend does not mock unavailable market values.

`/api/efunds/supermarket` returns a small read-only sample from the E Fund official fund supermarket page. It is shown only as official product-page context in the pre-analysis dashboard; the UI intentionally does not show purchase/subscription buttons.

Fund-pool sync currently keeps the implementation detail of "enhanced count" in the backend logs only. The frontend explains the business-facing screening logic instead: read public fund codes, apply configured theme keywords, and keep the first 3,000 matching funds as the local SQLite candidate pool.

Backend:

```text
FastAPI
SQLite fund pool
DeepSeek API through OpenAI-compatible /chat/completions
Plain Python orchestration
```

Runtime environment used locally:

```text
backend Python env: /opt/anaconda3/envs/agent311
frontend dev server: npm run dev -- --host 127.0.0.1 --port 5173
backend dev server: /opt/anaconda3/envs/agent311/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Current Running URLs

```text
Frontend: http://127.0.0.1:5173
Backend:  http://127.0.0.1:8000
Swagger:  http://127.0.0.1:8000/docs
```

Useful backend checks:

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/llm-status
curl http://127.0.0.1:8000/api/options
curl http://127.0.0.1:8000/api/funds/status
curl http://127.0.0.1:8000/api/funds/summary
```

## Current Data State

The fund pool is SQLite-only:

```text
backend/app/data/funds.db
```

Local snapshot from prior review:

```text
total funds: 3000
enriched funds: 99
latest data_updated_at: 2026-06-24T11:43:28+00:00
```

Important deletions:

```text
backend/app/data/funds.csv       deleted; old mock sample data
backend/app/data/real_funds.csv  deleted; old CSV fallback
```

`FundLoader` should only read `funds.db`. If the DB is missing, the backend should ask the user to run `/api/funds/sync`.

`/api/funds/summary` is a read-only SQLite summary endpoint used by the pre-analysis dashboard. It should only report real local fund-pool statistics:

```text
total_count
enriched_count
fund_type_distribution
risk_level_distribution
```

Do not hardcode frontend chart data for these panels.

## Data Sources

Fund sync is not LLM-generated. It is programmatic fetching from public Eastmoney / Tiantian Fund endpoints.

Current sources:

```text
https://fund.eastmoney.com/js/fundcode_search.js
  -> fund code, fund name, fund type

https://fund.eastmoney.com/pingzhongdata/{fund_code}.js
  -> manager, net worth trend, stock holding codes, one-year return

https://fundgz.1234567.com.cn/js/{fund_code}.js
  -> latest NAV / estimated growth
```

The current data is useful for an MVP but not sufficient for a professional recommendation system. Missing or incomplete fields include:

```text
fund size
inception date
fee structure
official risk rating
manager tenure
holding names and weights
industry weights
Sharpe ratio
Calmar ratio
peer ranking
purchase / redemption status
```

## Rule Configuration

Centralized rule config:

```text
backend/app/data/recommendation_rules.json
```

Reader:

```text
backend/app/services/rule_config.py
```

Rules currently include:

```text
fund sync keywords
risk level derivation
suitable-client wording
fund type filter rules
scoring formula metadata for frontend display
channel risk scores
risk preference scores
scoring weights
performance-stability penalties
industry keyword rules
frontend option defaults
```

Frontend options should come from:

```text
GET /api/options
```

## Data Provenance Boundary

The UI must not make AI output look like verified facts.

Current provenance categories:

```text
raw         public API field
calculated  calculated from available data
inferred    rule-derived or approximate
mapped      mapped from real stock_industry_map rows
generated   LLM-generated text
missing     unavailable
```

Examples:

```text
raw:
  fund_code
  fund_name
  fund_type
  manager when available
  latest_nav
  estimated_growth
  one_year_return
  top_holdings stock codes

calculated:
  volatility
  max_drawdown
  current score

mapped:
  industry_allocation when stock codes are mapped through real stock_industry_map rows

inferred:
  risk_level
  suitable_clients
  positioning tags
  industry_allocation when generated by keyword rules

generated:
  recommendation reason
  marketing copy
```

The frontend score panel now states that the comprehensive score is calculated by backend rules. DeepSeek participates in hotspot extraction and marketing copy generation, but does not directly assign the fund score.

## Real Industry Mapping Boundary

New service:

```text
backend/app/services/stock_industry_mapper.py
```

Expected optional table:

```sql
stock_industry_map(
  stock_code TEXT PRIMARY KEY,
  stock_name TEXT,
  industry TEXT NOT NULL,
  source TEXT,
  updated_at TEXT
)
```

This table is not auto-filled with fake data. The provider only creates the table shape and removes or ignores legacy rows with `source='manual_seed'`. If absent or incomplete, the system falls back to keyword rules and should keep the field marked as inferred.

Future improvement: add `fund_holdings` with holding weights:

```sql
fund_holdings(
  fund_code TEXT,
  stock_code TEXT,
  stock_name TEXT,
  holding_weight REAL,
  report_date TEXT,
  source TEXT
)
```

Only then can the system calculate real industry exposure by holding weight.

## LLM Usage

DeepSeek is used through:

```text
backend/app/services/llm_client.py
```

Current LLM uses:

```text
backend/app/agents/hotspot_agent.py
  -> analyzes a user-entered hotspot into themes, industries, keywords, opportunities, risks

backend/app/services/hotspot_provider.py
  -> fetches Google News RSS headlines and asks DeepSeek to extract Top 5 investment-themed hotspots

backend/app/agents/copywriting_agent.py
  -> generates bank-channel marketing copy
```

LLM must not invent fund data. Fund data must come from structured data providers or marked as missing.

## Current Business Flow

Current API:

```text
POST /api/run-campaign
```

Current request:

```json
{
  "hotspot": "AI算力",
  "channel": "招商银行",
  "risk_preference": "平衡型",
  "fund_type_filter": "全部",
  "top_k": 5
}
```

Current output includes:

```text
hotspot_analysis
channel_strategy
recommended_funds
marketing_copy
compliance
```

Near-term change: rename product language from "recommended_funds" in the UI to "candidate funds / system shortlist" while keeping API compatibility if needed.

## What Is Important Now

Most important:

```text
1. Data completeness filtering: initial implementation exists in EligibilityAgent
2. Suitability hard blocking: initial implementation exists in EligibilityAgent
3. Candidate-fund wording instead of direct recommendation wording: started in frontend
4. data_quality_score and exclusion_reasons per returned fund: implemented
5. Formula and metric explanation visible in the frontend: backend-driven scoring metadata is returned by `/api/options`
```

Important for business value:

```text
1. Channel-specific marketing copy
2. Review export
3. Feishu chatbot integration
4. Human-review status
5. Bank-channel profile differences
```

Important for technical presentation:

```text
1. Multi-agent role separation
2. Evidence and provenance tracking
3. Tool/data boundary: LLM explains, data providers fetch facts
4. React + Feishu dual surfaces
5. Future LangGraph state machine
```

## What Is Missing

Critical missing pieces:

```text
real industry mapping data
holding-weight-based industry exposure
formal review workflow
Feishu chatbot endpoint
```

## What Is Not Necessary Yet

Do not prioritize these before P0:

```text
LangGraph migration
complex portfolio optimization
live trading or order placement
personalized retail advice
RAG over long fund PDFs
full compliance rule engine
```

These can come later, after the structured data and business boundaries are stable.

## P0 / P1 / P2 Roadmap

P0:

```text
1. Data completeness filtering: implemented
2. Suitability hard blocking: implemented
3. Rename recommendation UI language to candidate / system shortlist: started
4. Output exclusion_reasons and data_quality_score per fund: implemented
```

P1:

```text
5. Fund-type bucketed scoring: initial category and same-group rank implemented
6. Real stock industry mapping table: table shape implemented; default seed disabled; full data import still needed
7. Recommendation explanation must cite field sources: initial explanation_points implemented
```

P2:

```text
8. Multi-agent orchestration
9. LangGraph state machine
10. Human review workflow
```

## GitHub Note

GitHub CLI auth was invalid in the local environment during the last check:

```text
gh auth status -> token invalid for userMaoGuaXi
```

SSH remote exists:

```text
origin git@github.com:lesterlxt/Project-A.git
```

If `git push` over SSH works, a branch push is possible without `gh`. Creating a PR through `gh` requires re-authentication.
