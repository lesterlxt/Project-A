import { Download, ShieldCheck } from "lucide-react";
import { CampaignResponse } from "../api/campaignApi";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

type Props = {
  result: CampaignResponse;
};

export function ReviewActions({ result }: Props) {
  function exportMarkdown() {
    const content = buildReviewMarkdown(result);
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ProjectA-${result.hotspot_analysis.hotspot}-审核稿.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-card px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck size={17} />
        <span className="text-sm font-semibold">审核状态</span>
        <Badge variant="warning">待人工复核</Badge>
        <Badge variant={result.compliance.passed ? "success" : "warning"}>
          {result.compliance.passed ? "基础规则通过" : "基础规则需处理"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          AI 生成内容仅作初稿，需经合规确认后使用。
        </span>
      </div>
      <Button type="button" variant="outline" onClick={exportMarkdown}>
        <Download size={15} />
        导出审核稿
      </Button>
    </div>
  );
}

function buildReviewMarkdown(result: CampaignResponse) {
  const funds = result.recommended_funds
    .map(
      (fund, index) => `
### ${index + 1}. ${fund.fund_name} (${fund.fund_code})

- 匹配分: ${fund.score}
- 数据质量分: ${fund.data_quality_score.toFixed(1)}/100
- 类型: ${fund.fund_type}
- 比较分组: ${fund.compare_group}
- 同组排名: ${fund.category_rank ? `${fund.category_rank}/${fund.category_total}` : "暂无"}
- 基金经理: ${fund.manager || "未知"}
- 风险等级: ${fund.risk_level} (${fund.field_sources.risk_level})
- 近一年收益: ${formatValue(fund.one_year_return, "%")} (${fund.field_sources.one_year_return})
- 波动率: ${formatValue(fund.volatility, "%")} (${fund.field_sources.volatility})
- 最大回撤: ${formatValue(fund.max_drawdown, "%")} (${fund.field_sources.max_drawdown})
- 匹配标签: ${fund.matched_tags.join(" / ") || "无"}
- 缺失字段: ${fund.missing_fields.join(" / ") || "无"}
- 初筛理由: ${fund.reason}
- 风险提示: ${fund.risk_warning}
- 解释证据:
${fund.explanation_points.map((point) => `  - ${point.label}: ${point.text} [${point.source}; ${point.evidence_fields.join(" / ")}]`).join("\n") || "  - 无"}
`,
    )
    .join("\n");
  const excludedFunds = result.excluded_funds
    .slice(0, 10)
    .map(
      (fund, index) => `
### ${index + 1}. ${fund.fund_name} (${fund.fund_code})

- 数据质量分: ${fund.data_quality_score.toFixed(1)}/100
- 类型: ${fund.fund_type}
- 比较分组: ${fund.compare_group}
- 风险等级: ${fund.risk_level}
- 排除原因: ${fund.exclusion_reasons.join(" / ") || "未返回"}
- 缺失字段: ${fund.missing_fields.join(" / ") || "无"}
`,
    )
    .join("\n");

  return `# Project A 基金营销审核稿

## 基本信息

- 热点: ${result.hotspot_analysis.hotspot}
- 渠道: ${result.channel_strategy.channel}
- 审核状态: 待人工复核
- 筛选基金数: ${result.screened_count}
- 候选基金数: ${result.eligible_count}
- 拦截基金数: ${result.excluded_count}
- 基础合规检查: ${result.compliance.passed ? "通过" : "需处理"}

## 热点分析

${result.hotspot_analysis.summary}

- 主题: ${result.hotspot_analysis.themes.join(" / ")}
- 行业: ${result.hotspot_analysis.industries.join(" / ")}
- 关键词: ${result.hotspot_analysis.keywords.join(" / ")}
- 风险: ${result.hotspot_analysis.risks.map((r) => r.title).join(" / ")}

## 候选基金

${funds}

## 未进入候选池样本

${excludedFunds || "无"}

## 渠道文案

### 标题

${result.marketing_copy.headline}

### 一句话卖点

${result.marketing_copy.one_liner}

### 客户经理话术

${result.marketing_copy.relationship_manager_script}

### 社媒短文案

${result.marketing_copy.social_post}

### 风险揭示

${result.marketing_copy.risk_disclosure}

## 合规检查

${result.compliance.issues.length ? result.compliance.issues.map((issue) => `- ${issue.term}: ${issue.message}`).join("\n") : "- 未命中基础禁用词规则"}

## 审核备注

- AI 生成内容不构成投资建议或收益承诺。
- 推导字段需人工复核，尤其是行业配置、风险等级和适合客户类型。
- 正式对外使用前需经过合规审批。
`;
}

function formatValue(value: number | null, suffix: string) {
  if (value === null) return "暂无";
  return `${value.toFixed(2)}${suffix}`;
}
