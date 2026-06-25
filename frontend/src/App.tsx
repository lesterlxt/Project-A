import { Route, Routes } from "react-router-dom";
import { CampaignWorkbench } from "./pages/CampaignWorkbench";

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<CampaignWorkbench />} />
    </Routes>
  );
}
