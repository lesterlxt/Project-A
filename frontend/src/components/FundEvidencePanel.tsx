import { FileSearch } from "lucide-react";
import { RecommendedFund } from "../api/campaignApi";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { SourceBadge } from "./SourceBadge";

type Props = {
  fund: RecommendedFund;
};

export function FundEvidencePanel({ fund }: Props) {
  const industries = Object.entries(fund.industry_allocation);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <FileSearch size={18} />
            初筛依据
          </CardTitle>
          <Badge variant={fund.is_enriched ? "success" : "warning"}>
            {fund.is_enriched ? "已增强" : "基础数据"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <EvidenceItem label="候选状态" value={fund.is_eligible ? "已进入候选池" : "未进入候选池"} source="calculated" />
          <EvidenceItem label="数据质量分" value={`${fund.data_quality_score.toFixed(1)}/100`} source={fund.field_sources.data_quality_score ?? "calculated"} />
          <EvidenceItem label="缺失字段数" value={String(fund.missing_fields.length)} source="calculated" />
        </div>

        {!fund.is_eligible && fund.exclusion_reasons.length > 0 && (
          <TextBox
            title="排除原因"
            source={fund.field_sources.exclusion_reasons ?? "calculated"}
            text={fund.exclusion_reasons.join(" / ")}
          />
        )}

        {fund.missing_fields.length > 0 && (
          <TextBox
            title="缺失字段"
            source="missing"
            text={fund.missing_fields.join(" / ")}
          />
        )}

        <EvidenceGroup title="真实接口数据">
          <EvidenceItem label="基金代码" value={fund.fund_code} source={fund.field_sources.fund_code} />
          <EvidenceItem label="基金名称" value={fund.fund_name} source={fund.field_sources.fund_name} />
          <EvidenceItem label="基金类型" value={fund.fund_type} source={fund.field_sources.fund_type} />
          <EvidenceItem label="基金经理" value={fund.manager || "未知"} source={fund.field_sources.manager} />
          <EvidenceItem label="近一年收益" value={formatPercent(fund.one_year_return)} source={fund.field_sources.one_year_return} />
          <EvidenceItem label="最新净值" value={fund.latest_nav || "暂无"} source={fund.field_sources.latest_nav} />
          <EvidenceItem label="估算涨幅" value={fund.estimated_growth || "暂无"} source={fund.field_sources.estimated_growth} />
        </EvidenceGroup>

        <EvidenceGroup title="计算与推导">
          <EvidenceItem label="波动率" value={formatPercent(fund.volatility)} source={fund.field_sources.volatility} />
          <EvidenceItem label="最大回撤" value={formatPercent(fund.max_drawdown)} source={fund.field_sources.max_drawdown} />
          <EvidenceItem label="风险等级" value={fund.risk_level} source={fund.field_sources.risk_level} />
          <EvidenceItem label="候选分数" value={String(fund.score)} source={fund.field_sources.score} />
        </EvidenceGroup>

        <div className="space-y-2">
          <div className="text-sm font-medium">产品定位标签</div>
          <div className="flex flex-wrap gap-1.5">
            {fund.positioning.slice(0, 10).map((tag) => (
              <Badge key={tag} variant="muted">
                {tag}
              </Badge>
            ))}
            <SourceBadge source={fund.field_sources.positioning} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <TextBox title="持仓股票代码" source={fund.field_sources.top_holdings} text={fund.top_holdings.slice(0, 10).join(" / ") || "暂无"} />
          <TextBox
            title="行业配置"
            source={fund.field_sources.industry_allocation}
            text={industries.length ? industries.map(([name, value]) => `${name} ${value.toFixed(1)}%`).join(" / ") : "暂无"}
          />
        </div>

        <div className="rounded-md border bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-medium">初筛理由</div>
            <SourceBadge source={fund.field_sources.reason} />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{fund.reason}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </div>
  );
}

function EvidenceItem({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <SourceBadge source={source} />
      </div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function TextBox({ title, text, source }: { title: string; text: string; source: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{title}</div>
        <SourceBadge source={source} />
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function formatPercent(value: number | null) {
  if (value === null) return "暂无";
  return `${value.toFixed(2)}%`;
}
