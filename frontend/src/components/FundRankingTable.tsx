import { RecommendedFund } from "../api/campaignApi";

type Props = {
  funds: RecommendedFund[];
  selectedFundCode: string;
  onSelect: (fundCode: string) => void;
};

export function FundRankingTable({ funds, selectedFundCode, onSelect }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>基金</th>
            <th>类型</th>
            <th>经理</th>
            <th>匹配分</th>
            <th>标签</th>
          </tr>
        </thead>
        <tbody>
          {funds.map((fund, index) => (
            <tr
              key={fund.fund_code}
              className={fund.fund_code === selectedFundCode ? "selected-row" : ""}
              onClick={() => onSelect(fund.fund_code)}
            >
              <td>{index + 1}</td>
              <td>
                <strong>{fund.fund_name}</strong>
                <span>{fund.fund_code}</span>
              </td>
              <td>{fund.fund_type}</td>
              <td>{fund.manager}</td>
              <td>
                <span className="score-pill">{fund.score}</span>
              </td>
              <td>
                <div className="mini-tags">
                  {fund.matched_tags.slice(0, 4).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
