import { useMemo } from "react";
import {
  BarChart3,
  Building2,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import {
  ChannelStrategy,
  HotspotAnalysis,
  RecommendedFund,
} from "../api/campaignApi";
import { cn } from "../lib/utils";

type Props = {
  fund: RecommendedFund;
  channel: ChannelStrategy;
  hotspot: HotspotAnalysis;
  riskPreference: string;
};

export function ChannelFitPanel({
  fund,
  channel,
  hotspot,
  riskPreference,
}: Props) {
  const { riskFit, clientFit, productFit } = useMemo(() => {
    return {
      riskFit: analyzeRiskFit(fund, channel, riskPreference),
      clientFit: analyzeClientFit(fund, channel, hotspot),
      productFit: analyzeProductFit(fund, channel),
    };
  }, [fund, channel, hotspot, riskPreference]);

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Building2 size={18} className="text-primary" />
        <h2 className="text-h1">渠道适配分析</h2>
        <span className="text-caption text-muted-foreground">
          基于{channel.channel}渠道画像的系统自动匹配
        </span>
      </div>

      <div className="space-y-4">
        {/* Integration Summary */}
        <div className="rounded-xl border border-primary/15 bg-gradient-to-r from-primary-subtle/60 to-card p-4">
          <p className="text-body leading-relaxed">
            {riskFit.summary}；{clientFit.summary}。{productFit.summary}
          </p>
        </div>

        {/* Detail Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <FitCard
            icon={
              <BarChart3 size={15} />
            }
            title="风险等级匹配"
            status={riskFit.level}
            details={riskFit.details}
          />
          <FitCard
            icon={
              <UsersRound size={15} />
            }
            title="客户画像匹配"
            status={clientFit.level}
            details={clientFit.details}
          />
          <FitCard
            icon={
              <TrendingUp size={15} />
            }
            title="产品特征契合"
            status={productFit.level}
            details={productFit.details}
          />
        </div>
      </div>
    </section>
  );
}

function FitCard({
  icon,
  title,
  status,
  details,
}: {
  icon: React.ReactNode;
  title: string;
  status: "高" | "中" | "需关注";
  details: string[];
}) {
  const config = {
    高: {
      bg: "bg-success-subtle border-success/30",
      badge: "bg-success text-success-foreground",
      iconColor: "text-success",
    },
    中: {
      bg: "bg-primary-subtle border-primary/20",
      badge: "bg-primary text-primary-foreground",
      iconColor: "text-primary",
    },
    需关注: {
      bg: "bg-warning-subtle border-warning/30",
      badge: "bg-warning text-warning-foreground",
      iconColor: "text-warning",
    },
  };

  const c = config[status];

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-4",
        c.bg,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-h3">
          <span className={c.iconColor}>{icon}</span>
          {title}
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-micro font-semibold",
            c.badge,
          )}
        >
          {status}
        </span>
      </div>
      <ul className="flex-1 space-y-1.5">
        {details.map((detail, index) => (
          <li
            key={index}
            className="text-caption leading-relaxed text-muted-foreground"
          >
            {detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══════════════════════════════════════
   Analysis Helpers
   ═══════════════════════════════════════ */

function analyzeRiskFit(
  fund: RecommendedFund,
  channel: ChannelStrategy,
  riskPreference: string,
) {
  const isConservativeChannel = channel.client_profile.some(
    (p) =>
      p.includes("稳健") ||
      p.includes("保守") ||
      p.includes("风险承受能力分层"),
  );
  const riskNum = parseInt(fund.risk_level.replace("R", "")) || 3;

  if (riskNum <= 2) {
    return {
      level: "高" as const,
      summary: `该基金风险等级${fund.risk_level}，属于低风险产品，适合${channel.channel}各类风险偏好客户配置`,
      details: [
        `风险等级${fund.risk_level}，可推荐给稳健型及以上全部客户`,
        isConservativeChannel
          ? `特别契合${channel.channel}稳健为主的客户结构`
          : `满足日常资产配置中的低风险底仓需求`,
        `当前客户风险偏好为${riskPreference}，风险等级完全匹配`,
      ],
    };
  }

  if (riskNum === 3) {
    return {
      level: "高" as const,
      summary: `该基金风险等级${fund.risk_level}，平衡型产品，匹配${channel.channel}大部分客户的配置需求`,
      details: [
        `风险等级${fund.risk_level}，适合${riskPreference}及以上客户`,
        "可作为客户资产配置中的卫星仓位推荐",
        isConservativeChannel
          ? "建议向风险测评结果为平衡型及以上的客户推荐"
          : "风险等级适配范围广",
      ],
    };
  }

  return {
    level: "中" as const,
    summary: `该基金风险等级${fund.risk_level}，适合风险承受能力较强的客户，建议审慎推荐`,
    details: [
      `风险等级${fund.risk_level}，仅适合${riskPreference}及以上客户`,
      isConservativeChannel
        ? `需注意${channel.channel}客户整体偏稳健，推荐范围有限`
        : "适合有权益敞口需求的进取型客户",
      "建议小仓位推荐，并充分揭示波动风险",
    ],
  };
}

function analyzeClientFit(
  fund: RecommendedFund,
  channel: ChannelStrategy,
  hotspot: HotspotAnalysis,
) {
  const isHNW = channel.client_profile.some((p) =>
    p.includes("高净值"),
  );
  const isTechOriented = hotspot.industries.some(
    (ind) =>
      fund.industry_allocation[ind] &&
      fund.industry_allocation[ind] > 15,
  );

  if (isHNW && isTechOriented) {
    return {
      level: "高" as const,
      summary: `该基金聚焦${hotspot.hotspot}产业链，契合${channel.channel}高净值客户对产业趋势的关注`,
      details: [
        `行业暴露集中于${Object.entries(fund.industry_allocation).slice(0, 3).map(([k]) => k).join("、")}，匹配当前${hotspot.hotspot}热点方向`,
        `${channel.channel}高净值客户占比高，对产业主题型产品接受度较好`,
        "适合作为客户资产配置中的成长性卫星仓位",
      ],
    };
  }

  if (isHNW) {
    return {
      level: "高" as const,
      summary: `该基金特征匹配${channel.channel}高净值客户画像，可作为资产配置中的配置选项`,
      details: [
        `${channel.channel}客户关注长期配置价值，该基金的定位与此一致`,
        "高净值客户对产品理解能力较强，适合推荐有产业逻辑支撑的产品",
        `基金匹配标签：${fund.matched_tags.slice(0, 3).join("、")}`,
      ],
    };
  }

  return {
    level: "中" as const,
    summary: `该基金与${channel.channel}客户整体画像的匹配度中等，建议针对特定客群定向推荐`,
    details: [
      `${channel.channel}客户基数大、分层明显，建议优先向风险偏好匹配的客群推荐`,
      `该基金适合${fund.suitable_clients.slice(0, 20)}...的客户`,
      "建议结合客户实际持仓和投资期限进行个性化推荐",
    ],
  };
}

function analyzeProductFit(
  fund: RecommendedFund,
  channel: ChannelStrategy,
) {
  const isLongTerm = channel.messaging_focus.some((f) =>
    f.includes("长期"),
  );
  const isIndustryTrend = channel.messaging_focus.some((f) =>
    f.includes("产业"),
  );
  const hasEnoughData = fund.data_quality_score >= 75;

  if (isIndustryTrend && hasEnoughData) {
    return {
      level: "高" as const,
      summary: `该基金特征与${channel.channel}渠道表达策略高度契合，数据完整度${fund.data_quality_score.toFixed(0)}分，支撑专业推介`,
      details: [
        `契合"${channel.messaging_focus[0]}"的表达重点`,
        `数据质量${fund.data_quality_score.toFixed(0)}/100，可用于制作专业推介材料`,
        isLongTerm
          ? "适合作为客户长期资产配置方案中的配置选项"
          : "适合向有相关产业认知的客户推荐",
      ],
    };
  }

  return {
    level: "中" as const,
    summary: `该基金可作为${channel.channel}渠道的候选配置，建议结合具体营销场景灵活推荐`,
    details: [
      `匹配"${channel.messaging_focus.slice(0, 2).join("、")}"的表达方向`,
      hasEnoughData
        ? `数据质量${fund.data_quality_score.toFixed(0)}分，支撑专业推介`
        : "部分数据字段待补充，建议在推介时说明数据来源",
      "适合作为渠道产品线中的特色配置选项",
    ],
  };
}
