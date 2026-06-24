import { AlertTriangle, Play, Sparkles } from "lucide-react";
import { FormEvent } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";

type Props = {
  hotspot: string;
  channel: string;
  riskPreference: string;
  fundTypeFilter: string;
  topK: number;
  channels: string[];
  riskPreferences: string[];
  fundTypes: string[];
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
            <p className="text-xs leading-5 text-muted-foreground">
              可手动输入，也可在右侧热点新闻面板选择今日主题。
            </p>
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
              <Label>候选数量</Label>
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
