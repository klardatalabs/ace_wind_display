import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { theoreticalRotorRpm } from "@shared/physics.js";
import { REFERENCE } from "@shared/scenarios.js";
import ScenarioTurbine from "./ScenarioTurbine.jsx";

const FIELD = {
  windMs: { label: "Wind speed", unit: "m/s", min: 0, max: 34, step: 0.1 },
  windDeg: { label: "Wind direction", unit: "° from north", min: 0, max: 360, step: 1 },
  durationHours: { label: "Duration", unit: "hours", min: 0.1, max: 168, step: 0.1 },
  gridLimitKw: { label: "Grid power limit", unit: "kW", min: 0, max: 4245, step: 1 },
  airDensityKgM3: { label: "Air density", unit: "kg/m³", min: 0.8, max: 1.5, step: 0.001 },
  operatingPct: { label: "Operating fraction", unit: "%", min: 0, max: 100, step: 1 },
};
const format = (value, unit, digits = 1) => value == null ? "Unavailable" : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;
const sameValues = (a, b) => a && b && Object.keys(FIELD).every((key) => a[key] === b[key]);

function Parameter({ field, value, onChange, slider = false }) {
  const { label, unit, min, max, step } = FIELD[field];
  return <label className="block text-sm text-moss-800">
    <span className="mb-1.5 flex justify-between gap-2"><span className="font-semibold text-moss-950">{label}</span><span className="text-xs text-moss-600">{unit}</span></span>
    <input type="number" inputMode="decimal" value={value ?? ""} min={min} max={max} step={step} onChange={(event) => onChange(field, event.target.value)} className="w-full rounded-lg border border-moss-200 bg-white px-3 py-2 text-base text-moss-950 outline-none focus:border-moss-600 focus:ring-2 focus:ring-moss-200" />
    {slider && <input type="range" min={min} max={max} step={step} value={Number.isFinite(value) ? value : min} onChange={(event) => onChange(field, event.target.value)} aria-label={`${label} slider`} className="mt-3 w-full accent-moss-700" />}
  </label>;
}

function Results({ result }) {
  const base = result.baseline;
  const scenario = result.scenario;
  return <div className="space-y-3">
    <details className="rounded-xl border border-moss-200 bg-white p-4 text-sm text-moss-800" open>
      <summary className="cursor-pointer font-semibold text-moss-950">Technical readings and comparison</summary>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div><dt>Wind speed</dt><dd className="font-semibold">{format(base.values.windMs, "m/s")} → {format(scenario.values.windMs, "m/s")}</dd></div>
        <div><dt>Wind bearing</dt><dd className="font-semibold">{format(base.values.windDeg, "°")} → {format(scenario.values.windDeg, "°")}</dd></div>
        <div><dt>Rotor motion (visual)</dt><dd className="font-semibold">{format(base.output.rotorRpm, "rpm")} → {format(scenario.output.rotorRpm, "rpm")}</dd></div>
        <div><dt>Wind power density</dt><dd className="font-semibold">{format(base.output.windPowerDensityWm2, "W/m²")} → {format(scenario.output.windPowerDensityWm2, "W/m²")}</dd></div>
        <div><dt>Wind power across rotor</dt><dd className="font-semibold">{format(base.output.windPowerAcrossRotorKw, "kW")} → {format(scenario.output.windPowerAcrossRotorKw, "kW")}</dd></div>
        <div><dt>Blade tip speed (visual)</dt><dd className="font-semibold">{format(base.output.rotorTipSpeedMs, "m/s")} → {format(scenario.output.rotorTipSpeedMs, "m/s")}</dd></div>
        <div><dt>Assumed operating time</dt><dd className="font-semibold">{format(scenario.output.operatingHours, "h", 2)}</dd></div>
        <div><dt>Grid limit</dt><dd className="font-semibold">{format(scenario.values.gridLimitKw, "kW")}</dd></div>
        <div><dt>Power when operating</dt><dd className="font-semibold">{format(base.output.powerKw, "kW")} → {format(scenario.output.powerKw, "kW")}</dd></div>
      </dl>
      {result.measurements && <div className="mt-3 border-t border-moss-100 pt-3"><p className="font-semibold text-moss-950">ACE observed at baseline</p><dl className="mt-2 grid grid-cols-2 gap-2 text-xs"><div><dt>Rotor</dt><dd>{format(result.measurements.rotorRpm, "rpm")}</dd></div><div><dt>Nacelle bearing</dt><dd>{format(result.measurements.nacelleDeg, "°")}</dd></div><div><dt>Exported energy meter</dt><dd>{format(result.measurements.lifetimeEnergyKwh, "kWh")}</dd></div><div><dt>Operating hours</dt><dd>{format(result.measurements.operatingHours, "h")}</dd></div><div><dt>Status code</dt><dd>{result.measurements.status ?? "Unavailable"}</dd></div></dl></div>}
      <p className="mt-3 text-xs leading-relaxed text-moss-700">Direction turns the model; it does not change estimated power. Air density changes wind power density, not the unverified electrical curve. Rotor speed is animation, not a sensor prediction.</p>
    </details>
    {result.unsupported.length > 0 && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">No reliable numerical result for {result.unsupported.join(", ")}; turbine-specific data and validation are needed.</p>}
    <details className="rounded-xl border border-moss-200 bg-white p-4 text-xs leading-relaxed text-moss-800">
      <summary className="cursor-pointer text-sm font-semibold text-moss-950">Method, limits and sources</summary>
      <p className="mt-2">Model {result.modelVersion}. {result.method}.</p>
      <ul className="mt-2 list-disc space-y-1 pl-4">{result.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="mt-2">{result.sources.map((source, index) => <span key={source.url}>{index > 0 && " · "}<a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">{source.title}</a></span>)}</p>
    </details>
  </div>;
}

const WhatIfStudio = forwardRef(function WhatIfStudio({ onClose, onBusyChange, evaluate, screen }, ref) {
  const sequence = useRef(0);
  const [result, setResult] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [draft, setDraft] = useState(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  useEffect(() => {
    let alive = true;
    const id = ++sequence.current;
    setBusy(true);
    setError("");
    setResult(null);
    setDraft(null);
    setOrigin(null);
    evaluate({}).then((data) => {
      if (!alive || sequence.current !== id) return;
      setResult(data);
      setDraft(data.scenario.values);
      setOrigin({ source: data.baseline.source, observedAt: data.baseline.observedAt });
    }).catch((err) => { if (alive) setError(err.message || "The experiment could not load."); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; sequence.current++; };
  }, [evaluate]);

  async function run(body, question = null) {
    const id = ++sequence.current;
    setBusy(true);
    setError("");
    try {
      const data = await evaluate(result ? { ...body, baseline: result.baseline.values } : body);
      if (sequence.current !== id) return;
      setResult(data);
      setDraft(data.scenario.values);
      if (data.baseline.source === "your stated starting value") setOrigin({ source: data.baseline.source, observedAt: null });
      if (question) setLastPrompt(question);
    } catch (err) { if (sequence.current === id) setError(err.message || "Please check those values."); }
    finally { if (sequence.current === id) setBusy(false); }
  }

  const updateField = (key, value) => setDraft((previous) => ({ ...REFERENCE, ...previous, [key]: value === "" ? "" : Number(value) }));
  const applyFields = () => {
    if (!draft || Object.entries(FIELD).some(([key, field]) => !Number.isFinite(draft[key]) || draft[key] < field.min || draft[key] > field.max)) return setError("Check the supported ranges shown beside each value.");
    run({ changes: draft });
  };
  useImperativeHandle(ref, () => ({ send: (question) => { if (!busy && result) run({ prompt: question }, question); } }));
  const rpm = draft?.operatingPct === 0 ? 0 : draft && Number.isFinite(draft.windMs) && draft.windMs >= 0 && draft.windMs <= 34 ? theoreticalRotorRpm(draft.windMs) : result?.scenario.output.rotorRpm ?? 0;
  const values = draft ?? result?.scenario.values ?? REFERENCE;
  const dirty = result && !sameValues(values, result.scenario.values);
  const changed = result && !sameValues(result.scenario.values, result.baseline.values);

  return <section className="scenario-focus" aria-label="Try a scenario">
    <div className="studio-layout">
      <header className="studio-header flex items-center justify-between gap-4 border-b border-moss-200 bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-moss-600">Ask Ace · {screen} experiment</p><h2 className="font-display text-xl font-semibold text-moss-950 sm:text-2xl">Try a scenario</h2></div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-full border border-moss-200 px-4 py-2 text-sm font-semibold text-moss-900 hover:bg-moss-50">Back to chat</button>
      </header>
      <main className="studio-workspace min-h-0">
        <section className="studio-viewer relative min-h-0" aria-label="ACE wind turbine model">
          <ScenarioTurbine rpm={rpm} direction={values.windDeg} windMs={values.windMs} />
          <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-white/85 px-3 py-1.5 text-xs font-medium text-moss-950">Wind {format(values.windMs, "m/s")} · {format(values.windDeg, "°")}</div>
        </section>
        <aside className="studio-controls min-h-0 overflow-y-auto border-l border-moss-200 bg-white p-4 sm:p-5" aria-label="Customize the experiment">
          <div className="mb-3"><h3 className="font-display text-xl font-semibold text-moss-950">Customize</h3><p className="text-sm text-moss-700">Change a value or describe it in the Ask Ace box below. The turbine responds as you edit.</p></div>
          {lastPrompt && <p className="mb-3 rounded-lg border-l-4 border-moss-600 bg-moss-50 px-3 py-2 text-xs text-moss-800"><span className="font-semibold">Your scenario:</span> {lastPrompt}</p>}
          {result && <div className="mb-4 rounded-xl border border-moss-200 bg-moss-50 p-3" aria-label="Scenario results"><div className="mb-2 flex justify-between gap-2 text-xs font-semibold text-moss-700"><span>{dirty ? "Last calculated result" : "Estimated result"}</span><span>{result.estimateQuality}</span></div><div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-moss-700">Average power</p><p className="font-display text-lg font-semibold text-moss-950">{format(result.scenario.output.averagePowerKw, "kW")}</p><p className="text-[11px] text-moss-600">Baseline {format(result.baseline.output.averagePowerKw, "kW")}</p></div><div><p className="text-xs text-moss-700">Energy · {format(result.scenario.values.durationHours, "h")}</p><p className="font-display text-lg font-semibold text-moss-950">{format(result.scenario.output.energyKwh, "kWh")}</p><p className="text-[11px] text-moss-600">Baseline {format(result.baseline.output.energyKwh, "kWh")}</p></div></div><p className="mt-2 text-[11px] leading-relaxed text-moss-700">{origin?.source ?? result.baseline.source}{origin?.observedAt ? ` · ${new Date(origin.observedAt).toLocaleString()}` : " · assumed values"} · {result.method}</p></div>}
          <div className="grid grid-cols-2 gap-4"><Parameter field="windMs" value={values.windMs} onChange={updateField} slider /><Parameter field="windDeg" value={values.windDeg} onChange={updateField} slider /><Parameter field="durationHours" value={values.durationHours} onChange={updateField} /><Parameter field="gridLimitKw" value={values.gridLimitKw} onChange={updateField} /></div>
          <details className="mt-4 rounded-xl border border-moss-200 p-3"><summary className="cursor-pointer text-sm font-semibold text-moss-950">Research inputs</summary><p className="mt-2 text-xs text-moss-700">These are assumptions, not ACE sensor readings.</p><div className="mt-3 grid grid-cols-2 gap-3"><Parameter field="airDensityKgM3" value={values.airDensityKgM3} onChange={updateField} /><Parameter field="operatingPct" value={values.operatingPct} onChange={updateField} /></div><p className="mt-3 text-xs leading-relaxed text-moss-700">Air density changes wind power density only. Operating fraction changes estimated energy. Neither changes the turbine mesh.</p></details>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy || !dirty} onClick={applyFields} className="rounded-full bg-moss-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Update results</button><button type="button" disabled={busy || !(changed || dirty)} onClick={() => { setLastPrompt(""); run({}); }} className="rounded-full border border-moss-200 px-4 py-2 text-sm font-semibold text-moss-800 disabled:opacity-40">Reset</button></div>
          {dirty && <p className="mt-2 text-xs text-moss-700">The model shows your edit; results below still show the last calculation.</p>}
          {error && <p role="alert" className="mt-3 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
          {busy && <p role="status" className="mt-2 text-sm text-moss-700">Calculating…</p>}
          {result && <div className="mt-4"><Results result={result} /></div>}
          <details className="mt-3 rounded-xl border border-moss-200 p-4 text-xs leading-relaxed text-moss-700"><summary className="cursor-pointer text-sm font-semibold text-moss-950">Sensors and controls not modelled</summary><p className="mt-2">Blade pitch, vibration, bearing loads, torque and component temperatures need turbine-specific records and a validated model before this Studio can predict them. No experiment sends a command to ACE.</p></details>
        </aside>
      </main>
    </div>
  </section>;
});

export default WhatIfStudio;
