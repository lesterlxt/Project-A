import { ChannelStrategy, MarketingCopy } from "../api/campaignApi";

type Props = {
  copy: MarketingCopy;
  strategy: ChannelStrategy;
};

export function MarketingCopyPanel({ copy, strategy }: Props) {
  return (
    <section>
      <SectionHeading title="渠道文案" />
      <div className="space-y-4 rounded-md border p-4">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold">{copy.headline}</h3>
          <p className="text-sm text-muted-foreground">{copy.one_liner}</p>
        </div>
        <CopyBlock title="客户经理话术" text={copy.relationship_manager_script} />
        <CopyBlock title="社媒短文案" text={copy.social_post} />
        <CopyBlock title="渠道策略" text={strategy.strategy_summary} />
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          {copy.risk_disclosure}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );
}

function CopyBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{title}</div>
      <p className="text-sm leading-6">{text}</p>
    </div>
  );
}
