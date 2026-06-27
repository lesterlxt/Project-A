# Project A Roadmap

## One-Line Goal

Build a multi-agent fund channel-marketing system that turns market hotspots into reviewable candidate funds, explainable scores, bank-channel copy, and compliance-ready drafts across a React workbench and a Feishu chatbot.

## Business Value

The project should fit into a real fund company / bank-channel workflow:

```text
Product / channel team sees a market hotspot
-> asks the system for related themes and fund candidates
-> checks data quality, suitability, and score explanations
-> generates channel-specific promotion copy
-> exports a review draft
-> compliance / channel lead reviews before external use
```

The business value is not only "AI recommends a fund". The stronger value is:

- faster hotspot response;
- consistent channel messaging;
- evidence-backed product promotion;
- lower compliance wording risk;
- reusable review material;
- better traceability for why a fund was selected or excluded.

## What Matters Most

### 1. Marketing Workflow

Marketing is not optional. It is the business output.

The system should help generate:

- relationship-manager script;
- WeChat / social short copy;
- longer product pitch;
- channel-specific talking points;
- risk disclosure;
- review draft.

The copy must be based on structured fund evidence and must preserve risk language.

### 2. Explainability

The frontend should answer:

```text
Why is this fund shown?
Which hotspot tags matched?
Which fields are real, calculated, inferred, generated, or missing?
How was each score calculated?
What are the main risks?
What data is still missing?
Why was another fund excluded?
```

This is the core difference between a professional internal tool and a simple AI demo.

### 3. Boundaries

The system must clearly separate:

```text
candidate fund != investment advice
basic compliance pass != formal compliance approval
public API field != official fund document
keyword inferred industry != real holding-weight industry exposure
LLM explanation != factual data source
```

### 4. Multi-Agent Design

Multi-agent is important for technical presentation and future scalability.

The agents should map to real business roles:

```text
Research analyst      -> HotspotResearchAgent
Data analyst          -> FundDataAgent
Risk reviewer         -> EligibilityAgent
Product researcher    -> ScoringAgent
Investment writer     -> ExplanationAgent
Channel marketer      -> ChannelMarketingAgent
Compliance reviewer   -> ComplianceAgent
Workflow coordinator  -> ReviewOrchestrator
```

## What Is Missing Today

### P0 Gaps

✅ All P0 gaps have been closed:

- ✅ strict data-completeness gate — `EligibilityAgent` with configurable `data_quality_weights`
- ✅ suitability hard blocking — `allowed_risk_levels_by_preference` per risk preference
- ✅ "candidate fund / system shortlist" wording replaces "recommended fund" in UI
- ✅ `data_quality_score` per fund returned to frontend
- ✅ `exclusion_reasons` per fund returned to frontend
- ✅ missing metrics trigger exclusion rather than silent tolerance

### P1 Gaps

✅ All P1 gaps now closed:

- ✅ fund-type bucketed scoring — `FundCategoryAgent` with 7 categories and within-group ranking
- ✅ real stock-industry mapping data — `StockIndustryImporter` fetches Shenwan classifications from Eastmoney F10 (342 real mappings in DB)
- ✅ holding-weight-based industry exposure — `fund_holdings` table created, weight data imported from `Data_fundSharesPositions`; `aggregate_by_holding_weight()` provides weight-based industry allocation; count-based fallback (`mapped_from_holding_count`) only used when weights unavailable
- ✅ recommendation explanations cite supporting fields — `explanation_points` with field sources
- ✅ score formulas visible in UI — `/api/options` returns scoring model metadata
- ✅ extended fund fields — fund_size, inception_date, management_fee, custody_fee, official_risk_level, manager_tenure; Sharpe/Calmar/peer_rank fields added but require additional data source
- ✅ risk level source tracking — `risk_level_source` distinguishes official vs. inferred_from_fund_type

### P2 Gaps

Progress (updated 2026-06-27):

- ✅ formal multi-agent state machine — LangGraph `StateGraph` with 7 nodes + conditional routing
- ✅ LangGraph flow — `GraphOrchestrator` with SSE event streaming
- ✅ Feishu chatbot endpoint — `FeishuBotService` via WebSocket, 6 intent handlers, message cards (pending Feishu app credentials)
- no persistent human-review workflow;
- no review history or audit log.

## What Is Not Worth Doing Yet

Do not spend time on these before P0 is complete:

- full LangGraph migration;
- complex portfolio construction;
- automatic trade/order workflow;
- full PDF RAG over every fund document;
- perfect UI polish before data and suitability gates;
- production-grade compliance engine.

These are useful later, but they do not solve the current trust gap.

## Proposed Milestones

### Milestone 0: Current Checkpoint

Already done:

- React + FastAPI MVP;
- pre-analysis dashboard for the initial workbench state;
- DeepSeek LLM client;
- public fund data sync;
- SQLite fund pool;
- read-only fund-pool summary endpoint for dashboard charts;
- field source badges;
- score breakdown;
- bank-channel copy generation;
- basic compliance panel;
- review draft export;
- config-driven rules;
- `/api/options` for frontend defaults;
- backend-driven scoring formula metadata;
- market/fund allocation reference table with empty states;
- E Fund official fund supermarket sample;
- simplified pre-analysis UI with single vertical content flow;
- fund-pool card with business-facing screening explanation;
- react-router-dom URL routing (`/` / `/?tab=result&fund=CODE` / `/fund/:fundCode`);
- hotspot analysis redesigned as structured research brief;
- Eastmoney news scraper as Google News RSS fallback;
- real Shenwan industry mapping from Eastmoney F10 (P1 data gap closed);
- fund detail page redesigned as channel-marketing enablement tool;
- enhanced copywriting agent with selling points, investor education, and objection handling.

### Milestone 1: P0 Trust Layer ✅ COMPLETE

Goal: make candidate ranking defensible.

- ✅ `EligibilityAgent` with data quality weights and suitability gates
- ✅ `data_quality_score` per fund
- ✅ `exclusion_reasons` per fund
- ✅ hard risk suitability blocking
- ✅ UI language: "候选基金 / 系统初筛"
- ✅ separate "eligible candidates" and "excluded / data insufficient" sections

### Milestone 2: P1 Professional Scoring ✅ MOSTLY COMPLETE

Goal: make scores closer to financial product research.

- ✅ category buckets: money market, bond, mixed, equity, index, QDII, FOF
- ✅ same-category rank fields (`category_rank` / `category_total`)
- ✅ real stock-industry mapping — `StockIndustryImporter` fetches Shenwan classifications from Eastmoney F10
- ✅ explanation points referencing fields and sources
- ✅ score formula metadata via `/api/options`

Remaining refinements:
- ⚠️ same-category score normalization
- ⚠️ Sharpe/Calmar ratio, peer rank data (require additional data source)
- ⚠️ more official product fields may become available from additional API endpoints

### Milestone 3: P2 Agent Productization

Goal: turn linear workflow into a real multi-agent product.

Build:

- explicit agent contracts;
- event log for each agent;
- LangGraph state machine if the flow needs branching and retries;
- human review statuses;
- Feishu chatbot API;
- exportable audit trail.

Example state flow:

```text
START
-> HotspotResearchAgent
-> FundDataAgent
-> EligibilityAgent
-> ScoringAgent
-> ExplanationAgent
-> ChannelMarketingAgent
-> ComplianceAgent
-> ReviewOrchestrator
-> React / Feishu output
```

## React App vs Feishu Chatbot

### React App

Best for detailed review:

- full evidence panel;
- score formulas;
- excluded funds;
- field source badges;
- copy editing;
- compliance review;
- export.

### Feishu Chatbot

Best for business workflow:

- "今天 AI 算力热点有什么基金可以看？"
- "生成一个招行客户经理话术。"
- "这只基金为什么被排除？"
- "导出审核稿。"

The chatbot should not invent answers. It should call backend APIs and return structured summaries.

## Suggested API Direction

Current:

```text
POST /api/run-campaign
```

Future:

```text
POST /api/agent/run-campaign
GET  /api/agent/runs/{run_id}
GET  /api/agent/runs/{run_id}/events
POST /api/feishu/events
POST /api/reviews/{run_id}/export
POST /api/reviews/{run_id}/approve
```

## Success Criteria

For a demo / defense, the project should prove:

```text
1. ✅ It is tied to a real business workflow. — Channel-specific marketing + channel fit analysis
2. ✅ It uses multiple agents with clear responsibilities. — 6 agents with defined boundaries
3. ✅ It does not blindly trust LLM output. — Data provenance badges on every field
4. ✅ It shows evidence and score formulas in the frontend. — FundEvidencePanel + scoring model
5. ✅ It has risk and compliance boundaries. — EligibilityAgent + ComplianceChecker
6. ✅ It can extend from React workbench to Feishu chatbot. — Backend complete, pending credentials
```

For production-readiness, it would still need:

```text
licensed / reliable data sources
official fund document validation
full suitability rules
formal compliance approval flow
access control
audit logs
monitoring
```
