import {
  Activity,
  Newspaper,
  PieChart,
  ShieldCheck,
  Target,
} from "lucide-react";
import {
  EFundSupermarketResponse,
  FundPoolSummary,
  MarketOverviewResponse,
  TodayHotspot,
} from "../api/campaignApi";
import { cn } from "../lib/utils";
import { EFundSupermarketTable } from "./EFundSupermarketTable";
import { FundMarketOverviewTable } from "./FundMarketOverviewTable";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type Props = {
  hotspot: string;
  channel: string;
  riskPreference: string;
  fundTypeFilter: string;
  topK: number;
  todayHotspots: TodayHotspot[];
  hotspotsLoading: boolean;
  fundSummary: FundPoolSummary | null;
  marketOverview: MarketOverviewResponse | null;
  marketLoading: boolean;
  marketError: string;
  efundSupermarket: EFundSupermarketResponse | null;
  efundLoading: boolean;
  efundError: string;
  onHotspotSelect: (value: string) => void;
};

export function PreAnalysisDashboard({
  hotspot,
  channel,
  riskPreference,
  fundTypeFilter,
  topK,
  todayHotspots,
  hotspotsLoading,
  fundSummary,
  marketOverview,
  marketLoading,
  marketError,
  efundSupermarket,
  efundLoading,
  efundError,
  onHotspotSelect,
}: Props) {
  return (
    <div className="animate-fade-in space-y-8">
      <AnalysisConfigPreview
        hotspot={hotspot}
        channel={channel}
        riskPreference={riskPreference}
        fundTypeFilter={fundTypeFilter}
        topK={topK}
      />
      <HotspotNewsPanel
        hotspots={todayHotspots}
        selectedName={hotspot}
        loading={hotspotsLoading}
        onSelect={onHotspotSelect}
      />
      <FundMarketOverviewTable
        data={marketOverview}
        loading={marketLoading}
        error={marketError}
      />
      <EFundSupermarketTable
        data={efundSupermarket}
        loading={efundLoading}
        error={efundError}
      />
      <FundPoolStructurePanel summary={fundSummary} />
      <ComplianceReminder />
    </div>
  );
}

/* ── Analysis Config Preview ── */
function AnalysisConfigPreview({
  hotspot,
  channel,
  riskPreference,
  fundTypeFilter,
  topK,
}: {
  hotspot: string;
  channel: string;
  riskPreference: string;
  fundTypeFilter: string;
  topK: number;
}) {
  const items = [
    ["分析主题", hotspot || "待输入"],
    ["银行渠道", channel],
    [
      "客户风险",
      `${riskPreferenceCode(riskPreference)} ${riskPreference}`,
    ],
    ["可匹配风险", allowedRiskLevels(riskPreference)],
    [
      "基金类型",
      fundTypeFilter === "全部"
        ? "全市场公募基金池"
        : fundTypeFilter,
    ],
    ["候选数量", `${topK} 只`],
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>
          <Target size={17} className="text-primary" />
          本次分析配置
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(([label, value]) => (
            <div
              key={label}
              className="flex flex-col gap-1 rounded-lg bg-background px-3 py-2.5"
            >
              <span className="text-micro text-muted-foreground">
                {label}
              </span>
              <span className="text-caption font-semibold">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Hotspot News Panel ── */
function HotspotNewsPanel({
  hotspots,
  selectedName,
  loading,
  onSelect,
}: {
  hotspots: TodayHotspot[];
  selectedName: string;
  loading: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>
            <Newspaper size={17} className="text-primary" />
            热点新闻
          </CardTitle>
          <Badge variant="info" size="sm">
            Top {hotspots.length || 5}
          </Badge>
        </div>
        <p className="text-caption text-muted-foreground">
          来源：Google News RSS / 东方财富财经新闻；DeepSeek 提炼热点
        </p>
      </CardHeader>
      <CardContent>
        {loading && (
          <EmptyState text="正在加载今日热点..." />
        )}
        {!loading && hotspots.length === 0 && (
          <EmptyState text="所有新闻源暂不可用，请手动输入热点主题。" />
        )}
        {hotspots.length > 0 && (
          <div className="divide-y rounded-lg border">
            {hotspots.map((item) => {
              const isSelected = selectedName === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onSelect(item.name)}
                  className={cn(
                    "w-full px-4 py-3.5 text-left transition-all duration-200",
                    isSelected
                      ? "bg-primary-subtle"
                      : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-body font-semibold">
                        {item.name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-caption leading-relaxed text-muted-foreground">
                        {item.summary}
                      </p>
                      {(item.evidence_headlines?.length ?? 0) > 0 && (
                        <p className="mt-1 line-clamp-1 text-micro text-muted-foreground">
                          {item.evidence_headlines[0].source}：
                          {item.evidence_headlines[0].title}
                        </p>
                      )}
                    </div>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-micro font-medium text-muted-foreground">
                      热度 {item.heat_score}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Fund Pool Structure ── */
function FundPoolStructurePanel({
  summary,
}: {
  summary: FundPoolSummary | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>
          <PieChart size={17} className="text-primary" />
          基金池结构
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <DistributionList
            title="基金类型"
            items={
              summary?.fund_type_distribution ?? []
            }
            emptyText="暂无基金类型统计，请先同步真实基金池。"
            color="primary"
          />
          <DistributionList
            title="风险等级"
            items={
              summary?.risk_level_distribution ?? []
            }
            emptyText="暂无风险等级统计，请先同步真实基金池。"
            color="gold"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function DistributionList({
  title,
  items,
  emptyText,
  color,
}: {
  title: string;
  items: { label: string; count: number }[];
  emptyText: string;
  color: "primary" | "gold";
}) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <div>
      <h3 className="mb-3 text-h3">{title}</h3>
      {items.length === 0 && <EmptyState text={emptyText} />}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-caption">
              <span className="truncate text-muted-foreground">
                {item.label}
              </span>
              <strong className="tabular-nums">
                {item.count.toLocaleString("zh-CN")}
              </strong>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className={cn(
                  "h-2 rounded-full transition-all duration-500",
                  color === "primary" ? "bg-primary" : "bg-gold",
                )}
                style={{
                  width: `${Math.max((item.count / max) * 100, 4)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Compliance Reminder ── */
function ComplianceReminder() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-2 flex items-center gap-2 text-h3">
        <ShieldCheck size={17} className="text-muted-foreground" />
        分析边界
      </div>
      <p className="text-caption leading-relaxed text-muted-foreground">
        候选基金不等于投资建议，AI 生成内容需要人工复核；市场行情和基金池统计均来自公开接口，接口不可用时不展示编造数据。
      </p>
    </div>
  );
}

/* ── Helpers ── */
function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-4 text-caption text-muted-foreground">
      {text}
    </div>
  );
}

function riskPreferenceCode(value: string) {
  if (value.includes("稳健")) return "C2";
  if (value.includes("进取")) return "C4";
  return "C3";
}

function allowedRiskLevels(value: string) {
  if (value.includes("稳健")) return "R1 - R2";
  if (value.includes("进取")) return "R1 - R5";
  return "R1 - R3";
}
