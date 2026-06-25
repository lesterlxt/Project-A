import { useState } from "react";
import { Check, Copy, Lightbulb, MessageCircle, MessageSquareText, ShieldAlert, Sparkles, Target, Users } from "lucide-react";
import { ChannelStrategy, MarketingCopy } from "../api/campaignApi";

type Props = {
  copy: MarketingCopy;
  strategy: ChannelStrategy;
};

export function MarketingCopyPanel({ copy, strategy }: Props) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={18} className="text-primary" />
        <h2 className="text-lg font-semibold">渠道营销方案</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          为{strategy.channel}渠道定制
        </span>
      </div>

      <div className="space-y-6">
        {/* ① Headline + One-liner */}
        <div className="rounded-lg border bg-gradient-to-r from-blue-50/50 to-white p-4">
          <h3 className="text-lg font-semibold tracking-tight">{copy.headline}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{copy.one_liner}</p>
        </div>

        {/* ② Selling Points */}
        {copy.selling_points.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <Target size={15} className="text-muted-foreground" />
              <span className="text-sm font-semibold">核心卖点</span>
            </div>
            <ul className="space-y-2 rounded-lg border bg-card p-4">
              {copy.selling_points.map((point, index) => (
                <li key={index} className="flex gap-2 text-sm leading-relaxed">
                  <span className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ③ RM Script */}
        {copy.relationship_manager_script && (
          <CopyBlock
            title="客户经理面谈话术"
            text={copy.relationship_manager_script}
            hint="可用于晨会分享、夕会复盘或一对一客户沟通"
            icon={<MessageCircle size={15} />}
          />
        )}

        {/* ④ Social Post */}
        {copy.social_post && (
          <CopyBlock
            title="微信 / 社媒短文案"
            text={copy.social_post}
            hint="适合发朋友圈、客户群或企业微信推送"
            icon={<MessageSquareText size={15} />}
          />
        )}

        {/* ⑤ Long Form */}
        {copy.long_form && (
          <CopyBlock
            title="产品推介长文"
            text={copy.long_form}
            hint="适合发给高净值客户或作为理财经理客户信模板"
            icon={<MessageSquareText size={15} />}
          />
        )}

        {/* ⑥ Investor Education */}
        {copy.investor_education.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <Lightbulb size={15} className="text-amber-500" />
              <span className="text-sm font-semibold">投教要点</span>
              <span className="text-xs text-muted-foreground">帮助理财经理快速建立产品知识</span>
            </div>
            <ul className="space-y-2 rounded-lg border bg-amber-50/50 p-4">
              {copy.investor_education.map((point, index) => (
                <li key={index} className="flex gap-2 text-sm leading-relaxed">
                  <span className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-700">
                    {index + 1}
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ⑦ Objection Handling */}
        {copy.objection_handling.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <ShieldAlert size={15} className="text-muted-foreground" />
              <span className="text-sm font-semibold">常见异议应对</span>
            </div>
            <div className="space-y-3 rounded-lg border bg-card p-4">
              {copy.objection_handling.map((item, index) => (
                <div key={index} className={index > 0 ? "border-t pt-3" : ""}>
                  <p className="text-sm font-medium text-destructive/80">
                    ❝ 客户可能问：{item.objection}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    应对话术：{item.response}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ⑧ Channel Strategy */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Users size={15} className="text-muted-foreground" />
            <span className="text-sm font-semibold">渠道策略说明</span>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <span className="text-xs font-medium text-muted-foreground">客户画像</span>
              <p className="mt-0.5 leading-relaxed">{strategy.client_profile.join(" · ")}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">表达重点</span>
              <p className="mt-0.5 leading-relaxed">{strategy.messaging_focus.join(" · ")}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">规避角度</span>
              <p className="mt-0.5 leading-relaxed text-destructive/70">{strategy.forbidden_angles.join(" · ")}</p>
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{strategy.strategy_summary}</p>
        </div>

        {/* ⑨ Risk Disclosure */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          <span className="font-semibold">⚠ 风险揭示：</span>
          {copy.risk_disclosure}
        </div>
      </div>
    </section>
  );
}

function CopyBlock({
  title,
  text,
  hint,
  icon,
}: {
  title: string;
  text: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
          {hint && <span className="text-xs text-muted-foreground">— {hint}</span>}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  );
}
