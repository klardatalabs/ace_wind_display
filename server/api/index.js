// An api instance: HTTP + WebSockets, stateless (everything shared lives in Postgres and
// Redis), so any number run behind the load balancer. On SIGTERM it reports "not ready",
// stops accepting connections, asks WebSocket clients to reconnect elsewhere, lets in-flight
// requests finish (up to the grace period), then exits.

import { createServer } from "node:http";
import { config } from "../config/index.js";
import { connectRedis, closeRedis } from "../infra/redis.js";
import { closePostgres } from "../infra/postgres.js";
import { onShutdown } from "../lib/shutdown.js";
import { logger } from "../lib/logger.js";
import { createApp } from "./app.js";
import { startLiveFeed, stopLiveFeed } from "./liveFeed.js";
import { attachSocketHub, closeSocketHub } from "./realtime/socketHub.js";

const log = logger("api");

export async function startApi() {
  await connectRedis();
  await startLiveFeed();
  const server = createServer(createApp());
  // Behind a proxy: keep idle keep-alive connections a little longer than nginx does.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  await attachSocketHub(server);
  await new Promise((resolve) => server.listen(config.http.port, resolve));
  log.info("api listening", { port: config.http.port, instance: config.instanceId });

  onShutdown("postgres", closePostgres);
  onShutdown("redis", closeRedis);
  onShutdown("live feed", stopLiveFeed);
  onShutdown("http", () => new Promise((resolve) => server.close(resolve)));
  onShutdown("websockets", closeSocketHub);
  return server;
}
