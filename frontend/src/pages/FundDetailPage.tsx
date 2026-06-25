import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FundEvidencePanel } from "../components/FundEvidencePanel";
import { MarketingCopyPanel } from "../components/MarketingCopyPanel";
import { useCampaignContext } from "../context/CampaignContext";

export function FundDetailPage() {
  const { fundCode } = useParams<{ fundCode: string }>();
  const navigate = useNavigate();
  const { result, options, selectedHotspot, riskPreference } = useCampaignContext();

  const fund = useMemo(() => {
    if (!result || !fundCode) return null;
    return result.recommended_funds.find((f) => f.fund_code === fundCode) ?? null;
  }, [result, fundCode]);

  if (!result || !fund) {
    return (
      <main className="min-h-screen bg-white p-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          返回结果列表
        </button>
        <div className="rounded-md border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">未找到该基金的详情数据，请从结果列表重新进入。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        {/* Back navigation */}
        <button
          type="button"
          onClick={() => navigate(`/?tab=result&fund=${fundCode}`)}
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          返回结果列表
        </button>

        {/* Fund header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-normal">{fund.fund_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {fund.fund_code} · {fund.fund_type} · {fund.compare_group} · {fund.manager || "经理未知"} · 风险 {fund.risk_level}
          </p>
        </div>

        <div className="space-y-8">
          <FundEvidencePanel fund={fund} scoringModel={options?.scoring_model ?? []} />

          <MarketingCopyPanel copy={result.marketing_copy} strategy={result.channel_strategy} />

          <section>
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={17} className="text-muted-foreground" />
              <h2 className="text-base font-semibold">适当性边界</h2>
            </div>
            <div className="grid gap-3 rounded-md border p-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-sm font-medium">适合客户</div>
                <p className="text-sm leading-6 text-muted-foreground">{fund.suitable_clients}</p>
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">不适合客户</div>
                <p className="text-sm leading-6 text-muted-foreground">{fund.unsuitable_clients}</p>
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">风险提示</div>
                <p className="text-sm leading-6 text-muted-foreground">{fund.risk_warning}</p>
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">渠道表达重点</div>
                <p className="text-sm leading-6 text-muted-foreground">{result.channel_strategy.messaging_focus.join(" / ")}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
