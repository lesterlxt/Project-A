# Project A Handoff

## Current Checkpoint (2026-06-27)

Three major data credibility improvements landed:

### 1. Fund Holdings Weight Data (new)

Created `fund_holdings` table and imported real holding weights from Eastmoney API.

- **New table**: `fund_holdings(fund_code, stock_code, stock_name, holding_weight, report_date, source, updated_at)`
- **Data source**: Extracted from `Data_fundSharesPositions` variable in `pingzhongdata/{code}.js`
- **Fallback**: If `Data_fundSharesPositions` is not available in the API response, holding weights are empty (explicitly missing, not fabricated)
- **Indexes**: `fund_code`, `stock_code`, `(fund_code, report_date)`
- **Integration**: Fund sync Phase 2 enrichment writes holdings to DB; sync re-runs will upsert

### 2. Weight-Based Industry Exposure (replaces count-based)

Industry allocation now prefers real holding-weight aggregation over counting stocks.

- **New method**: `StockIndustryMapper.aggregate_by_holding_weight()` — joins `fund_holdings` with `stock_industry_map`, sums by `holding_weight`
- **Source markers**:
  - `mapped_from_holding_weight` — weight-based (high confidence, green "持仓权重映射" badge)
  - `mapped_from_holding_count` — count-based fallback (medium confidence, yellow "持仓数量映射，仅供参考" badge)
  - `keyword_inferred` — keyword fallback (low confidence, yellow "规则推导" badge)
- **Scoring**: `holding_match` multiplied by 0.5 when using count or keyword sources; 0 when industry data is missing
- **Frontend**: Clear distinction between weight-based and count-based industry data; count fallback shows warning text

### 3. Extended Fund Fields & Risk Level Source Tracking

Added fund metadata fields and risk level provenance.

- **New fund fields**: `fund_size`, `inception_date`, `management_fee`, `custody_fee`, `sales_service_fee`, `official_risk_level`, `manager_tenure`, `sharpe_ratio`, `calmar_ratio`, `peer_rank`
- **Risk level source**: `risk_level_source` field with values `"official"` or `"inferred_from_fund_type"`
- **Data availability**: Fields extracted from pingzhongdata where available; set to empty string when API doesn't return them
- **Sharpe/Calmar/peer_rank**: Currently always empty — require additional data source integration

### Previous checkpoint (pre-analysis workbench cleanup)

- simplified the pre-analysis dashboard into a single vertical flow;
- moved hotspot/news content into the main workbench column;
- removed several AI-demo-style cards from the pre-analysis state;
- shifted the visual theme toward an E Fund-style blue and reduced heavy black text;
- added a real-data market and fund allocation reference table;
- added an E Fund official fund supermarket reference module;
- narrowed the campaign candidate universe to E Fund-owned products only;
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
fund universe: 易方达自有基金池
```

Default screening logic:

```text
read public fund codes
-> force fund names beginning with 易方达
-> keep matching E Fund-owned products in SQLite
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

1. **Re-sync fund pool** to populate `fund_holdings` with real weight data and the new fund metadata fields:
   ```bash
   curl -X POST http://127.0.0.1:8000/api/funds/sync \
     -H "Content-Type: application/json" \
     -d '{"limit": 1000, "enrich_limit": 500, "keywords": ["易方达"]}'
   ```
2. Same-category score normalization for more defensible within-group rankings.
3. Start Feishu chatbot integration — the React workflow and evidence fields are now stable.
4. Multi-agent orchestration (event logs, agent contracts) → LangGraph state machine.
5. Human review workflow with persistent audit trail.
6. Sharpe/Calmar ratio data — requires additional data source (e.g., Tiantian Fund API).
