import { createContext, useContext } from "react";
import type { AppOptions, CampaignResponse, TodayHotspot } from "../api/campaignApi";

export type CampaignContextValue = {
  result: CampaignResponse | null;
  options: AppOptions | null;
  selectedHotspot: TodayHotspot | undefined;
  riskPreference: string;
};

export const CampaignContext = createContext<CampaignContextValue>({
  result: null,
  options: null,
  selectedHotspot: undefined,
  riskPreference: "平衡型",
});

export function useCampaignContext() {
  return useContext(CampaignContext);
}
