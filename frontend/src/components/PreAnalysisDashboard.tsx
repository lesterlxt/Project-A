import {
  Activity,
  BarChart3,
  Bot,
  CheckCircle2,
  Database,
  FileCheck2,
  FileText,
  Filter,
  Gauge,
  Megaphone,
  Newspaper,
  PieChart,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { FundPoolStatus, FundPoolSummary, TodayHotspot } from "../api/campaignApi";
import { cn } from "../lib/utils";
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
  updatedTime: string;
  fundStatus: FundPoolStatus | null;
  fundSummary: FundPoolSummary | null;
  onHotspotSelect: (value: string) => void;
};

const agentSteps = [
  { icon: Newspaper, title: "热点识别 Agent", text: "提取新闻证据、主题标签和风险点" },
  { icon: Filter, title: "基金筛选 Agent", text: "按主题、类型和数据完整度初筛基金池" },
  { icon: ShieldCheck, title: "风险适配 Agent", text: "校验客户风险偏好与产品风险等级" },
  { icon: BarChart3, title: "评分排序 Agent", text: "计算主题、持仓、风险和渠道匹配分" },
  { icon: Megaphone, title: "文案生成 Agent", text: "生成渠道话术、社媒文案和推介材料" },
  { icon: FileCheck2, title: "合规审查 Agent", text: "检查保本、收益承诺和风险错配表达" },
];

const scoringItems = [
  { label: "收益表现", text: "近一年收益、同类比较" },
  { label: "风险控制", text: "最大回撤、年化波动率" },
  { label: "稳定性", text: "数据完整度、表现稳定性" },
  { label: "主题匹配", text: "热点标签、行业配置、产品定位" },
  { label: "适当性", text: "客户偏好与 R1-R5 风险等级" },
  { label: "合规过滤", text: "收益承诺、保本、风险错配检查" },
];

const outputItems = [
  { icon: Database, label: "候选基金清单", text: "代码、名称、类型、风险等级、收益、回撤、波动率和综合评分" },
  { icon: Target, label: "推荐理由", text: "解释基金与热点、渠道和客户风险偏好的匹配依据" },
  { icon: Gauge, label: "风险提示", text: "展示主题风险、产品风险、波动风险和适当性边界" },
  { icon: Megaphone, label: "渠道文案", text: "生成客户经理话术、社媒文案和渠道营销建议" },
  { icon: FileCheck2, label: "合规检查", text: "检查保本、收益承诺、夸大宣传和风险等级错配" },
];

export function PreAnalysisDashboard({
  hotspot,
  channel,
  riskPreference,
  fundTypeFilter,
  topK,
  todayHotspots,
  hotspotsLoading,
  updatedTime,
  fundStatus,
  fundSummary,
  onHotspotSelect,
}: Props) {
  const selectedHotspot = todayHotspots.find((item) => item.name === hotspot) ?? todayHotspots[0];
  const enrichedRatio = ratio(fundStatus?.enriched_count ?? 0, fundStatus?.total_count ?? 0);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-4">
        <StatusCard
          icon={Database}
          label="基金池"
          value={formatCount(fundStatus?.total_count ?? 0)}
          detail={fundStatus?.available ? "SQLite 已加载" : "等待同步真实基金池"}
          variant={fundStatus?.available ? "success" : "warning"}
        />
        <StatusCard
          icon={Newspaper}
          label="热点主题"
          value={hotspotsLoading ? "加载中" : `${todayHotspots.length} 个`}
          detail="Google News RSS + DeepSeek"
          variant="info"
        />
        <StatusCard icon={Target} label="渠道场景" value={channel} detail={`${riskPreference}客户`} variant="muted" />
        <StatusCard icon={ShieldCheck} label="合规规则" value="已启用" detail="收益承诺 / 保本 / 风险错配检查" variant="warning" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">Pre-analysis Dashboard</Badge>
                    <Badge variant="success">真实接口</Badge>
                    <Badge variant="warning">AI生成需复核</Badge>
                  </div>
                  <CardTitle className="text-2xl leading-tight">基金智能选品工作台</CardTitle>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    选择左侧参数后，系统将生成候选基金、推荐理由、渠道文案与合规检查结果。当前页只展示分析前状态、数据来源和方法边界。
                  </p>
                </div>
                <div className="rounded-md border bg-background px-3 py-2 text-right">
                  <div className="text-xs text-muted-foreground">热点更新</div>
                  <div className="mt-1 font-semibold">{updatedTime}</div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <section className="grid gap-5 lg:grid-cols-2">
            <AnalysisConfigPreview
              hotspot={hotspot}
              channel={channel}
              riskPreference={riskPreference}
              fundTypeFilter={fundTypeFilter}
              topK={topK}
            />
            <AgentWorkflowPreview />
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <HeatScoreChart hotspots={todayHotspots} loading={hotspotsLoading} selectedName={hotspot} onSelect={onHotspotSelect} />
            <FundReadinessPanel status={fundStatus} enrichedRatio={enrichedRatio} />
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <DistributionPanel
              icon={PieChart}
              title="基金类型分布"
              source="SQLite 基金池真实统计"
              items={fundSummary?.fund_type_distribution ?? []}
            />
            <DistributionPanel
              icon={Activity}
              title="风险等级分布"
              source="基金池风险等级字段 / 规则推导"
              items={fundSummary?.risk_level_distribution ?? []}
            />
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <ScoringModelIntro />
            <OutputPreviewPanel />
          </section>

          <ComplianceReminder />
        </div>

        <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <HotspotNewsPanel
            hotspots={todayHotspots}
            selectedName={hotspot}
            loading={hotspotsLoading}
            onSelect={onHotspotSelect}
          />
          <HotThemePreviewCard hotspot={selectedHotspot} />
        </div>
      </section>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
  variant,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  detail: string;
  variant: "success" | "info" | "warning" | "muted";
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-md bg-secondary p-2 text-primary">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{label}</span>
            <Badge variant={variant}>{variant === "success" ? "就绪" : variant === "warning" ? "需复核" : "实时"}</Badge>
          </div>
          <div className="mt-2 truncate text-xl font-semibold">{value}</div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
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
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Target size={18} />
          本次分析配置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ConfigRow label="分析主题" value={hotspot || "待输入"} />
        <ConfigRow label="银行渠道" value={channel} />
        <ConfigRow label="客户风险偏好" value={`${riskPreferenceCode(riskPreference)} ${riskPreference}`} />
        <ConfigRow label="可匹配风险等级" value={allowedRiskLevels(riskPreference)} />
        <ConfigRow label="基金类型" value={fundTypeFilter === "全部" ? "全市场公募基金池" : fundTypeFilter} />
        <ConfigRow label="候选基金数量" value={`${topK} 只`} />
      </CardContent>
    </Card>
  );
}

function AgentWorkflowPreview() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bot size={18} />
          多 Agent 工作流
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {agentSteps.map((step) => (
          <div key={step.title} className="rounded-md border bg-background p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <step.icon size={15} className="shrink-0 text-primary" />
                <span className="truncate text-sm font-medium">{step.title}</span>
              </div>
              <Badge variant="muted">待运行</Badge>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{step.text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function HeatScoreChart({
  hotspots,
  loading,
  selectedName,
  onSelect,
}: {
  hotspots: TodayHotspot[];
  loading: boolean;
  selectedName: string;
  onSelect: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={18} />
            今日热点热度
          </CardTitle>
          <Badge variant="info">Google News RSS</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <EmptyState text="正在读取真实新闻标题并提炼热点。" />}
        {!loading && hotspots.length === 0 && <EmptyState text="未获取到真实热点，请检查网络或 DeepSeek 配置。" />}
        {hotspots.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => onSelect(item.name)}
            className={cn(
              "w-full rounded-md border bg-background p-3 text-left transition-colors hover:bg-accent/60",
              selectedName === item.name && "border-primary bg-accent",
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium">{item.name}</span>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold">{item.heat_score}</span>
            </div>
            <div className="h-2 rounded-full bg-secondary">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(item.heat_score, 4)}%` }} />
            </div>
            <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{item.summary}</p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function FundReadinessPanel({ status, enrichedRatio }: { status: FundPoolStatus | null; enrichedRatio: number }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Gauge size={18} />
          数据准备度
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">基金增强覆盖率</span>
            <strong>{enrichedRatio.toFixed(1)}%</strong>
          </div>
          <div className="h-3 rounded-full bg-secondary">
            <div className="h-3 rounded-full bg-primary" style={{ width: `${Math.min(enrichedRatio, 100)}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniMetric label="基金池" value={formatCount(status?.total_count ?? 0)} />
          <MiniMetric label="已增强" value={formatCount(status?.enriched_count ?? 0)} />
        </div>
        <div className="rounded-md border bg-background p-3 text-xs leading-5 text-muted-foreground">
          来源：{status?.source || "东方财富 / 天天基金公开接口"}；存储：{status?.storage || "SQLite"}。
          当前只展示真实同步状态，不展示模拟行情。
        </div>
      </CardContent>
    </Card>
  );
}

function DistributionPanel({
  icon: Icon,
  title,
  source,
  items,
}: {
  icon: typeof PieChart;
  title: string;
  source: string;
  items: { label: string; count: number }[];
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Icon size={18} />
            {title}
          </CardTitle>
          <Badge variant="success">真实统计</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <EmptyState text="暂无基金池统计，请先同步真实基金池。" />}
        {items.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-muted-foreground">{item.label}</span>
              <strong>{item.count.toLocaleString("zh-CN")}</strong>
            </div>
            <div className="h-2 rounded-full bg-secondary">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }} />
            </div>
          </div>
        ))}
        <p className="text-xs leading-5 text-muted-foreground">来源：{source}</p>
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Newspaper size={18} />
            热点新闻
          </CardTitle>
          <Badge variant="info">Top 5</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-5 text-muted-foreground">
          来源：Google News RSS 财经/产业标题；DeepSeek 仅做热点提炼和热度归纳。
        </p>
        {loading && <EmptyState text="正在加载今日热点。" />}
        {!loading && hotspots.length === 0 && <EmptyState text="未获取到真实热点。" />}
        {hotspots.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => onSelect(item.name)}
            className={cn(
              "w-full rounded-md border bg-background p-3 text-left transition-colors hover:bg-accent/60",
              selectedName === item.name && "border-primary bg-accent",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{item.name}</div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary}</p>
              </div>
              <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold">{item.heat_score}</span>
            </div>
            {(item.evidence_headlines?.length ?? 0) > 0 && (
              <div className="mt-2 space-y-1 border-t pt-2">
                {item.evidence_headlines.slice(0, 2).map((headline) => (
                  <p key={`${item.name}-${headline.title}`} className="line-clamp-1 text-xs text-muted-foreground">
                    {headline.source}：{headline.title}
                  </p>
                ))}
              </div>
            )}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function HotThemePreviewCard({ hotspot }: { hotspot?: TodayHotspot }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={18} />
          当前热点预览
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hotspot && <EmptyState text="请选择或输入一个市场热点。" />}
        {hotspot && (
          <>
            <div className="rounded-md border bg-background p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-base font-semibold">{hotspot.name}</div>
                <Badge variant="info">热度 {hotspot.heat_score}</Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{hotspot.summary}</p>
            </div>
            <TagGroup title="关联方向" tags={hotspot.related_keywords} />
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              尚未生成基金推荐。点击开始分析后，系统才会进行基金匹配、适当性校验和合规检查。
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ScoringModelIntro() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 size={18} />
          推荐评分模型
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {scoringItems.map((item) => (
          <div key={item.label} className="rounded-md border bg-background p-3">
            <div className="text-sm font-medium">{item.label}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function OutputPreviewPanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <FileText size={18} />
          分析完成后将生成
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {outputItems.map((item) => (
          <div key={item.label} className="flex gap-3 rounded-md border bg-background p-3">
            <item.icon size={16} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <div className="text-sm font-medium">{item.label}</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ComplianceReminder() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <div className="mb-1 flex items-center gap-2 font-medium">
        <ShieldCheck size={16} />
        合规边界
      </div>
      本系统仅用于基金产品研究、营销辅助和投资者教育，不构成投资建议。基金有风险，投资需谨慎，历史业绩不代表未来表现。
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className="truncate text-right">{value}</strong>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function TagGroup({ title, tags }: { title: string; tags: string[] }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="muted">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border bg-background p-3 text-sm leading-6 text-muted-foreground">{text}</div>;
}

function formatCount(value: number) {
  return value.toLocaleString("zh-CN");
}

function ratio(part: number, total: number) {
  if (total <= 0) return 0;
  return (part / total) * 100;
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
