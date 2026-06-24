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

These gaps affect trust immediately:

- no strict data-completeness gate;
- no suitability hard blocking;
- direct "recommended fund" wording still appears in UI;
- no `data_quality_score`;
- no `exclusion_reasons`;
- missing metrics are silently tolerated in ranking.

### P1 Gaps

These gaps affect professional quality:

- no fund-type bucketed scoring;
- no real stock-industry mapping data;
- no holding-weight-based industry exposure;
- recommendation explanations do not cite every supporting field;
- score formulas are not visible enough in the UI.

### P2 Gaps

These gaps affect product completeness:

- no formal multi-agent state machine;
- no LangGraph flow yet;
- no Feishu chatbot endpoint;
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

Already done or in progress:

- React + FastAPI MVP;
- DeepSeek LLM client;
- public fund data sync;
- SQLite fund pool;
- field source badges;
- score breakdown;
- bank-channel copy generation;
- basic compliance panel;
- review draft export;
- config-driven rules;
- optional stock industry mapping service;
- `/api/options` for frontend defaults.

### Milestone 1: P0 Trust Layer

Goal: make candidate ranking defensible.

Build:

- `EligibilityAgent` or eligibility service;
- `data_quality_score`;
- `exclusion_reasons`;
- hard risk suitability blocking;
- UI language change from "推荐基金" to "候选基金 / 系统初筛";
- separate "eligible candidates" and "excluded / data insufficient" sections.

Frontend should show:

```text
Data Quality: 78/100
Missing: fund_size, fee_rate, holding_weight
Blocked reason: risk level R4 is above conservative preference
Formula: performance_stability = base_score - volatility_penalty - drawdown_penalty - negative_return_penalty
```

### Milestone 2: P1 Professional Scoring

Goal: make scores closer to financial product research.

Build:

- category buckets: money market, bond, mixed, equity, index, QDII, FOF;
- same-category score normalization;
- stock-industry mapping table;
- holding-weight-based industry exposure when holdings weights are available;
- explanation text that references fields and sources.

Frontend should show:

```text
Compared within: Equity / technology-themed funds
Theme score came from: matched AI, semiconductor, computing-power tags
Risk score came from: volatility 26.1%, max drawdown -16.7%
Industry exposure source: mapped from top holding stock codes
```

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
1. It is tied to a real business workflow.
2. It uses multiple agents with clear responsibilities.
3. It does not blindly trust LLM output.
4. It shows evidence and score formulas in the frontend.
5. It has risk and compliance boundaries.
6. It can extend from React workbench to Feishu chatbot.
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
