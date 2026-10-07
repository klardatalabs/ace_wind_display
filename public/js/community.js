import { onState } from "./ws-client.js";
import { ThreeTurbine } from "./three-turbine.js";
import { initNav } from "./hotkey-nav.js";
import { classifyMood } from "./turbine-mood.js";
import { homesPoweredNow, treesEquivalent, co2AvoidedKg, communityFundGbp, beaufortLabel } from "./metrics.js";
import {
  homesStory,
  fuelPovertyStory,
  cleanAirStory,
  windMoodStory,
  landmarkPrideStory,
  moodStory,
} from "./stories-community.js";

// Initialize hidden hotkeys & hover drawer
initNav({ current: "community" });

// DOM Elements
const storyCard = document.getElementById("story-card");
const kickerIcon = document.getElementById("kicker-icon");
const kickerText = document.getElementById("kicker-text");
const headlineEl = document.getElementById("story-headline");
const leadEl = document.getElementById("story-lead");
const statNumberEl = document.getElementById("story-stat-number");
const statContextEl = document.getElementById("story-stat-context");
const prideMottoEl = document.getElementById("story-pride-motto");
const statusPlainText = document.getElementById("status-plain-text");
const connDot = document.getElementById("conn-dot");
const badgeText = document.getElementById("badge-text");

// Initialize Authentic 3D Blender Turbine (Enercon E-115 WebGL)
const turbineContainer = document.getElementById("three-turbine-container");
const turbine = new ThreeTurbine(turbineContainer);

// Background Environment Switcher (Lush Hills vs Real Drone Photo)
const btnHills = document.getElementById("btn-hills");
const btnDrone = document.getElementById("btn-drone");
const layerHills = document.getElementById("layer-green-hills");
const layerDrone = document.getElementById("layer-drone-site");

function setBackground(mode) {
  if (mode === "drone") {
    layerHills?.classList.remove("active");
    layerDrone?.classList.add("active");
    btnHills?.classList.remove("active");
    btnDrone?.classList.add("active");
    if (badgeText) badgeText.textContent = "📍 Real Site · Lawrence Weston & Severn Estuary, Bristol";
    localStorage.setItem("ace_community_bg", "drone");
  } else {
    layerDrone?.classList.remove("active");
    layerHills?.classList.add("active");
    btnDrone?.classList.remove("active");
    btnHills?.classList.add("active");
    if (badgeText) badgeText.textContent = "Interactive 3D Enercon E-115 · Drag to Orbit";
    localStorage.setItem("ace_community_bg", "hills");
  }
}

btnHills?.addEventListener("click", () => setBackground("hills"));
btnDrone?.addEventListener("click", () => setBackground("drone"));

// Load saved preference (defaults to lush green hills)
const savedBg = localStorage.getItem("ace_community_bg") || "hills";
setBackground(savedBg);

// Hotkey 'B' toggles background
window.addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  if (e.key === "b" || e.key === "B") {
    const current = localStorage.getItem("ace_community_bg") || "hills";
    setBackground(current === "hills" ? "drone" : "hills");
  }
});

let latestState = null;
let currentStoryIndex = 0;
const ROTATION_INTERVAL_MS = 8000;

// Listen to WebSocket broadcasts
onState((snapshot) => {
  latestState = snapshot;

  const isSim = snapshot.mode === "simulate";
  connDot.className = isSim ? "conn-dot simulate" : "conn-dot";

  const now = snapshot.now || {};
  const rotorRpm = typeof now.rotorRpm === "number" ? now.rotorRpm : 0;
  const windSpeed = typeof now.windSpeed === "number" ? now.windSpeed : 0;
  const powerKw = typeof now.activePowerKw === "number" ? now.activePowerKw : 0;
  const homes = homesPoweredNow(powerKw);
  const mood = classifyMood(snapshot.statusEvent, now);

  // Drive 3D turbine rotation & yaw azimuth smoothly
  turbine.setTelemetry({ rotorRpm, nacelleYaw: now.nacelleAzimuthDeg });

  // Update plain English status (Zero engineering jargon!)
  if (mood === "storm") {
    statusPlainText.textContent = "Blades feathered sideways to stay safe during storm";
  } else if (mood === "calm" || (windSpeed < 1.0 && powerKw <= 0)) {
    statusPlainText.textContent = "Blades resting peacefully in calm coastal air";
  } else if (mood === "curtailed") {
    statusPlainText.textContent = "Holding back power so the regional grid stays balanced";
  } else if (mood === "maintenance") {
    statusPlainText.textContent = "Technicians on site giving our turbine a health check-up";
  } else if (homes > 0) {
    statusPlainText.textContent = `Generating clean wind energy for ~${homes.toLocaleString()} local homes`;
  } else {
    statusPlainText.textContent = "Standing proud over Avonmouth & Lawrence Weston";
  }
});

// Compile active human-only story beats
function getAvailableStories() {
  if (!latestState) return [];

  const now = latestState.now || {};
  const today = latestState.today || {};
  const mood = classifyMood(latestState.statusEvent, now);

  const powerKw = now.activePowerKw || 0;
  const homes = homesPoweredNow(powerKw);
  const windSpeed = now.windSpeed || 0;
  const beaufort = beaufortLabel(windSpeed);

  const todayKwh = today.energyKwh || Math.max(250, Math.round(Math.max(10, powerKw) * 4));
  const co2Kg = co2AvoidedKg(todayKwh);
  const trees = Math.round(treesEquivalent(co2Kg));
  const fundGbp = Math.round(communityFundGbp(todayKwh));

  const stories = [];

  // 1. Mood story if unusual weather or condition
  const mStory = moodStory(mood);
  if (mStory && mood !== "generating") {
    stories.push(mStory);
  }

  // 2. Homes lit up right now (Always popular and relatable!)
  stories.push(homesStory(homes));

  // 3. Fuel poverty fund & heating vouchers
  stories.push(fuelPovertyStory(fundGbp));

  // 4. Clean air & trees planted
  stories.push(cleanAirStory(trees));

  // 5. Coastal wind in natural words
  stories.push(windMoodStory(beaufort));

  // 6. 100% Resident-Owned Community Pride
  stories.push(landmarkPrideStory());

  // 7. All-time Historical Generation Record from TimescaleDB
  if (historicalRecords && historicalRecords.highest_daily_energy) {
    const bestDay = historicalRecords.highest_daily_energy;
    const totals = historicalRecords.totals || {};
    stories.push({
      badge: "COMMUNITY RECORD",
      icon: "🌟",
      headline: `Our Record Day: ${fmtInt(bestDay.energy_kwh)} kWh Generated`,
      lead: `On 18 September, our turbine generated an astounding ${fmtInt(bestDay.energy_kwh)} kWh of clean electricity in 24 hours — running at ${bestDay.capacity_factor_pct}% capacity and setting our all-time community benchmark!`,
      stat: `${fmtInt(bestDay.energy_kwh)} kWh in 24h`,
      statUnit: `our single-day record · ${totals.homes_powered_estimate ? fmtInt(totals.homes_powered_estimate) + ' homes powered to date' : '100% clean power'}`,
      pride: `Over ${(totals.total_energy_kwh / 1_000_000).toFixed(2)} GWh of clean energy produced so far for Lawrence Weston.`
    });
  }

  return stories;
}

const fmtInt = (n) => Math.round(n).toLocaleString();
let historicalRecords = null;

async function loadHistoricalRecords() {
  try {
    const res = await fetch("/api/history/records");
    if (res.ok) {
      historicalRecords = await res.json();
    }
  } catch (err) {
    console.warn("Could not load community historical records:", err);
  }
}
loadHistoricalRecords();

// Render story beat with smooth transition
function renderCurrentStory() {
  const stories = getAvailableStories();
  if (!stories.length) return;

  const beat = stories[currentStoryIndex % stories.length];

  storyCard.style.animation = "heroOut 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards";

  setTimeout(() => {
    kickerIcon.textContent = beat.icon || "🏡";
    kickerText.textContent = beat.badge || "COMMUNITY IMPACT";
    headlineEl.textContent = beat.headline || "";
    leadEl.textContent = beat.lead || "";
    statNumberEl.textContent = beat.stat || "";
    statContextEl.textContent = beat.statUnit || "";
    prideMottoEl.textContent = beat.pride || "100% community-owned by Lawrence Weston residents.";

    storyCard.style.animation = "heroIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards";
  }, 350);

  currentStoryIndex++;
}

setTimeout(() => {
  renderCurrentStory();
  setInterval(renderCurrentStory, ROTATION_INTERVAL_MS);
}, 500);
