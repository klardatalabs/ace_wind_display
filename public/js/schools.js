import { onState } from "./ws-client.js";
import { TurbineAnimator } from "./turbine-anim.js";
import { initNav } from "./hotkey-nav.js";
import { classifyMood } from "./turbine-mood.js";
import { homesPoweredNow, tipSpeedMs, msToMph, co2AvoidedKg, treesEquivalent } from "./metrics.js";
import {
  moodStory,
  powerStory,
  tipSpeedStory,
  sweepStory,
  heightStory,
  cleanAirStory,
  howItWorksStory,
} from "./stories-schools.js";

// Initialize hidden hotkeys & quick switcher
initNav({ current: "schools" });

// DOM Elements
const cardEl = document.getElementById("schools-story-card");
const badgeEmoji = document.getElementById("badge-emoji");
const badgeText = document.getElementById("badge-text");
const headlineEl = document.getElementById("kid-headline");
const leadEl = document.getElementById("kid-lead");
const statValEl = document.getElementById("kid-stat-val");
const statDescEl = document.getElementById("kid-stat-desc");

const kidFaceIcon = document.getElementById("kid-face-icon");
const kidMoodText = document.getElementById("kid-mood-text");
const kidSpeedText = document.getElementById("kid-speed-text");
const connDot = document.getElementById("conn-dot");

const snoozeBubble = document.getElementById("snooze-bubble");
const gustLines = document.getElementById("gust-lines");
const bodyFlex = document.getElementById("turbine-body-flex");
const maintenanceIcon = document.getElementById("maintenance-icon");

// Face SVG elements
const leftEyeWhite = document.getElementById("left-eye-white");
const leftPupil = document.getElementById("left-pupil");
const leftShutEye = document.getElementById("left-shut-eye");

const rightEyeWhite = document.getElementById("right-eye-white");
const rightPupil = document.getElementById("right-pupil");
const rightShutEye = document.getElementById("right-shut-eye");

const mouthHappy = document.getElementById("mouth-happy");
const mouthSleepy = document.getElementById("mouth-sleepy");
const mouthStrained = document.getElementById("mouth-strained");
const mouthDizzy = document.getElementById("mouth-dizzy");

const rotorGroup = document.getElementById("char-rotor-group");

// Set up smooth blade rotation animator
const animator = new TurbineAnimator({
  rotorGroupEl: rotorGroup,
});
animator.start();

let latestState = null;
let currentStoryIndex = 0;
const ROTATION_INTERVAL_MS = 8000;

// Character Face State Machine
function setFaceState({ eyes = "open", mouth = "happy", showMaintenance = false, towerBend = 0 }) {
  // 1. Eyes
  if (eyes === "closed") {
    leftEyeWhite.style.display = "none";
    leftPupil.style.display = "none";
    leftShutEye.style.display = "block";

    rightEyeWhite.style.display = "none";
    rightPupil.style.display = "none";
    rightShutEye.style.display = "block";
  } else {
    leftEyeWhite.style.display = "block";
    leftPupil.style.display = "block";
    leftShutEye.style.display = "none";

    rightEyeWhite.style.display = "block";
    rightPupil.style.display = "block";
    rightShutEye.style.display = "none";
  }

  // 2. Mouth
  mouthHappy.style.display = mouth === "happy" ? "block" : "none";
  mouthSleepy.style.display = mouth === "sleepy" ? "block" : "none";
  mouthStrained.style.display = mouth === "strained" ? "block" : "none";
  mouthDizzy.style.display = mouth === "dizzy" ? "block" : "none";

  // 3. Maintenance badge
  maintenanceIcon.style.display = showMaintenance ? "block" : "none";

  // 4. Physical Tower Bend
  if (towerBend !== 0) {
    bodyFlex.style.transform = `skewX(${towerBend.toFixed(1)}deg) rotate(${(towerBend * 0.4).toFixed(1)}deg)`;
    bodyFlex.style.transition = "transform 0.4s ease";
  } else {
    bodyFlex.style.transform = "none";
    bodyFlex.style.transition = "transform 0.8s ease";
  }
}

// Eye blink timer for lively natural cartoon look
setInterval(() => {
  if (latestState) {
    const windSpeed = latestState.now?.windSpeed || 0;
    if (windSpeed >= 2.5 && windSpeed < 20) {
      // Quick cute blink
      leftShutEye.style.display = "block";
      rightShutEye.style.display = "block";
      leftEyeWhite.style.display = "none";
      rightEyeWhite.style.display = "none";
      leftPupil.style.display = "none";
      rightPupil.style.display = "none";

      setTimeout(() => {
        leftShutEye.style.display = "none";
        rightShutEye.style.display = "none";
        leftEyeWhite.style.display = "block";
        rightEyeWhite.style.display = "block";
        leftPupil.style.display = "block";
        rightPupil.style.display = "block";
      }, 180);
    }
  }
}, 4200);

// WebSocket Listener
onState((snapshot) => {
  latestState = snapshot;

  const isSim = snapshot.mode === "simulate";
  connDot.className = isSim ? "conn-dot simulate" : "conn-dot";

  const now = snapshot.now || {};
  const rotorRpm = typeof now.rotorRpm === "number" ? now.rotorRpm : 0;
  const windSpeed = typeof now.windSpeed === "number" ? now.windSpeed : 0;
  const mood = classifyMood(snapshot.statusEvent, now);

  // Drive blade rotation
  animator.setTelemetry({ rotorRpm });

  // Human wind description for kids
  let windLabel = "Gentle Breeze";
  if (windSpeed < 1.0) windLabel = "Gentle Calm";
  else if (windSpeed > 18.0) windLabel = "Super Strong Gale!";
  else if (windSpeed > 10.0) windLabel = "Brisk Wind!";
  kidSpeedText.textContent = `Wind: ${windLabel}`;

  // React visually to live telemetry & wind
  // Only enter sleep state if explicitly simulated as dead calm or wind is virtually dead (< 0.6 m/s)
  if ((isSim && mood === "calm") || windSpeed < 0.6) {
    // SLEEPY / NAP
    setFaceState({ eyes: "closed", mouth: "sleepy", towerBend: 0 });
    snoozeBubble.style.display = "flex";
    gustLines.style.display = "none";
    kidFaceIcon.textContent = "😴";
    kidMoodText.textContent = "Mood: Resting & Catching 40 Winks!";
  } else if (mood === "storm" || windSpeed >= 28) {
    // STORM CUT-OUT
    setFaceState({ eyes: "closed", mouth: "dizzy", towerBend: -7 });
    snoozeBubble.style.display = "none";
    gustLines.style.display = "flex";
    kidFaceIcon.textContent = "🌪️";
    kidMoodText.textContent = "Mood: Big Storm! Feathered Safe!";
  } else if (windSpeed > 13) {
    // HIGH GALE - EXCITED BEND
    const bend = Math.min(10, (windSpeed - 10) * 0.7);
    setFaceState({ eyes: "closed", mouth: "strained", towerBend: -bend });
    snoozeBubble.style.display = "none";
    gustLines.style.display = "flex";
    kidFaceIcon.textContent = "💨";
    kidMoodText.textContent = "Mood: Whoa! Heavy Wind Bending Me!";
  } else if (mood === "maintenance") {
    setFaceState({ eyes: "open", mouth: "happy", showMaintenance: true, towerBend: 0 });
    snoozeBubble.style.display = "none";
    gustLines.style.display = "none";
    kidFaceIcon.textContent = "🔧";
    kidMoodText.textContent = "Mood: Technicians visiting my tower!";
  } else {
    // AWAKE, SUPER HAPPY & SMILING (Default lively state!)
    setFaceState({ eyes: "open", mouth: "happy", towerBend: 0 });
    snoozeBubble.style.display = "none";
    gustLines.style.display = "none";
    kidFaceIcon.textContent = "😊";
    kidMoodText.textContent = "Mood: Super Happy & Spinning!";
  }
});

// Compile Kid Story Beats
function getKidStories() {
  if (!latestState) return [];

  const now = latestState.now || {};
  const today = latestState.today || {};
  const mood = classifyMood(latestState.statusEvent, now);

  const powerKw = now.activePowerKw || 0;
  const homes = homesPoweredNow(powerKw);
  const rotorRpm = now.rotorRpm || 0;
  const tipSpeed = tipSpeedMs(rotorRpm);
  const tipMph = Math.round(msToMph(tipSpeed));

  const todayKwh = today.energyKwh || Math.max(120, Math.round(powerKw * 3.5));
  const co2Kg = co2AvoidedKg(todayKwh);
  const trees = Math.round(treesEquivalent(co2Kg));

  const stories = [];

  // Mood beat if active
  const mStory = moodStory(mood);
  if (mStory) stories.push(mStory);

  // 1. Super power & consoles
  stories.push(powerStory(powerKw, homes));

  // 2. Cheetah speed
  if (tipMph > 0) stories.push(tipSpeedStory(tipMph));

  // 3. Football pitch sweep
  stories.push(sweepStory());

  // 4. Giant height vs London Eye
  stories.push(heightStory());

  // 5. Clean air & trees
  stories.push(cleanAirStory(co2Kg, trees));

  // 6. How it works
  stories.push(howItWorksStory());

  return stories;
}

function renderKidStory() {
  const stories = getKidStories();
  if (!stories.length) return;

  const beat = stories[currentStoryIndex % stories.length];

  cardEl.style.animation = "popOut 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards";

  setTimeout(() => {
    badgeEmoji.textContent = beat.icon || "⚡";
    badgeText.textContent = beat.badge || "SUPER FACT!";
    headlineEl.textContent = beat.headline || "";
    leadEl.textContent = beat.lead || "";
    statValEl.textContent = beat.stat || "";
    statDescEl.textContent = beat.statUnit || "";

    cardEl.style.animation = "popIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards";
  }, 350);

  currentStoryIndex++;
}

setTimeout(() => {
  renderKidStory();
  setInterval(renderKidStory, ROTATION_INTERVAL_MS);
}, 500);
