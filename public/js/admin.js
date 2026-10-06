import { onState } from "./ws-client.js";
import { homesPoweredNow, tipSpeedMs, msToMph } from "./metrics.js";
import { classifyMood } from "./turbine-mood.js";

// DOM elements
const statusPill = document.getElementById("server-status-pill");
const connDot = document.getElementById("admin-conn-dot");
const modeLabel = document.getElementById("server-mode-label");
const resumeBtn = document.getElementById("resume-live-btn");
const monitorBadge = document.getElementById("monitor-mode-badge");

const slideWind = document.getElementById("slide-wind");
const slidePower = document.getElementById("slide-power");
const slideRpm = document.getElementById("slide-rpm");
const slideYaw = document.getElementById("slide-yaw");
const selectStatus = document.getElementById("select-status");
const sliderForm = document.getElementById("slider-form");

const valWind = document.getElementById("val-wind");
const valPower = document.getElementById("val-power");
const valRpm = document.getElementById("val-rpm");
const valYaw = document.getElementById("val-yaw");

const monWind = document.getElementById("mon-wind");
const monPower = document.getElementById("mon-power");
const monRpm = document.getElementById("mon-rpm");
const monHomes = document.getElementById("mon-homes");
const monTip = document.getElementById("mon-tip");
const monMood = document.getElementById("mon-mood");
const monJson = document.getElementById("mon-json");

// Update slider labels live
function updateSliderLabels() {
  valWind.textContent = `${Number(slideWind.value).toFixed(1)} m/s`;
  valPower.textContent = `${Math.round(slidePower.value)} kW`;
  valRpm.textContent = `${Number(slideRpm.value).toFixed(1)} rpm`;
  valYaw.textContent = `${Math.round(slideYaw.value)}°`;
}

slideWind.addEventListener("input", () => {
  // Automatically suggest reasonable power & RPM for quick sliding
  const w = Number(slideWind.value);
  if (w < 2.5) {
    slidePower.value = 0;
    slideRpm.value = (w * 0.2).toFixed(1);
  } else if (w >= 12.5 && w < 28) {
    slidePower.value = 4200;
    slideRpm.value = 13.5;
  } else if (w >= 28) {
    slidePower.value = 0;
    slideRpm.value = 0.5;
  } else {
    // intermediate cubic curve approximation
    const frac = (w - 2.5) / 10.0;
    slidePower.value = Math.min(4200, Math.round(Math.pow(frac, 2.5) * 4200));
    slideRpm.value = (5 + frac * 8.5).toFixed(1);
  }
  updateSliderLabels();
});

slidePower.addEventListener("input", updateSliderLabels);
slideRpm.addEventListener("input", updateSliderLabels);
slideYaw.addEventListener("input", updateSliderLabels);
updateSliderLabels();

// 1. Preset buttons
document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const preset = btn.dataset.preset;
    try {
      const res = await fetch("/api/admin/preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      btn.style.borderColor = "#10b981";
      setTimeout(() => { btn.style.borderColor = ""; }, 600);
    } catch (err) {
      alert(`Failed to set preset: ${err.message}`);
    }
  });
});

// 2. Manual Slider Form Submit
sliderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const windSpeed = Number(slideWind.value);
  const activePowerKw = Number(slidePower.value);
  const rotorRpm = Number(slideRpm.value);
  const nacelleDeg = Number(slideYaw.value);
  const statusVal = selectStatus.value;

  let main_status = 0;
  let fault_message_flag = 0;
  let service_flag = 0;

  if (statusVal === "calm" || statusVal === "curtailed") main_status = 1;
  else if (statusVal === "starting") main_status = 2;
  else if (statusVal === "maintenance") { main_status = 9; service_flag = 1; }
  else if (statusVal === "fault") { main_status = 9; fault_message_flag = 1; }

  const payload = {
    now: {
      windSpeed,
      activePowerKw,
      rotorRpm,
      nacelleDeg,
      availablePowerAfterSetpoints: statusVal === "curtailed" ? activePowerKw : 4200,
      theoreticalMaxPower: 4245,
    },
    statusEvent: {
      main_status,
      substatus: 0,
      fault_message_flag,
      warning_message_flag: 0,
      service_flag,
    },
  };

  try {
    const res = await fetch("/api/admin/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    alert(`Failed to simulate: ${err.message}`);
  }
});

// 3. Resume Live
resumeBtn.addEventListener("click", async () => {
  try {
    const res = await fetch("/api/admin/resume-live", { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    alert(`Failed to resume live: ${err.message}`);
  }
});

// 4. WebSocket listener
onState((snapshot) => {
  const isSim = snapshot.mode === "simulate";

  connDot.className = isSim ? "conn-dot simulate" : "conn-dot";
  modeLabel.textContent = isSim ? "Simulated Mode (Override Active)" : "Live ACE API (Streaming)";
  monitorBadge.textContent = isSim ? "SIMULATED" : "LIVE";
  monitorBadge.className = isSim ? "badge" : "badge";
  monitorBadge.style.color = isSim ? "#f59e0b" : "#10b981";
  monitorBadge.style.borderColor = isSim ? "#f59e0b" : "#10b981";

  const now = snapshot.now || {};
  const wind = now.windSpeed != null ? `${Number(now.windSpeed).toFixed(1)} m/s` : "--";
  const power = now.activePowerKw != null ? `${Math.round(now.activePowerKw)} kW` : "--";
  const rpm = now.rotorRpm != null ? `${Number(now.rotorRpm).toFixed(1)} rpm` : "--";
  const homes = now.activePowerKw != null ? homesPoweredNow(now.activePowerKw).toLocaleString() : "--";

  const tipMs = now.rotorRpm != null ? tipSpeedMs(now.rotorRpm) : 0;
  const tipMph = tipMs > 0 ? `${Math.round(msToMph(tipMs))} mph` : "--";
  const mood = classifyMood(snapshot.statusEvent, now);

  monWind.textContent = wind;
  monPower.textContent = power;
  monRpm.textContent = rpm;
  monHomes.textContent = homes;
  monTip.textContent = tipMph;
  monMood.textContent = mood.toUpperCase();

  monJson.textContent = JSON.stringify(snapshot, null, 2);
});
