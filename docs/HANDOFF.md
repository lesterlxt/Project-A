# Project A Handoff

## Current Checkpoint (2026-06-25)

Two major features landed:

### 1. Real Stock-Industry Mapping (P1 data gap closed)

Replaced keyword-inferred industry allocation with real Shenwan (申万) industry classifications from Eastmoney F10 API.

- **New service**: `backend/app/services/stock_industry_importer.py` — batch-fetches industry data from `emweb.securities.eastmoney.com`
- **New endpoint**: `POST /api/industry/refresh` — manual refresh of industry mapping table
- **Integration**: Fund sync Phase 3 automatically refreshes industry mappings after enrichment
- **Result**: 342 real stock→industry mappings in `stock_industry_map` table, 82/85 enriched funds now use `source="mapped_from_stock_industry_map"` instead of `"keyword_inferred"`
- **Frontend**: `SourceBadge` now shows green "mapped" badge with "持仓代码行业映射" instead of yellow "inferred" with "规则推导"

### 2. Fund Detail Page — Business-First Redesign

Shifted from a technical "system output verification" page to a channel-marketing enablement tool.

- **New component**: `ChannelFitPanel.tsx` — three-dimension matching analysis (risk fit, client profile fit, product feature fit) derived from existing data
- **Rewritten**: `MarketingCopyPanel.tsx` (44→200+ lines) — 9 sections: selling points, RM script (with copy button), social post, long form, investor education, objection handling, channel strategy, risk disclosure
- **Rewritten**: `FundDetailPage.tsx` — business content first (marketing → channel fit → suitability), technical evidence collapsed by default
- **Backend**: Enhanced `CopywritingAgent` LLM prompt generates 3 new structured fields: `selling_points`, `investor_education`, `objection_handling`
- **New schema fields**: `MarketingCopy` now includes `selling_points: list[str]`, `investor_education: list[str]`, `objection_handling: list[ObjectionHandling]`

### Previous checkpoint (pre-analysis workbench cleanup)

- simplified the pre-analysis dashboard into a single vertical flow;
- moved hotspot/news content into the main workbench column;
- removed several AI-demo-style cards from the pre-analysis state;
- shifted the visual theme toward an E Fund-style blue and reduced heavy black text;
- added a real-data market and fund allocation reference table;
- added a read-only E Fund official fund supermarket sample module;
- hid the frontend "enhanced 99" implementation metric;
- added a business-facing fund-pool screening explanation;
- moved scoring formula metadata into backend `/api/options`;
- added backend try/catch + timeout wrapper for E Fund official page;
- reduced Card usage in pre-analysis dashboard;
- replaced 5 KPI cards in results page with a compact stats bar;
- simplified verbose explanatory text across the UI;
- confirmed no "推荐基金" wording remains in display text;
- restructured post-analysis results page with single-column layout;
- merged ScoreBreakdown into FundEvidencePanel;
- added react-router-dom URL routing;
- redesigned hotspot analysis data model as structured research brief;
- added Eastmoney news scraper as Google News RSS fallback.

## Data Sources

Fund pool:

```text
fund.eastmoney.com/js/fundcode_search.js
fund.eastmoney.com/pingzhongdata/{fund_code}.js
fundgz.1234567.com.cn/js/{fund_code}.js
local cache: backend/app/data/funds.db
```

Default screening logic:

```text
read public fund codes
-> apply configured theme keywords from recommendation_rules.json
-> keep first 3,000 matching funds in SQLite
-> enrich details in backend for manager, returns, holdings, and risk level
```

The enhanced-count metric is intentionally not shown in the frontend. It remains an internal data-processing detail and may appear only in backend logs.

Market overview:

```text
Eastmoney quote API for current index/market values
Tencent daily kline for A-share one-month performance
Yahoo Finance chart API for overseas/history fallback
```

If live data is unavailable, the frontend should show empty/error state and must not fabricate values.

E Fund official supermarket:

```text
https://www.efunds.com.cn/lm/jjcp/
```

The backend parses the page's embedded `__FUND_SUPER_MARKET_DATA__` payload and returns a small read-only sample. This is a product-reference module, not a trading/purchase UI.

## Key Files

Backend:

```text
backend/app/main.py                          # 14 API endpoints
backend/app/schemas.py                       # All Pydantic models
backend/app/agents/copywriting_agent.py      # Enhanced LLM prompt for channel-specific marketing
backend/app/agents/eligibility_agent.py      # Data quality + suitability gates
backend/app/agents/fund_category_agent.py    # Fund type classification
backend/app/agents/hotspot_agent.py          # Structured research brief generation
backend/app/orchestrator/campaign_orchestrator.py  # Linear pipeline
backend/app/services/fund_data_provider.py   # Eastmoney sync + industry mapping trigger
backend/app/services/stock_industry_importer.py    # NEW: Shenwan industry import from F10 API
backend/app/services/stock_industry_mapper.py      # UPDATED: bulk import + known_codes + count
backend/app/services/fund_loader.py          # SQLite fund pool reader
backend/app/services/fund_scorer.py          # Multi-dimensional scoring with category ranking
backend/app/services/market_data_service.py  # Live market quotes
backend/app/services/efund_supermarket_service.py
backend/app/services/hotspot_provider.py     # Google News RSS + Eastmoney fallback
backend/app/services/compliance.py           # Banned terms scanning
backend/app/services/rule_config.py          # Centralized configuration
```

Frontend:

```text
frontend/src/pages/CampaignWorkbench.tsx     # Main workbench
frontend/src/pages/FundDetailPage.tsx        # REWRITTEN: business-first channel promotion page
frontend/src/context/CampaignContext.tsx     # Context + sessionStorage persistence
frontend/src/components/MarketingCopyPanel.tsx     # REWRITTEN: 9-section rich marketing content
frontend/src/components/ChannelFitPanel.tsx        # NEW: 3-dimension channel fit analysis
frontend/src/components/FundEvidencePanel.tsx      # Technical evidence (collapsed in detail page)
frontend/src/components/FundRankingTable.tsx       # Candidate fund list
frontend/src/components/ExcludedFundsPanel.tsx     # Excluded fund samples
frontend/src/components/PreAnalysisDashboard.tsx   # Pre-analysis view
frontend/src/components/FundMarketOverviewTable.tsx
frontend/src/components/EFundSupermarketTable.tsx
frontend/src/components/FundPoolStatusCard.tsx
frontend/src/components/CompliancePanel.tsx
frontend/src/components/ReviewActions.tsx
frontend/src/api/campaignApi.ts                    # UPDATED: new MarketingCopy types
```

Docs:

```text
README.md
docs/PROJECT_CONTEXT.md
docs/ROADMAP.md
docs/HANDOFF.md
```

## Verification

Run these after pulling the branch:

```bash
python -m compileall backend/app
cd frontend
npm run build
```

Optional live checks require backend/frontend dev servers and network access:

```bash
curl http://127.0.0.1:8000/api/market/overview
curl http://127.0.0.1:8000/api/efunds/supermarket
curl http://127.0.0.1:8000/api/options
curl -X POST http://127.0.0.1:8000/api/industry/refresh         # refresh industry mappings
```

## Next Work

Best next steps:

1. Import fund holding-weight data (`fund_holdings` table) for accurate industry exposure calculation (table schema ready, data import still needed).
2. Add more fund data fields (fund size, fee rate, Sharpe/Calmar ratio, manager tenure).
3. Start Feishu chatbot integration — the React workflow and evidence fields are now stable.
4. Same-category score normalization for more defensible within-group rankings.
5. Multi-agent orchestration (event logs, agent contracts) → LangGraph state machine.
6. Human review workflow with persistent audit trail.
