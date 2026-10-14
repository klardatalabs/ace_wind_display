// WebSockets at /ws for every screen and phone:
//   - every client gets the live state and weather on connect, then each change;
//   - hoarding screens subscribe to their screen id and receive animation commands, which
//     arrive through Redis so a phone and its hoarding can sit on different api instances;
//   - dead connections are found with protocol pings and closed;
//   - each instance reports how many screens it holds, so health checks see them all.
// Chat never travels over this socket, so nothing a visitor types is ever broadcast.

import { WebSocketServer } from "ws";
import { config } from "../../config/index.js";
import { liveFeed, currentState, currentEnvironment } from "../liveFeed.js";
import { subscribe, publish, CHANNELS } from "../../infra/pubsub.js";
import { redis } from "../../infra/redis.js";
import { clientIp } from "../clientIp.js";
import { logger } from "../../lib/logger.js";
import { SCREEN_IDS } from "../../../shared/screens.js";

const log = logger("api.sockets");
const PING_MS = 25_000;
const MAX_PER_IP = 30;
const PRESENCE_MS = 10_000;

const screenOf = new WeakMap(); // socket -> screen id
const alive = new WeakMap(); // socket -> answered the last ping
const perIp = new Map(); // ip -> open sockets
let wss = null;
let timers = [];

const encode = (type, payload) => JSON.stringify({ type, ...payload });

function broadcast(message) {
  for (const client of wss.clients) if (client.readyState === client.OPEN) client.send(message);
}

/** Counts of screens connected to this instance. */
function localScreenCounts() {
  const counts = Object.fromEntries(SCREEN_IDS.map((s) => [s, 0]));
  for (const client of wss?.clients ?? []) {
    const screen = screenOf.get(client);
    if (screen) counts[screen]++;
  }
  return counts;
}

async function reportPresence() {
  await redis.set(`presence:${config.instanceId}`, JSON.stringify(localScreenCounts()), "PX", PRESENCE_MS * 3).catch(() => {});
}

/** Screens connected across every api instance (falls back to this instance's own). */
export async function connectedScreens() {
  try {
    const keys = [];
    let cursor = "0";
    do {
      const [next, batch] = await redis.scan(cursor, "MATCH", `${config.redis.keyPrefix}presence:*`, "COUNT", 100);
      cursor = next;
      keys.push(...batch.map((k) => k.slice(config.redis.keyPrefix.length)));
    } while (cursor !== "0");
    const totals = Object.fromEntries(SCREEN_IDS.map((s) => [s, 0]));
    for (const raw of keys.length ? await redis.mget(keys) : []) {
      for (const [screen, n] of Object.entries(JSON.parse(raw ?? "{}"))) if (screen in totals) totals[screen] += n;
    }
    return totals;
  } catch {
    return localScreenCounts();
  }
}

/** Sends a fixed animation command to every connected `screen`, on any instance. */
export async function sendScreenCommand(screen, action, value) {
  const message = { screen, action, ...(value === undefined ? {} : { value }), at: Date.now() };
  if (!(await publish(CHANNELS.screenCommand, message))) deliverLocally(message); // Redis down: reach our own sockets at least
}

function deliverLocally({ screen, ...command }) {
  const payload = encode("screen.command", command);
  for (const client of wss.clients) if (screenOf.get(client) === screen && client.readyState === client.OPEN) client.send(payload);
}

export async function attachSocketHub(httpServer) {
  wss = new WebSocketServer({ noServer: true, maxPayload: 2048, clientTracking: true });

  httpServer.on("upgrade", (req, socket, head) => {
    if (new URL(req.url, "http://x").pathname !== "/ws") return socket.destroy();
    const ip = clientIp(req);
    if ((perIp.get(ip) ?? 0) >= MAX_PER_IP) {
      socket.write("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n");
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, ip));
  });

  wss.on("connection", (ws, ip) => {
    perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
    alive.set(ws, true);
    ws.on("pong", () => alive.set(ws, true));
    ws.on("close", () => {
      const n = (perIp.get(ip) ?? 1) - 1;
      if (n > 0) perIp.set(ip, n);
      else perIp.delete(ip);
    });
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg?.type === "screen.subscribe" && SCREEN_IDS.includes(msg.screen)) {
        screenOf.set(ws, msg.screen);
        ws.send(encode("screen.subscribed", { screen: msg.screen }));
      }
    });
    const state = currentState();
    const environment = currentEnvironment();
    if (state) ws.send(encode("state", { state }));
    if (environment) ws.send(encode("environment", { environment }));
  });

  liveFeed.on("state", (state) => broadcast(encode("state", { state })));
  liveFeed.on("environment", (environment) => broadcast(encode("environment", { environment })));
  await subscribe(CHANNELS.screenCommand, deliverLocally);

  timers = [
    setInterval(() => {
      for (const ws of wss.clients) {
        if (!alive.get(ws)) {
          ws.terminate();
          continue;
        }
        alive.set(ws, false);
        ws.ping();
      }
    }, PING_MS),
    setInterval(reportPresence, PRESENCE_MS),
  ];
  log.info("websocket hub ready");
}

/** Tells clients to reconnect elsewhere (1001 "going away") and stops the timers. */
export async function closeSocketHub() {
  for (const t of timers) clearInterval(t);
  for (const ws of wss?.clients ?? []) ws.close(1001, "server restarting");
  await redis.del(`presence:${config.instanceId}`).catch(() => {});
  await new Promise((resolve) => (wss ? wss.close(resolve) : resolve()));
}
