// /admin — operator console for the hoardings: live 3D preview, a physics-based wind
// simulator and scripted weather that drive every screen, a remote for each screen, and a
// health check of every API endpoint.

import { useEffect, useState } from "react";
import { useAdmin } from "./useAdmin.js";
import AdminHeader from "./components/AdminHeader.jsx";
import TokenGate from "./components/TokenGate.jsx";
import LivePreview from "./components/LivePreview.jsx";
import Readouts from "./components/Readouts.jsx";
import PresetGrid from "./components/PresetGrid.jsx";
import Simulator from "./components/Simulator.jsx";
import ScenarioPlayer from "./components/ScenarioPlayer.jsx";
import ScreensControl from "./components/ScreensControl.jsx";
import EndpointHealth from "./components/EndpointHealth.jsx";
import PowerCurvePanel from "../screens/components/PowerCurvePanel.jsx";
import { SKINS } from "../screens/components/skins.js";
import { useScreenData } from "../screens/useScreenData.js";

export default function AdminPage() {
  const { setToken, needsToken, error, call, admin } = useAdmin();
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const data = useScreenData();

  useEffect(() => {
    document.title = "Admin · Weston Wind";
  }, []);

  return (
    <div className="min-h-dvh bg-moss-25">
      <AdminHeader onResumeLive={() => call((t) => admin.resumeLive(t))} />
      {needsToken && <TokenGate onSubmit={setToken} />}
      <main className="mx-auto max-w-[1500px] space-y-5 px-5 py-6">
        {error && <p className="rounded-2xl bg-moss-900 px-4 py-3 text-sm text-white">{error}</p>}
        <Readouts />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <LivePreview />
            <div className="grid gap-5 lg:grid-cols-2">
              <PowerCurvePanel curve={data.curve} windSpeed={data.windSpeed} powerKw={data.powerKw} skin={{ ...SKINS.cartoon, card: "bg-white ring-1 ring-moss-100" }} className="[&_svg]:w-full" />
              <ScreensControl call={call} admin={admin} />
            </div>
          </div>
          <div className="space-y-5">
            <Simulator call={call} admin={admin} disabled={scenarioRunning} />
            <ScenarioPlayer call={call} admin={admin} onRunningChange={setScenarioRunning} />
            <PresetGrid call={call} admin={admin} disabled={scenarioRunning} />
          </div>
        </div>
        <EndpointHealth />
      </main>
    </div>
  );
}
