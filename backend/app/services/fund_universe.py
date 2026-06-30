FUND_COMPANY_PREFIX = "易方达"
FUND_UNIVERSE_LABEL = "易方达自有基金池"


def is_in_fund_universe(fund_name: str) -> bool:
    return fund_name.strip().startswith(FUND_COMPANY_PREFIX)
