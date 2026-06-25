import { createContext, useContext, useMemo } from "react";
import type { AppOptions, CampaignResponse, TodayHotspot } from "../api/campaignApi";

const STORAGE_KEY = "project_a_campaign";

export type CampaignContextValue = {
  result: CampaignResponse | null;
  options: AppOptions | null;
  selectedHotspot: TodayHotspot | undefined;
  riskPreference: string;
};

export function loadFromStorage(): CampaignContextValue | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.result) return parsed as CampaignContextValue;
  } catch {
    // ignore parse errors
  }
  return null;
}

export function saveToStorage(value: CampaignContextValue) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function clearStorage() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const CampaignContext = createContext<CampaignContextValue>({
  result: null,
  options: null,
  selectedHotspot: undefined,
  riskPreference: "平衡型",
});

export function useCampaignContext(): CampaignContextValue {
  const ctx = useContext(CampaignContext);
  return useMemo(() => {
    if (ctx.result) return ctx;
    // Fallback: read from sessionStorage if context is empty (page refresh / direct URL)
    const stored = loadFromStorage();
    if (stored) return stored;
    return ctx;
  }, [ctx]);
}
