# Project A Handoff

## Current Checkpoint

This checkpoint focuses on making the pre-analysis workbench cleaner and more defensible for a fund-company / bank-channel sales support demo.

Implemented in this branch:

- simplified the pre-analysis dashboard into a single vertical flow;
- moved hotspot/news content into the main workbench column;
- removed several AI-demo-style cards from the pre-analysis state;
- shifted the visual theme toward an E Fund-style blue and reduced heavy black text;
- added a real-data market and fund allocation reference table;
- added a read-only E Fund official fund supermarket sample module;
- hid the frontend "enhanced 99" implementation metric;
- added a business-facing fund-pool screening explanation;
- moved scoring formula metadata into backend `/api/options`;
- added backend try/catch + timeout wrapper for E Fund official page (returns empty items on failure, frontend shows empty state);
- reduced Card usage in pre-analysis dashboard (HotspotNewsPanel and FundPoolStructurePanel now use section headings instead of Card wrappers);
- replaced 5 KPI cards in results page with a compact stats bar;
- simplified verbose explanatory text in table headers, footers, and market interpretation;
- removed "右侧" directional reference from ControlPanel for responsive layout;
- confirmed no "推荐基金" wording remains in display text (API field names unchanged for compatibility);
- restructured post-analysis results page: removed Card wrappers from ReviewActions, ExcludedFundsPanel, MarketingCopyPanel, CompliancePanel, HotspotAnalysisCard, FundEvidencePanel, and Suitability sections;
- merged ScoreBreakdown into FundEvidencePanel (deleted standalone ScoreBreakdown.tsx);
- FundEvidencePanel rewritten from 181-line nested Card+border-boxes to clean section with compact key-value rows;
- changed results layout from 2-column asymmetrical grid to single-column vertical flow with space-y-8;
- simplified FundRankingTable right-side info density (4 rows → 2 rows);
- HotspotAnalysisCard extracted from CampaignWorkbench inline to standalone section;
- added react-router-dom with URL-based state tracking: `/` for pre-analysis, `/?tab=result&fund=CODE` for results list, `/fund/:fundCode` for single-fund detail;
- created FundDetailPage at `/fund/:fundCode` showing FundEvidencePanel, MarketingCopyPanel, and Suitability for a single fund;
- removed FundEvidencePanel, MarketingCopyPanel, Suitability from results list page — results now only shows FundRankingTable + HotspotAnalysis + ReviewActions;
- changed market data refresh interval from 30s to 5 minutes (backend + frontend).

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
backend/app/main.py
backend/app/schemas.py
backend/app/services/market_data_service.py
backend/app/services/efund_supermarket_service.py
backend/app/services/fund_data_provider.py
backend/app/services/rule_config.py
```

Frontend:

```text
frontend/src/pages/CampaignWorkbench.tsx
frontend/src/pages/FundDetailPage.tsx
frontend/src/context/CampaignContext.tsx
frontend/src/components/PreAnalysisDashboard.tsx
frontend/src/components/FundMarketOverviewTable.tsx
frontend/src/components/EFundSupermarketTable.tsx
frontend/src/components/FundPoolStatusCard.tsx
frontend/src/components/FundEvidencePanel.tsx
frontend/src/components/FundRankingTable.tsx
frontend/src/components/ExcludedFundsPanel.tsx
frontend/src/components/MarketingCopyPanel.tsx
frontend/src/components/CompliancePanel.tsx
frontend/src/components/ReviewActions.tsx
frontend/src/components/AgentPipelineStatus.tsx
frontend/src/api/campaignApi.ts
frontend/src/styles.css
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
```

## Next Work

Best next steps for the next agent:

1. Decide whether the E Fund official supermarket sample should stay as a reference module or be joined with the local fund pool.
2. Add more complete fund holding-weight data and real stock-industry mapping for accurate industry exposure calculation.
3. Start Feishu chatbot integration only after the current React workflow and evidence fields are stable.
4. Improve mobile layout for data tables (currently use horizontal scroll with min-width).
5. Continue strengthening data quality rules and eligibility filtering in the backend.
6. Consider merging AnalysisConfigPreview into the page header area for even fewer visual containers.
