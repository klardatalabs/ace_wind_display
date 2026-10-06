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
let historyPoints = [];

// Enercon E-115 EP3 Theoretical Power Curve (m/s -> kW)
function theoreticalPower(ws) {
  if (ws < 2.5) return 0;
  if (ws >= 12.5 && ws < 28.0) return 4245;
  if (ws >= 28.0) return 0; // Cut-out
  // Cubic ramp approximation
  const frac = (ws - 2.5) / (12.5 - 2.5);
  return Math.min(4245, Math.pow(frac, 2.6) * 4245);
}

// Draw the Power Curve Chart on Canvas
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

  // 2. Plot Historical Data Points (if available)
  if (historyPoints.length) {
    ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
    for (const pt of historyPoints) {
      if (pt.wind >= 0 && pt.power >= 0) {
        const px = toX(Math.min(maxWind, pt.wind));
        const py = toY(Math.min(maxKw, pt.power));
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 3. Draw Theoretical E-115 Reference Curve
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  let first = true;
  for (let wind = 0; wind <= 25; wind += 0.25) {
    const p = theoreticalPower(wind);
    const x = toX(wind);
    const y = toY(p);
    if (first) {
      ctx.moveTo(x, y);
      first = false;
    } else {
      ctx.lineTo(x, y);
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

// Fetch historical 48h data points to overlay
async function loadHistory() {
  try {
    const res = await fetch("/api/history?hours=48");
    if (!res.ok) return;
    const data = await res.json();
    if (data.wind && data.power) {
      historyPoints = data.wind.map((w, i) => ({
        wind: w,
        power: data.power[i],
      }));
      drawPowerCurve();
    }
  } catch (err) {
    console.warn("Could not load history points:", err);
  }
}

loadHistory();

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
