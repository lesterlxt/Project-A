import { RecommendedFund } from "../api/campaignApi";

const labels: Record<string, string> = {
  theme_relevance: "主题相关度",
  holding_match: "持仓匹配度",
  positioning_match: "产品定位匹配",
  performance_stability: "表现稳定性",
  channel_match: "渠道匹配度",
  compliance_penalty: "合规扣分",
};

type Props = {
  fund: RecommendedFund;
};

export function ScoreBreakdown({ fund }: Props) {
  const items = Object.entries(fund.score_breakdown);

  return (
    <div className="score-list">
      {items.map(([key, value]) => {
        const width = Math.min(Math.abs(value) * 2.6, 100);
        return (
          <div key={key} className="score-item">
            <div className="score-meta">
              <span>{labels[key]}</span>
              <strong>{value}</strong>
            </div>
            <div className="score-bar">
              <div className={value < 0 ? "bar negative" : "bar"} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
