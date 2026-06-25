import { Route, Routes } from "react-router-dom";
import { CampaignWorkbench } from "./pages/CampaignWorkbench";
import { FundDetailPage } from "./pages/FundDetailPage";

export default function App() {
  return (
    <Routes>
      <Route path="/fund/:fundCode" element={<FundDetailPage />} />
      <Route path="/*" element={<CampaignWorkbench />} />
    </Routes>
  );
}
