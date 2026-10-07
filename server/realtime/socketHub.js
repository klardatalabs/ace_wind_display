// One WebSocket endpoint (/ws) for every display:
//  - every client receives live turbine state snapshots
//  - hoarding screens also subscribe to their screen id and receive animation commands
// Chat never travels over this socket, so nothing a visitor types is ever broadcast.

import { WebSocketServer } from "ws";
import { getState, onStateChange } from "../services/turbineState.js";
import { cacheLiveTelemetry } from "../db/redisClient.js";
import { SCREENS } from "../chat/session.js";
import { getEnvironment, onEnvironmentChange } from "../services/environmentService.js";

let wss = null;
const screenOf = new WeakMap(); // socket -> screen id

function send(socket, message) {
  if (socket.readyState === socket.OPEN) socket.send(typeof message === "string" ? message : JSON.stringify(message));
}

export function attachSocketHub(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: "/ws", maxPayload: 2048 });

  wss.on("connection", (socket) => {
    send(socket, { type: "state", state: getState() });
    send(socket, { type: "environment", environment: getEnvironment() });

    socket.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.type === "screen.subscribe" && SCREENS.includes(msg.screen)) {
        screenOf.set(socket, msg.screen);
        send(socket, { type: "screen.subscribed", screen: msg.screen });
      }
    });
  });

  // Keep idle proxies from dropping kiosk connections.
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) send(client, { type: "ping", t: Date.now() });
  }, 25_000);
  wss.on("close", () => clearInterval(heartbeat));

  onEnvironmentChange((environment) => {
    const payload = JSON.stringify({ type: "environment", environment });
    for (const client of wss.clients) send(client, payload);
  });

  onStateChange((snapshot) => {
    cacheLiveTelemetry(snapshot);
    const payload = JSON.stringify({ type: "state", state: snapshot });
    for (const client of wss.clients) send(client, payload);
  });
}

/** Sends a fixed animation command to every screen showing `screen`. Returns how many received it. */
export function sendScreenCommand(screen, action, value) {
  if (!wss) return 0;
  let delivered = 0;
  for (const client of wss.clients) {
    if (screenOf.get(client) === screen) {
      send(client, { type: "screen.command", action, ...(value === undefined ? {} : { value }), at: Date.now() });
      delivered++;
    }
  }
  return delivered;
}

export function connectedScreens() {
  const counts = Object.fromEntries(SCREENS.map((s) => [s, 0]));
  if (wss) for (const client of wss.clients) {
    const s = screenOf.get(client);
    if (s) counts[s]++;
  }
  return counts;
}
