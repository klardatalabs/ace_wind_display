// A live 3D turbine for the admin: spins at exactly the rpm the API reports (or the
// simulator sets), yaws with the nacelle bearing, and can preview the screen effects.

import { useRef, useState } from "react";
import TurbineCanvas from "../../../components/three/TurbineCanvas.jsx";
import Panel from "./Panel.jsx";
import Icon from "../../../components/ui/Icon.jsx";

const THEMES = [
  { id: "cartoon", label: "Students" },
  { id: "realistic", label: "Community" },
  { id: "blueprint", label: "College" },
];
const ACTIONS = [
  ["look_inside", "Look inside"],
  ["tower_inside", "Tower"],
  ["close_inside", "Close"],
  ["spin_blades", "Spin"],
  ["overview", "Overview"],
  ["hero", "Hero"],
];

export default function LivePreview() {
  const sceneRef = useRef(null);
  const [theme, setTheme] = useState("realistic");
  return (
    <Panel
      title="Live preview"
      icon={<Icon name="cube" className="size-5 text-moss-500" />}
      action={
        <div className="flex rounded-xl bg-moss-50 p-1 ring-1 ring-moss-100">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${theme === t.id ? "bg-white text-moss-950 shadow" : "text-moss-700 hover:text-moss-950"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      <TurbineCanvas theme={theme} sceneRef={sceneRef} useSplat={false} className="aspect-[16/10] w-full rounded-2xl bg-moss-50" />
      <div className="mt-3 flex flex-wrap gap-2">
        {ACTIONS.map(([action, label]) => (
          <button
            key={action}
            type="button"
            onClick={() => sceneRef.current?.command(action)}
            className="rounded-full bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-800 ring-1 ring-moss-100 transition hover:bg-moss-100 active:scale-95"
          >
            {label}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-moss-900/50">This preview only — use Screens to drive the hoardings.</span>
      </div>
    </Panel>
  );
}
