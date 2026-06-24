from app.schemas import FundSyncRequest, FundSyncResponse
from app.services.fund_data_provider import EastmoneyFundDataProvider


class FundDataAgent:
    def __init__(self) -> None:
        self.provider = EastmoneyFundDataProvider()

    def sync(self, request: FundSyncRequest) -> FundSyncResponse:
        return self.provider.sync(limit=request.limit, enrich_limit=request.enrich_limit, keywords=request.keywords)
