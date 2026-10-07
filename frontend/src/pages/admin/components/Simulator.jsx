// Physics-driven simulator: pick a wind speed and bearing and the E-115's reference curve
// gives the power and rotor speed. Every change is pushed to all screens (debounced).

import { useEffect, useRef, useState } from "react";
import Panel from "./Panel.jsx";
import Slider from "./Slider.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { useLiveStore } from "../../../store/useLiveStore.js";
import { buildSimulation } from "../simulation.js";
import { theoreticalPowerKw, theoreticalRotorRpm } from "@shared/physics.js";
import { beaufortLabel } from "@shared/impact.js";
import { compassPoint, formatInt } from "../../../lib/format.js";

function Toggle({ label, checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm ring-1 transition disabled:opacity-50 ${checked ? "bg-moss-900 text-white ring-moss-900" : "bg-white text-moss-800 ring-moss-200"}`}
    >
      <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${checked ? "bg-moss-400" : "bg-moss-100"}`}>
        <span className={`size-4 rounded-full bg-white shadow transition-transform duration-300 ease-[var(--ease-spring)] ${checked ? "translate-x-4" : ""}`} />
      </span>
      {label}
    </button>
  );
}

export default function Simulator({ call, admin, disabled }) {
  const initial = useLiveStore.getState().state;
  const [wind, setWind] = useState(initial?.now?.windSpeed ?? 6);
  const [deg, setDeg] = useState(initial?.now?.nacelleDeg ?? 215);
  const [curtail, setCurtail] = useState(false);
  const [cap, setCap] = useState(1500);
  const [flags, setFlags] = useState({ fault: false, service: false, warning: false });
  const [manual, setManual] = useState(false);
  const [power, setPower] = useState(1000);
  const [rpm, setRpm] = useState(8);
  const [todayKwh, setTodayKwh] = useState(initial?.today?.energyKwh ?? 12000);
  const [auto, setAuto] = useState(true);
  const [sent, setSent] = useState(null);
  const touched = useRef(false);

  const payload = () =>
    buildSimulation({
      wind,
      deg,
      curtailKw: curtail ? cap : null,
      flags,
      manual: manual ? { powerKw: power, rpm } : {},
      todayKwh,
    });

  const push = async () => {
    const res = await call((t) => admin.simulate(t, payload()));
    if (res) setSent(new Date());
  };

  // Debounced auto-apply after the operator touches a control.
  useEffect(() => {
    if (!touched.current || !auto || disabled) return;
    const id = setTimeout(push, 220);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wind, deg, curtail, cap, flags, manual, power, rpm, todayKwh, auto, disabled]);

  const touch = (fn) => (v) => {
    touched.current = true;
    fn(v);
  };
  const preview = payload().now;

  return (
    <Panel
      title="Wind simulator"
      icon={<Icon name="wind" className="size-5 text-moss-500" />}
      action={<Toggle label="Apply live" checked={auto} onChange={setAuto} />}
    >
      {disabled && <p className="mb-3 rounded-xl bg-moss-50 p-2.5 text-xs text-moss-800">A scenario is playing — stop it to use the sliders.</p>}
      <div className="space-y-5">
        <Slider label="Wind speed" value={wind} min={0} max={36} step={0.1} unit="m/s" onChange={touch(setWind)} disabled={disabled} hint={`${beaufortLabel(wind)} · reference curve gives ${formatInt(theoreticalPowerKw(wind))} kW at ${theoreticalRotorRpm(wind).toFixed(1)} rpm`} format={(v) => v.toFixed(1)} />
        <Slider label="Nacelle bearing" value={deg} min={0} max={359} step={1} unit="°" onChange={touch(setDeg)} disabled={disabled} hint={`Facing ${compassPoint(deg)} — the 3D nacelle turns to match`} />
        <Slider label="Energy so far today" value={todayKwh} min={0} max={100000} step={100} unit="kWh" onChange={touch(setTodayKwh)} disabled={disabled} format={formatInt} />

        <div className="flex flex-wrap gap-2">
          <Toggle label="Grid curtailment" checked={curtail} onChange={touch(setCurtail)} disabled={disabled} />
          <Toggle label="Fault" checked={flags.fault} onChange={touch((v) => setFlags((f) => ({ ...f, fault: v })))} disabled={disabled} />
          <Toggle label="Technicians on site" checked={flags.service} onChange={touch((v) => setFlags((f) => ({ ...f, service: v })))} disabled={disabled} />
          <Toggle label="Warning" checked={flags.warning} onChange={touch((v) => setFlags((f) => ({ ...f, warning: v })))} disabled={disabled} />
          <Toggle label="Manual power & rpm" checked={manual} onChange={touch(setManual)} disabled={disabled} />
        </div>
        {curtail && <Slider label="Grid setpoint" value={cap} min={0} max={4200} step={50} unit="kW" onChange={touch(setCap)} disabled={disabled} format={formatInt} />}
        {manual && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Slider label="Power" value={power} min={0} max={4245} step={5} unit="kW" onChange={touch(setPower)} disabled={disabled} format={formatInt} />
            <Slider label="Rotor speed" value={rpm} min={0} max={16} step={0.05} unit="rpm" onChange={touch(setRpm)} disabled={disabled} format={(v) => v.toFixed(2)} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-moss-25 p-3 ring-1 ring-moss-100">
          <span className="font-mono text-xs text-moss-800">
            → {formatInt(preview.activePowerKw)} kW · {preview.rotorRpm} rpm · {preview.windSpeed} m/s · {preview.nacelleDeg}°
          </span>
          <button type="button" onClick={push} disabled={disabled} className="ml-auto rounded-xl bg-moss-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-moss-700 active:scale-95 disabled:opacity-50">
            Send to screens
          </button>
          {sent && <span className="text-xs text-moss-600">sent {sent.toLocaleTimeString("en-GB")}</span>}
        </div>
      </div>
    </Panel>
  );
}
