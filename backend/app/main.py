from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.agents.fund_data_agent import FundDataAgent
from app.orchestrator.campaign_orchestrator import CampaignOrchestrator
from app.schemas import AppOptionsResponse, CampaignRequest, CampaignResponse, FundPoolStatusResponse, FundPoolSummaryResponse, FundSyncRequest, FundSyncResponse, HotspotAnalysisRequest, HotspotAnalysisResponse, TodayHotspotsResponse
from app.services.fund_data_provider import FundDataProviderError
from app.services.hotspot_provider import HotspotProviderError, NewsHotspotProvider
from app.services.llm_client import DeepSeekClient
from app.services.rule_config import load_rule_config

app = FastAPI(
    title="Project A - AI Fund Marketing Platform",
    description="AI hotspot driven fund selection and marketing material generation MVP.",
    version="0.1.0",
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

orchestrator = CampaignOrchestrator()
hotspot_provider = NewsHotspotProvider()
fund_data_agent = FundDataAgent()


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
    return FundPoolStatusResponse(**orchestrator.fund_loader.status())


@app.get("/api/funds/summary", response_model=FundPoolSummaryResponse)
def fund_pool_summary() -> FundPoolSummaryResponse:
    return FundPoolSummaryResponse(**orchestrator.fund_loader.summary())


@app.get("/api/options", response_model=AppOptionsResponse)
def app_options() -> AppOptionsResponse:
    return AppOptionsResponse(**load_rule_config().options())


@app.post("/api/analyze-hotspot", response_model=HotspotAnalysisResponse)
def analyze_hotspot(request: HotspotAnalysisRequest) -> HotspotAnalysisResponse:
    return orchestrator.analyze_hotspot(request.hotspot)


@app.post("/api/run-campaign", response_model=CampaignResponse)
def run_campaign(request: CampaignRequest) -> CampaignResponse:
    return orchestrator.run(request)
