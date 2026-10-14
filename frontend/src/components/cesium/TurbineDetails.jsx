import { useEffect, useRef, useState } from "react";
import { useLiveStore } from "../../store/useLiveStore.js";
import { formatEnergy, formatPower } from "../../lib/format.js";
import Icon from "../ui/Icon.jsx";

export default function TurbineDetails({ id, onClose, onOverview }) {
  const state = useLiveStore((store) => store.state);
  const socketStatus = useLiveStore((store) => store.socketStatus);
  const closeRef = useRef(null);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const timer = setInterval(() => setClock(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const demo = state?.mode === "simulate";
  const observedAt = Date.parse(state?.liveAt);
  const hasReading = demo || Number.isFinite(observedAt);
  const fresh = !demo && state?.connected && socketStatus === "open" && clock - observedAt <= 30_000;
  const label = demo ? "Demo data" : fresh ? "Live reading" : hasReading ? "Last known reading" : "Awaiting live data";
  const now = state?.now;
  const power = hasReading && Number.isFinite(now?.activePowerKw) ? formatPower(Math.max(0, now.activePowerKw)) : null;
  const wind = hasReading && Number.isFinite(now?.windSpeed) ? now.windSpeed.toFixed(1) : "—";
  const today = state?.today;
  const hasToday = demo || Number.isFinite(Date.parse(state?.freshness?.today?.lastSuccessAt));
  const energy = hasToday && Number.isFinite(today?.energyKwh) ? formatEnergy(today.energyKwh) : null;
  const todayStale = !demo && (today?.stale || state?.freshness?.today?.failures);
  // Describe observed power instead of inferring a fault from stale status flags.
  const operation = !power ? "Waiting for a turbine reading" : now.activePowerKw > 0 ? "Generating electricity" : "Not generating";
  const time = Number.isFinite(observedAt)
    ? new Date(observedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
    : null;

  return (
    <aside id={id} className="turbine-details" aria-labelledby={`${id}-title`}>
      <div className="turbine-details-heading">
        <div>
          <p className="turbine-details-eyebrow">Your community turbine</p>
          <h2 id={`${id}-title`} className="font-display">ACE Wind Turbine</h2>
          <p className="turbine-details-location">Lawrence Weston, Bristol</p>
        </div>
        <button ref={closeRef} type="button" className="site-icon-button" onClick={onClose} aria-label="Close turbine details">
          <Icon name="close" className="size-5" />
        </button>
      </div>

      <p className="turbine-reading-status" role="status">
        <span className={`turbine-status-dot ${fresh ? "is-live" : ""}`} />{label}
      </p>
      <div className="turbine-power">
        <p className="turbine-metric-label">{!hasReading || fresh || demo ? "Power now" : "Last reported power"}</p>
        <p className="turbine-power-value">{power?.value ?? "—"}{" "}<span>{power?.unit ?? "kW"}</span></p>
        <p className="turbine-operation">{operation}</p>
      </div>

      <dl className="turbine-secondary-metrics">
        <div><dt>Wind speed</dt><dd>{wind} <span>m/s</span></dd></div>
        <div><dt>Energy today{todayStale ? " · delayed" : !demo && today?.energyMethod ? " · estimated" : ""}</dt><dd>{energy?.value ?? "—"} <span>{energy?.unit ?? "kWh"}</span></dd></div>
      </dl>
      <div className="turbine-details-footer">
        <p>{demo ? "Simulated readings" : time ? `Recorded ${time} · UK time` : "Readings appear when connected"}</p>
        <button type="button" onClick={onOverview}>Back to overview <span aria-hidden="true">↗</span></button>
      </div>
    </aside>
  );
}
