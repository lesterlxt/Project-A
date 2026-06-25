import {
  Activity,
  Newspaper,
  PieChart,
  ShieldCheck,
  Target,
} from "lucide-react";
import { EFundSupermarketResponse, FundPoolSummary, MarketOverviewResponse, TodayHotspot } from "../api/campaignApi";
import { cn } from "../lib/utils";
import { EFundSupermarketTable } from "./EFundSupermarketTable";
import { FundMarketOverviewTable } from "./FundMarketOverviewTable";
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
    <div className="space-y-8">
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
      <FundMarketOverviewTable data={marketOverview} loading={marketLoading} error={marketError} />
      <EFundSupermarketTable data={efundSupermarket} loading={efundLoading} error={efundError} />
      <FundPoolStructurePanel summary={fundSummary} />
      <ComplianceReminder />
    </div>
  );
}

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
    ["客户风险", `${riskPreferenceCode(riskPreference)} ${riskPreference}`],
    ["可匹配风险", allowedRiskLevels(riskPreference)],
    ["基金类型", fundTypeFilter === "全部" ? "全市场公募基金池" : fundTypeFilter],
    ["候选数量", `${topK} 只`],
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Target size={18} />
          本次分析配置
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(([label, value]) => (
            <ConfigItem key={label} label={label} value={value} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

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
    <section>
      <SectionHeading icon={Newspaper} title="热点新闻" badge="Top 5" />
      <p className="mb-3 text-xs leading-5 text-muted-foreground">
        来源：Google News RSS / 东方财富财经新闻；DeepSeek 提炼热点。
      </p>
      {loading && <EmptyState text="正在加载今日热点。" />}
      {!loading && hotspots.length === 0 && <EmptyState text="所有新闻源暂不可用，请手动输入热点主题。" />}
      {hotspots.length > 0 && (
        <div className="divide-y rounded-md border">
          {hotspots.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => onSelect(item.name)}
              className={cn(
                "w-full px-4 py-3 text-left transition-colors hover:bg-accent/40",
                selectedName === item.name && "bg-accent/60",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{item.name}</div>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                  {(item.evidence_headlines?.length ?? 0) > 0 && (
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {item.evidence_headlines[0].source}：{item.evidence_headlines[0].title}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">热度 {item.heat_score}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function FundPoolStructurePanel({ summary }: { summary: FundPoolSummary | null }) {
  return (
    <section>
      <SectionHeading icon={PieChart} title="基金池结构" />
      <div className="grid gap-8 lg:grid-cols-2 rounded-md border p-5">
        <DistributionList
          icon={PieChart}
          title="基金类型"
          items={summary?.fund_type_distribution ?? []}
          emptyText="暂无基金类型统计，请先同步真实基金池。"
        />
        <DistributionList
          icon={Activity}
          title="风险等级"
          items={summary?.risk_level_distribution ?? []}
          emptyText="暂无风险等级统计，请先同步真实基金池。"
        />
      </div>
    </section>
  );
}

function DistributionList({
  icon: Icon,
  title,
  items,
  emptyText,
}: {
  icon: typeof PieChart;
  title: string;
  items: { label: string; count: number }[];
  emptyText: string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Icon size={16} />
        {title}
      </div>
      <div className="space-y-2">
        {items.length === 0 && <EmptyState text={emptyText} />}
        {items.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-muted-foreground">{item.label}</span>
              <strong>{item.count.toLocaleString("zh-CN")}</strong>
            </div>
            <div className="h-1.5 rounded-full bg-secondary">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComplianceReminder() {
  return (
    <div className="rounded-md border bg-card p-4 text-sm leading-6 text-muted-foreground">
      <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
        <ShieldCheck size={16} />
        分析边界
      </div>
      候选基金不等于投资建议，AI 生成内容需要人工复核；市场行情和基金池统计均来自公开接口，接口不可用时不展示编造数据。
    </div>
  );
}

function SectionHeading({ icon: Icon, title, badge }: { icon: typeof Target; title: string; badge?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={17} className="text-muted-foreground" />
      <h2 className="text-base font-semibold">{title}</h2>
      {badge && <span className="text-xs text-muted-foreground">{badge}</span>}
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b pb-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border bg-background p-3 text-sm leading-6 text-muted-foreground">{text}</div>;
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
