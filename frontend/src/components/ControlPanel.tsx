import { AlertTriangle, Play, Sparkles } from "lucide-react";
import { FormEvent } from "react";
import { TodayHotspot } from "../api/campaignApi";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { cn } from "../lib/utils";

type Props = {
  hotspot: string;
  channel: string;
  riskPreference: string;
  fundTypeFilter: string;
  topK: number;
  channels: string[];
  riskPreferences: string[];
  fundTypes: string[];
  todayHotspots: TodayHotspot[];
  hotspotsLoading: boolean;
  updatedTime: string;
  loading: boolean;
  error: string;
  onHotspotChange: (value: string) => void;
  onChannelChange: (value: string) => void;
  onRiskPreferenceChange: (value: string) => void;
  onFundTypeFilterChange: (value: string) => void;
  onTopKChange: (value: number) => void;
  onSubmit: (event: FormEvent) => void;
};

export function ControlPanel({
  hotspot,
  channel,
  riskPreference,
  fundTypeFilter,
  topK,
  channels,
  riskPreferences,
  fundTypes,
  todayHotspots,
  hotspotsLoading,
  updatedTime,
  loading,
  error,
  onHotspotChange,
  onChannelChange,
  onRiskPreferenceChange,
  onFundTypeFilterChange,
  onTopKChange,
  onSubmit,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={18} />
          分析参数
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>市场热点</Label>
            <Input value={hotspot} onChange={(event) => onHotspotChange(event.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>今日热点 Top 5</Label>
              <span className="text-xs text-muted-foreground">{hotspotsLoading ? "加载中" : `更新 ${updatedTime}`}</span>
            </div>
            <div className="space-y-2">
              {todayHotspots.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  onClick={() => onHotspotChange(item.name)}
                  className={cn(
                    "flex min-h-10 w-full items-center justify-between gap-3 rounded-md border px-3 text-left text-sm transition-colors",
                    item.name === hotspot ? "border-primary bg-accent text-accent-foreground" : "border-border bg-background hover:bg-accent/60",
                  )}
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{item.heat_score}</span>
                </button>
              ))}
              {!hotspotsLoading && todayHotspots.length === 0 && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  未获取到真实热点，请检查网络或 DeepSeek 配置。
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>银行渠道</Label>
            <Select value={channel} onChange={(event) => onChannelChange(event.target.value)} options={channels} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>风险偏好</Label>
              <Select
                value={riskPreference}
                onChange={(event) => onRiskPreferenceChange(event.target.value)}
                options={riskPreferences}
              />
            </div>
            <div className="space-y-2">
              <Label>基金类型</Label>
              <Select
                value={fundTypeFilter}
                onChange={(event) => onFundTypeFilterChange(event.target.value)}
                options={fundTypes}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>推荐数量</Label>
              <span className="text-sm font-semibold">{topK}</span>
            </div>
            <input
              className="w-full accent-slate-800"
              type="range"
              min="3"
              max="10"
              value={topK}
              onChange={(event) => onTopKChange(Number(event.target.value))}
            />
          </div>

          <Button className="w-full" size="lg" disabled={loading || !hotspot.trim()}>
            <Play size={15} />
            {loading ? "分析中..." : "开始分析"}
          </Button>

          {error && (
            <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
