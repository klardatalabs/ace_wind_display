// Single WebSocket per tab. Receives live state for everyone; hoarding screens also
// subscribe to their screen id to receive animation commands sent from visitors' phones.

import { useLiveStore } from "../store/useLiveStore.js";
import { useEnvironmentStore } from "../store/useEnvironmentStore.js";

let socket = null;
let retry = 0;
let subscribedScreen = null;
const commandListeners = new Set();
let pollTimer = null;

async function pollLiveState() {
  try {
    const response = await fetch("/api/state");
    if (response.ok) {
      const state = await response.json();
      if (socket?.readyState !== WebSocket.OPEN || !useLiveStore.getState().state) {
        useLiveStore.getState().setState(state);
      }
    }
  } catch {
    // The next poll or WebSocket message can restore live readings.
  }
}

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

function connect() {
  const { setState, setSocketStatus } = useLiveStore.getState();
  setSocketStatus("connecting");
  socket = new WebSocket(wsUrl());

  socket.addEventListener("open", () => {
    retry = 0;
    setSocketStatus("open");
    clearInterval(pollTimer);
    pollTimer = null;
    if (subscribedScreen) socket.send(JSON.stringify({ type: "screen.subscribe", screen: subscribedScreen }));
  });

  socket.addEventListener("message", (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (msg.type === "state") setState(msg.state);
    else if (msg.type === "environment") useEnvironmentStore.getState().setEnvironment(msg.environment);
    else if (msg.type === "screen.command") for (const fn of commandListeners) fn(msg.action, msg.value);
  });

  socket.addEventListener("close", () => {
    setSocketStatus("closed");
    if (!pollTimer) pollTimer = setInterval(pollLiveState, 15_000);
    pollLiveState();
    // Exponential backoff capped at 15 s — kiosks must recover on their own.
    const delay = Math.min(15_000, 500 * 2 ** retry++);
    setTimeout(connect, delay);
  });
}

export function startLiveSocket() {
  if (!socket) connect();
  // Seed state over HTTP so the first paint has numbers even before the socket opens.
  pollLiveState();
  fetch("/api/environment")
    .then((r) => (r.ok ? r.json() : null))
    .then((e) => e && !useEnvironmentStore.getState().environment && useEnvironmentStore.getState().setEnvironment(e))
    .catch(() => {});
}

/** Registers this tab as a hoarding screen. Returns an unsubscribe function for commands. */
export function subscribeScreen(screen, onCommand) {
  subscribedScreen = screen;
  commandListeners.add(onCommand);
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "screen.subscribe", screen }));
  return () => commandListeners.delete(onCommand);
}
