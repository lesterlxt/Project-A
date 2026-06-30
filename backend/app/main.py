import json
import os

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.agents.fund_data_agent import FundDataAgent
from app.agents.hotspot_agent import HotspotAgent
from app.orchestrator.graph_orchestrator import GraphOrchestrator
from app.services.fund_loader import FundLoader
from app.schemas import (
    AppOptionsResponse,
    CampaignRequest,
    CampaignResponse,
    CampaignStreamResponse,
    EFundSupermarketResponse,
    FundPoolStatusResponse,
    FundPoolSummaryResponse,
    FundSyncRequest,
    FundSyncResponse,
    HotspotAnalysisRequest,
    HotspotAnalysisResponse,
    MarketOverviewResponse,
    StockIndustryImportResponse,
    TodayHotspotsResponse,
)
from app.services.feishu_bot import get_feishu_bot
from app.services.stock_industry_importer import StockIndustryImporter
from app.services.efund_supermarket_service import EFundSupermarketService
from app.services.fund_data_provider import FundDataProviderError
from app.services.hotspot_provider import HotspotProviderError, NewsHotspotProvider
from app.services.llm_client import DeepSeekClient
from app.services.market_data_service import MarketDataService
from app.services.rule_config import load_rule_config

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: launch Feishu Bot WebSocket client."""
    bot = get_feishu_bot()
    if bot.is_configured:
        await bot.start()
    yield
    """Shutdown: stop Feishu Bot."""
    if bot.is_configured:
        await bot.stop()


app = FastAPI(
    title="Project A - AI Fund Marketing Platform",
    description="AI hotspot driven fund selection and marketing material generation MVP.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:5175", "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fund_loader = FundLoader()
hotspot_agent = HotspotAgent()
graph_orchestrator = GraphOrchestrator()
hotspot_provider = NewsHotspotProvider()
fund_data_agent = FundDataAgent()
market_data_service = MarketDataService()
efund_supermarket_service = EFundSupermarketService()
stock_industry_importer = StockIndustryImporter()
PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/llm-status")
def llm_status() -> dict[str, str | bool]:
    client = DeepSeekClient()
    return {
        "provider": "deepseek",
        "configured": client.is_configured,
        "model": client.model,
        "base_url": client.base_url,
    }


@app.get("/api/hotspots/today", response_model=TodayHotspotsResponse)
def today_hotspots() -> TodayHotspotsResponse:
    try:
        return hotspot_provider.today()
    except HotspotProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/funds/sync", response_model=FundSyncResponse)
def sync_funds(request: FundSyncRequest) -> FundSyncResponse:
    try:
        return fund_data_agent.sync(request)
    except FundDataProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/funds/status", response_model=FundPoolStatusResponse)
def fund_pool_status() -> FundPoolStatusResponse:
    return FundPoolStatusResponse(**fund_loader.status())


@app.get("/api/funds/summary", response_model=FundPoolSummaryResponse)
def fund_pool_summary() -> FundPoolSummaryResponse:
    return FundPoolSummaryResponse(**fund_loader.summary())


@app.get("/api/market/overview", response_model=MarketOverviewResponse)
def market_overview() -> MarketOverviewResponse:
    return market_data_service.overview()


@app.get("/api/efunds/supermarket", response_model=EFundSupermarketResponse)
def efund_supermarket() -> EFundSupermarketResponse:
    try:
        return efund_supermarket_service.snapshot()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"易方达官网基金超市接口不可用：{exc}") from exc


@app.get("/api/options", response_model=AppOptionsResponse)
def app_options() -> AppOptionsResponse:
    return AppOptionsResponse(**load_rule_config().options())


@app.post("/api/analyze-hotspot", response_model=HotspotAnalysisResponse)
def analyze_hotspot(request: HotspotAnalysisRequest) -> HotspotAnalysisResponse:
    return hotspot_agent.analyze(request.hotspot)


@app.post("/api/industry/refresh", response_model=StockIndustryImportResponse)
def refresh_stock_industry(force: bool = False) -> StockIndustryImportResponse:
    """Refresh real Shenwan industry classifications for all stock holdings in the fund pool."""
    result = stock_industry_importer.refresh(force=force)
    mapping_count = stock_industry_importer.mapper.count()
    return StockIndustryImportResponse(
        total_codes=result.total_codes,
        imported=result.imported,
        failed=result.failed,
        skipped=result.skipped,
        elapsed_seconds=result.elapsed_seconds,
        mapping_count=mapping_count,
        message=(
            f"股票行业映射刷新完成：本次新增 {result.imported} 条，"
            f"失败 {result.failed} 条，跳过 {result.skipped} 条（已存在），"
            f"当前总计 {mapping_count} 条映射记录。"
        ),
    )


@app.post("/api/run-campaign", response_model=CampaignResponse)
def run_campaign(request: CampaignRequest) -> CampaignResponse:
    """Run full pipeline via LangGraph (synchronous, backward-compatible)."""
    return graph_orchestrator.run_sync(request)


@app.post("/api/run-campaign/stream")
async def run_campaign_stream(request: CampaignRequest):
    """Run full pipeline via LangGraph with SSE progress events.

    Returns a text/event-stream of AgentEvent JSON lines,
    terminated by a final CampaignStreamResponse JSON line.
    """
    async def event_stream():
        async for chunk in graph_orchestrator.run_stream(request):
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Feishu Bot ─────────────────────────────────────────────────────────


@app.get("/api/feishu/status")
def feishu_bot_status() -> dict:
    """Check whether the Feishu Bot is configured and running."""
    bot = get_feishu_bot()
    status = bot.status()
    return {
        **status,
        "mode": "websocket",
        "app_id": (os.getenv("FEISHU_APP_ID", "")[:12] + "***") if bot.is_configured else "",
    }


@app.post("/api/feishu/event")
async def feishu_webhook(request: dict, background_tasks=None):
    """Optional HTTP webhook endpoint for Feishu event subscription.

    Use this only if you switch the Feishu app from WebSocket to HTTP webhook mode.
    In WebSocket mode this endpoint is not called.
    """
    from fastapi import BackgroundTasks

    # URL verification challenge
    if request.get("type") == "url_verification":
        return {"challenge": request.get("challenge", "")}

    # For now, webhook mode is not the primary path
    return {"status": "ok", "message": "WebSocket mode is recommended for local dev."}


# ── Demo frontend hosting ─────────────────────────────────────────────
#
# The packaged demo ships with frontend/dist and runs as a single FastAPI app.
# API routes stay under /api; everything else falls through to the React SPA.
if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found")
    if not FRONTEND_INDEX.exists():
        raise HTTPException(
            status_code=404,
            detail="frontend/dist is missing. Run `npm run build` in frontend first.",
        )
    return FileResponse(FRONTEND_INDEX)
