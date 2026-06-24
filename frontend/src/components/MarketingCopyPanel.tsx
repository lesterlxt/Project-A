import { ChannelStrategy, MarketingCopy } from "../api/campaignApi";

type Props = {
  copy: MarketingCopy;
  strategy: ChannelStrategy;
};

export function MarketingCopyPanel({ copy, strategy }: Props) {
  return (
    <section className="section-block">
      <div className="section-title">
        <h2>渠道文案</h2>
      </div>
      <div className="copy-panel">
        <h3>{copy.headline}</h3>
        <p>{copy.one_liner}</p>
        <div className="copy-card">
          <span>客户经理话术</span>
          <p>{copy.relationship_manager_script}</p>
        </div>
        <div className="copy-card">
          <span>社媒短文案</span>
          <p>{copy.social_post}</p>
        </div>
        <div className="copy-card">
          <span>渠道策略</span>
          <p>{strategy.strategy_summary}</p>
        </div>
        <div className="risk-line">{copy.risk_disclosure}</div>
      </div>
    </section>
  );
}
