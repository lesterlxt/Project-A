import { AlertTriangle, Play, Settings2 } from "lucide-react";
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
        <CardTitle>
          <Settings2 size={17} className="text-primary" />
          分析参数
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          {/* Hotspot input */}
          <div className="space-y-2">
            <Label htmlFor="hotspot">市场热点</Label>
            <Input
              id="hotspot"
              value={hotspot}
              onChange={(event) =>
                onHotspotChange(event.target.value)
              }
              placeholder="输入热点主题..."
            />
            <p className="text-micro text-muted-foreground">
              可手动输入，也可在热点新闻面板选择今日主题
            </p>
          </div>

          {/* Channel */}
          <div className="space-y-2">
            <Label htmlFor="channel">银行渠道</Label>
            <Select
              id="channel"
              value={channel}
              onChange={(event) =>
                onChannelChange(event.target.value)
              }
              options={channels}
            />
          </div>

          {/* Risk & Fund Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="risk">风险偏好</Label>
              <Select
                id="risk"
                value={riskPreference}
                onChange={(event) =>
                  onRiskPreferenceChange(event.target.value)
                }
                options={riskPreferences}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fund-type">基金类型</Label>
              <Select
                id="fund-type"
                value={fundTypeFilter}
                onChange={(event) =>
                  onFundTypeFilterChange(event.target.value)
                }
                options={fundTypes}
              />
            </div>
          </div>

          {/* Top-K slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>候选数量</Label>
              <span className="text-h3 tabular-nums text-foreground">
                {topK}
                <span className="text-caption font-normal text-muted-foreground">
                  {" "}
                  只
                </span>
              </span>
            </div>
            <input
              className="w-full accent-primary"
              type="range"
              min="3"
              max="10"
              value={topK}
              onChange={(event) =>
                onTopKChange(Number(event.target.value))
              }
            />
            <div className="flex justify-between text-micro text-muted-foreground">
              <span>3</span>
              <span>10</span>
            </div>
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            size="lg"
            disabled={loading || !hotspot.trim()}
            type="submit"
          >
            <Play size={16} />
            {loading ? "分析中..." : "开始分析"}
          </Button>

          {/* Error */}
          {error && (
            <div className="flex gap-2 rounded-lg border border-danger/30 bg-danger-subtle p-3 text-caption leading-relaxed text-danger">
              <AlertTriangle
                size={15}
                className="mt-0.5 shrink-0"
              />
              <span>{error}</span>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
