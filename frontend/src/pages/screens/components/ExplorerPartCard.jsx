import { useEffect, useRef, useState } from "react";
import { EXPLORER_PARTS } from "../../../content/explorerParts.js";
import { useLiveStore } from "../../../store/useLiveStore.js";
import { formatPower } from "../../../lib/format.js";
import Icon from "../../../components/ui/Icon.jsx";

export default function ExplorerPartCard({ partId, selectionKey, selectionLabel, inside, onClose, onEnter }) {
  const part = EXPLORER_PARTS[partId];
  const closeRef = useRef(null);
  const state = useLiveStore(s => s.state);
  const socket = useLiveStore(s => s.socketStatus);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, [partId, selectionKey]);
  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);
  if (!part) return null;
  const demo = state?.mode === "simulate";
  const recordedAt = Date.parse(state?.liveAt);
  const available = demo || Number.isFinite(recordedAt);
  const fresh = !demo && state?.connected && socket === "open" && clock - recordedAt <= 30000;
  const readingLabel = demo ? "Demo reading" : fresh ? "Live reading" : available ? "Last known reading" : "Awaiting readings";
  const now = state?.now;
  const metrics = {
    rpm: ["Rotor speed", available && Number.isFinite(now?.rotorRpm) ? `${now.rotorRpm.toFixed(1)} rpm` : "—"],
    wind: ["Wind speed", available && Number.isFinite(now?.windSpeed) ? `${now.windSpeed.toFixed(1)} m/s` : "—"],
    bearing: ["Nacelle bearing", available && Number.isFinite(now?.nacelleDeg) ? `${Math.round(now.nacelleDeg)}°` : "—"],
    power: ["Turbine output", available && Number.isFinite(now?.activePowerKw) ? Object.values(formatPower(Math.max(0, now.activePowerKw))).join(" ") : "—"],
  };
  const facts = [...part.facts, ...(part.metric ? [metrics[part.metric]] : partId === "turbine" ? [metrics.power, metrics.wind] : [])];
  const recorded = Number.isFinite(recordedAt) ? new Date(recordedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : null;

  return (
    <aside className="explorer-part-card explorer-glass" aria-labelledby="explorer-part-title" key={selectionKey ?? partId}>
      <div className="explorer-card-heading">
        <div><p className="explorer-eyebrow">{part.area}</p><h2 id="explorer-part-title">{part.title}</h2></div>
        <button ref={closeRef} className="explorer-icon-button" type="button" aria-label="Close part information" onClick={onClose}><Icon name="close" className="size-5" /></button>
      </div>
      {inside && selectionLabel && <p className="explorer-selection-label">{selectionLabel} · highlighted in the scene</p>}
      <p className="explorer-card-description">{part.description}</p>
      <div className="explorer-why"><h3>Why it matters</h3><p>{part.why}</p></div>
      {facts.length > 0 && <dl className="explorer-card-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      {(part.metric || partId === "turbine") && <p className="explorer-reading-label"><span className={fresh ? "is-live" : ""} />{readingLabel}{!demo && recorded ? ` · ${recorded} UK` : ""}</p>}
      {part.observe && <p className="explorer-observe">{part.observe}</p>}
      {part.enter && !inside && <button type="button" className="explorer-enter" onClick={() => onEnter(part.enter)}>{part.enter === "nacelle" ? "Enter the machine room" : "Enter the tower"}<Icon name="arrowRight" className="size-4" /></button>}
      <div className="explorer-card-source">
        <span>{inside ? "Illustrated interior" : "Real-world site · ACE turbine model"}</span>
        <a href={part.source.url} target="_blank" rel="noreferrer">{part.source.label} <span aria-hidden="true">↗</span></a>
        {(part.reference || ["blade", "hub", "tower", "foundation"].includes(partId)) && <a href={part.reference?.url ?? "https://ambitioncommunityenergy.org/gallery/"} target="_blank" rel="noreferrer">{part.reference?.label ?? "See ACE construction photos"} <span aria-hidden="true">↗</span></a>}
      </div>
    </aside>
  );
}
