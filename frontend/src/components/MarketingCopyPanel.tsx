import { useState } from "react";
import {
  Check,
  Copy,
  Lightbulb,
  MessageCircle,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import {
  ChannelStrategy,
  MarketingCopy,
} from "../api/campaignApi";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";

type Props = {
  copy: MarketingCopy;
  strategy: ChannelStrategy;
};

export function MarketingCopyPanel({ copy, strategy }: Props) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={18} className="text-gold" />
        <h2 className="text-h1">渠道营销方案</h2>
        <Badge variant="gold" size="sm">
          为{strategy.channel}定制
        </Badge>
      </div>

      <div className="space-y-5">
        {/* ① Headline + One-liner */}
        <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary-subtle via-primary-subtle/50 to-card p-5 shadow-xs">
          <h3 className="text-h2 tracking-tight">
            {copy.headline}
          </h3>
          <p className="mt-2 text-body leading-relaxed text-muted-foreground">
            {copy.one_liner}
          </p>
        </div>

        {/* ② Selling Points */}
        {copy.selling_points.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Target size={15} className="text-primary" />
              <h3 className="text-h3">核心卖点</h3>
            </div>
            <Card>
              <CardContent className="space-y-2 p-4">
                {copy.selling_points.map((point, index) => (
                  <div
                    key={index}
                    className="flex gap-3 rounded-lg bg-background p-3"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-micro font-bold text-primary">
                      {index + 1}
                    </span>
                    <span className="text-body leading-relaxed">
                      {point}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ③ RM Script */}
        {copy.relationship_manager_script && (
          <CopyBlock
            title="客户经理面谈话术"
            text={copy.relationship_manager_script}
            hint="可用于晨会分享、夕会复盘或一对一客户沟通"
            icon={
              <MessageCircle
                size={15}
                className="text-primary"
              />
            }
          />
        )}

        {/* ④ Social Post */}
        {copy.social_post && (
          <CopyBlock
            title="微信 / 社媒短文案"
            text={copy.social_post}
            hint="适合发朋友圈、客户群或企业微信推送"
            icon={
              <MessageSquareText
                size={15}
                className="text-primary"
              />
            }
          />
        )}

        {/* ⑤ Long Form */}
        {copy.long_form && (
          <CopyBlock
            title="产品推介长文"
            text={copy.long_form}
            hint="适合发给高净值客户或作为理财经理客户信模板"
            icon={
              <MessageSquareText
                size={15}
                className="text-primary"
              />
            }
          />
        )}

        {/* ⑥ Investor Education */}
        {copy.investor_education.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb
                size={15}
                className="text-gold"
              />
              <h3 className="text-h3">投教要点</h3>
              <span className="text-micro text-muted-foreground">
                帮助理财经理快速建立产品知识
              </span>
            </div>
            <Card className="border-gold/20 bg-gold-subtle/30">
              <CardContent className="space-y-2 p-4">
                {copy.investor_education.map((point, index) => (
                  <div
                    key={index}
                    className="flex gap-3 rounded-lg bg-card p-3"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gold/15 text-micro font-bold text-gold">
                      {index + 1}
                    </span>
                    <span className="text-body leading-relaxed">
                      {point}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ⑦ Objection Handling */}
        {copy.objection_handling.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert
                size={15}
                className="text-muted-foreground"
              />
              <h3 className="text-h3">常见异议应对</h3>
            </div>
            <Card>
              <CardContent className="p-4">
                <div className="divide-y divide-border">
                  {copy.objection_handling.map((item, index) => (
                    <div
                      key={index}
                      className={index === 0 ? "pb-3" : "py-3"}
                    >
                      <p className="text-body font-medium text-danger/80">
                        ❝ 客户可能问：{item.objection}
                      </p>
                      <p className="mt-1.5 text-body leading-relaxed text-muted-foreground">
                        应对话术：{item.response}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ⑧ Channel Strategy */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users size={15} className="text-primary" />
              <h3 className="text-h3">渠道策略说明</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <span className="text-micro font-medium text-muted-foreground">
                  客户画像
                </span>
                <p className="mt-1 text-caption leading-relaxed">
                  {strategy.client_profile.join(" · ")}
                </p>
              </div>
              <div>
                <span className="text-micro font-medium text-muted-foreground">
                  表达重点
                </span>
                <p className="mt-1 text-caption leading-relaxed">
                  {strategy.messaging_focus.join(" · ")}
                </p>
              </div>
              <div>
                <span className="text-micro font-medium text-muted-foreground">
                  规避角度
                </span>
                <p className="mt-1 text-caption leading-relaxed text-danger/70">
                  {strategy.forbidden_angles.join(" · ")}
                </p>
              </div>
            </div>
            <p className="mt-3 text-caption text-muted-foreground">
              {strategy.strategy_summary}
            </p>
          </CardContent>
        </Card>

        {/* ⑨ Risk Disclosure */}
        <div className="rounded-xl border border-warning/30 bg-warning-subtle p-4">
          <p className="text-body leading-relaxed text-warning">
            <span className="font-semibold">⚠ 风险揭示：</span>
            {copy.risk_disclosure}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Copy Block with copy-to-clipboard ── */
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
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-h3">{title}</h3>
            {hint && (
              <span className="hidden text-micro text-muted-foreground sm:inline">
                — {hint}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-micro text-muted-foreground transition-all duration-200 hover:bg-primary-subtle hover:text-primary"
          >
            {copied ? (
              <>
                <Check size={13} />
                已复制
              </>
            ) : (
              <>
                <Copy size={13} />
                复制
              </>
            )}
          </button>
        </div>
        <p className="text-body leading-relaxed whitespace-pre-line">
          {text}
        </p>
      </CardContent>
    </Card>
  );
}
