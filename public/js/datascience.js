import { onState } from "./ws-client.js";
import { TurbineAnimator } from "./turbine-anim.js";
import { initNav } from "./hotkey-nav.js";
import { tipSpeedMs, msToMph, capacityFactorPct } from "./metrics.js";
import { COMMISSION_DATE_ISO, RATED_POWER_KW } from "./constants.js";

// Init hidden hotkey navigation
initNav({ current: "datascience" });

// DOM Elements
const connDot = document.getElementById("conn-dot");
const chartMarkerLabel = document.getElementById("chart-marker-label");
const tCf = document.getElementById("t-cf");
const tTip = document.getElementById("t-tip");
const tTipMph = document.getElementById("t-tip-mph");
const tGrid = document.getElementById("t-grid");
const tCurtailFlag = document.getElementById("t-curtail-flag");
const tLifetime = document.getElementById("t-lifetime");
const rpmBadge = document.getElementById("rpm-badge");
const compassPointer = document.getElementById("compass-pointer");
const compassDegrees = document.getElementById("compass-degrees");

const canvas = document.getElementById("power-curve-canvas");
const ctx = canvas.getContext("2d");

const techRotorGroup = document.getElementById("tech-rotor-group");
const techNacelleGroup = document.getElementById("tech-nacelle-group");

const animator = new TurbineAnimator({
  rotorGroupEl: techRotorGroup,
  nacelleGroupEl: techNacelleGroup,
});
animator.start();

let liveWind = 5.5;
let livePower = 650;
let empiricalBins = [];
let theoreticalPoints = [];

// Fallback Enercon E-115 EP3 Theoretical Power Curve
function fallbackTheoreticalPower(ws) {
  if (ws < 2.5) return 0;
  if (ws >= 12.5 && ws < 28.0) return 4245;
  if (ws >= 28.0) return 0;
  const frac = (ws - 2.5) / (12.5 - 2.5);
  return Math.min(4245, Math.pow(frac, 2.6) * 4245);
}

// Draw the Power Curve Chart on Canvas with real TimescaleDB binned data
function drawPowerCurve() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const padLeft = 60;
  const padBottom = 40;
  const padRight = 30;
  const padTop = 20;

  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  const maxWind = 25.0; // m/s
  const maxKw = 4500.0; // kW

  const toX = (wind) => padLeft + (wind / maxWind) * plotW;
  const toY = (kw) => padTop + plotH - (kw / maxKw) * plotH;

  // 1. Grid Lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;

  // Horizontal Power Grid Lines (every 1000 kW)
  ctx.fillStyle = "#64748b";
  ctx.font = "10px Inter, sans-serif";
  ctx.textAlign = "right";

  for (let kw = 0; kw <= 4000; kw += 1000) {
    const y = toY(kw);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + plotW, y);
    ctx.stroke();
    ctx.fillText(`${kw} kW`, padLeft - 10, y + 4);
  }

  // Vertical Wind Grid Lines (every 5 m/s)
  ctx.textAlign = "center";
  for (let wind = 0; wind <= 25; wind += 5) {
    const x = toX(wind);
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + plotH);
    ctx.stroke();
    ctx.fillText(`${wind} m/s`, x, padTop + plotH + 18);
  }

  // 2. Draw Empirical 10m SCADA Bins (from 11,219 TimescaleDB rows)
  if (empiricalBins.length) {
    for (const bin of empiricalBins) {
      if (bin.bin_wind > 0 && bin.sample_count > 0) {
        const bx = toX(bin.bin_wind);
        const yMin = toY(Math.max(0, bin.power_min_kw));
        const yMax = toY(Math.min(maxKw, bin.power_max_kw));
        const yAvg = toY(Math.max(0, bin.power_avg_kw));

        // Draw min-to-max error bar
        ctx.strokeStyle = "rgba(251, 191, 36, 0.22)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, yMin);
        ctx.lineTo(bx, yMax);
        ctx.stroke();

        // Draw solid amber empirical mean dot
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(bx, yAvg, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 3. Draw Theoretical E-115 Reference Curve (Cyan line)
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3;
  ctx.beginPath();

  if (theoreticalPoints.length) {
    let first = true;
    for (const pt of theoreticalPoints) {
      const x = toX(Math.min(maxWind, pt.wind));
      const y = toY(Math.min(maxKw, pt.power));
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
  } else {
    let first = true;
    for (let wind = 0; wind <= 25; wind += 0.25) {
      const p = fallbackTheoreticalPower(wind);
      const x = toX(wind);
      const y = toY(p);
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
  }
  ctx.stroke();

  // 4. Highlight Rated & Cut-in Markers
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  // Cut-in 2.5
  ctx.beginPath();
  ctx.moveTo(toX(2.5), padTop);
  ctx.lineTo(toX(2.5), padTop + plotH);
  ctx.stroke();
  // Rated 12.5
  ctx.beginPath();
  ctx.moveTo(toX(12.5), padTop);
  ctx.lineTo(toX(12.5), padTop + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  // 5. Draw Live Operational Marker (Pulsing Target)
  const curX = toX(Math.min(maxWind, Math.max(0, liveWind)));
  const curY = toY(Math.min(maxKw, Math.max(0, livePower)));

  // Target glow ring
  ctx.strokeStyle = "#34d399";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(curX, curY, 12, 0, Math.PI * 2);
  ctx.stroke();

  // Target center dot
  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(curX, curY, 6, 0, Math.PI * 2);
  ctx.fill();
}

// Fetch historical power curve from TimescaleDB
async function loadPowerCurve() {
  try {
    const res = await fetch("/api/history/power-curve");
    if (!res.ok) return;
    const data = await res.json();
    if (data.empirical && data.empirical.length) {
      empiricalBins = data.empirical;
    }
    if (data.theoretical && data.theoretical.length) {
      theoreticalPoints = data.theoretical;
    }
    drawPowerCurve();
  } catch (err) {
    console.warn("Could not load power curve:", err);
  }
}

// Fetch historical all-time records & monthly comparison
async function loadRecordsAndCompare() {
  try {
    const [recRes, compRes] = await Promise.all([
      fetch("/api/history/records"),
      fetch("/api/history/compare")
    ]);

    if (recRes.ok) {
      const records = await recRes.json();
      const recWindEl = document.getElementById("rec-wind");
      const recDayEl = document.getElementById("rec-day");
      const yieldSubEl = document.getElementById("t-yield-sub");

      if (records.peak_wind && recWindEl) {
        const d = new Date(records.peak_wind.timestamp);
        recWindEl.textContent = `${records.peak_wind.wind_max_ms} m/s (${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })})`;
      }

      if (records.highest_daily_energy && recDayEl) {
        const d = new Date(records.highest_daily_energy.date);
        recDayEl.textContent = `${Math.round(records.highest_daily_energy.energy_kwh).toLocaleString()} kWh (${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })} · ${records.highest_daily_energy.capacity_factor_pct}% CF)`;
      }

      if (records.totals) {
        if (tLifetime) {
          tLifetime.textContent = `${(records.totals.total_energy_kwh / 1_000_000).toFixed(2)} GWh`;
        }
        if (yieldSubEl) {
          yieldSubEl.textContent = `${records.totals.total_days} Days · ${records.totals.homes_powered_estimate.toLocaleString()} Homes`;
        }
      }
    }

    if (compRes.ok) {
      const compare = await compRes.json();
      const recCompEl = document.getElementById("rec-compare");
      if (compare.monthly_comparison && recCompEl) {
        const delta = compare.monthly_comparison.delta_energy_pct;
        const sign = delta > 0 ? "+" : "";
        recCompEl.textContent = `${sign}${delta}% (Aug vs Sep)`;
      }
    }
  } catch (err) {
    console.warn("Could not load records & compare:", err);
  }
}

loadPowerCurve();
loadRecordsAndCompare();

// WebSocket Listener
onState((snapshot) => {
  const isSim = snapshot.mode === "simulate";
  connDot.className = isSim ? "conn-dot simulate" : "conn-dot";

  const now = snapshot.now || {};
  const windSpeed = typeof now.windSpeed === "number" ? now.windSpeed : 0;
  const powerKw = typeof now.activePowerKw === "number" ? now.activePowerKw : 0;
  const rotorRpm = typeof now.rotorRpm === "number" ? now.rotorRpm : 0;
  const nacelleDeg = typeof now.nacelleDeg === "number" ? now.nacelleDeg : 0;

  liveWind = windSpeed;
  livePower = powerKw;

  // Drive animator
  animator.setTelemetry({ rotorRpm, nacelleDeg });

  // Update Compass
  compassPointer.style.transform = `rotate(${nacelleDeg}deg)`;
  compassDegrees.textContent = `Heading: ${Math.round(nacelleDeg)}°`;

  // Update Telemetry Row
  rpmBadge.textContent = `${rotorRpm.toFixed(1)} RPM`;

  const tipMs = tipSpeedMs(rotorRpm);
  tTip.textContent = `${tipMs.toFixed(1)} m/s`;
  tTipMph.textContent = `${Math.round(msToMph(tipMs))} mph`;

  const lifetimeKwh = now.lifetimeEnergyKwh || 34500000;
  const cf = capacityFactorPct(lifetimeKwh, new Date(COMMISSION_DATE_ISO));
  tCf.textContent = `${cf.toFixed(1)}%`;

  const lifetimeGwh = (lifetimeKwh / 1_000_000).toFixed(2);
  tLifetime.textContent = `${lifetimeGwh} GWh`;

  const setpoint = now.availablePowerAfterSetpoints;
  if (typeof setpoint === "number" && setpoint < 4000) {
    tGrid.textContent = `${Math.round(setpoint)} kW`;
    tCurtailFlag.textContent = "Curtailed by DNO";
    tCurtailFlag.style.color = "#f59e0b";
  } else {
    tGrid.textContent = "4,200 kW";
    tCurtailFlag.textContent = "Unconstrained";
    tCurtailFlag.style.color = "#94a3b8";
  }

  chartMarkerLabel.textContent = `Live Point: ${windSpeed.toFixed(1)} m/s @ ${Math.round(powerKw)} kW`;

  drawPowerCurve();
});
