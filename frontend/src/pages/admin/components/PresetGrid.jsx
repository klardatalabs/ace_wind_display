import { useEffect, useState } from "react";
import Panel from "./Panel.jsx";
import Icon from "../../../components/ui/Icon.jsx";

const ICONS = { calm: "moon", breeze: "wind", rated: "bolt", storm: "cloud", curtailed: "plug", maintenance: "cogs", fault: "cogs" };

export default function PresetGrid({ call, admin, disabled }) {
  const [presets, setPresets] = useState({});
  const [active, setActive] = useState(null);
  useEffect(() => {
    call((t) => admin.presets(t)).then((p) => p && setPresets(p));
  }, [call, admin]);

  return (
    <Panel title="Presets" icon={<Icon name="layers" className="size-5 text-moss-500" />}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Object.entries(presets).map(([id, p]) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={async () => {
              if (await call((t) => admin.preset(t, id))) setActive(id);
            }}
            className={`flex flex-col items-start gap-1 rounded-2xl p-3 text-left ring-1 transition active:scale-[0.98] disabled:opacity-50 ${
              active === id ? "bg-moss-900 text-white ring-moss-900" : "bg-moss-25 text-moss-900 ring-moss-100 hover:bg-moss-50"
            }`}
          >
            <Icon name={ICONS[id] ?? "wind"} className={`size-5 ${active === id ? "text-moss-200" : "text-moss-500"}`} />
            <span className="text-sm font-medium">{p.name}</span>
            <span className={`font-mono text-[11px] ${active === id ? "text-white/70" : "text-moss-700"}`}>
              {p.now.windSpeed} m/s · {p.now.activePowerKw} kW · {p.now.rotorRpm} rpm
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}
