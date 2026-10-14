// Graceful shutdown. Components register a cleanup step; on SIGTERM/SIGINT the steps run in
// reverse order (last started, first stopped), bounded by a grace period, then the process exits.

import { config } from "../config/index.js";
import { logger } from "./logger.js";

const log = logger("shutdown");
const steps = [];
let stopping = false;

/** Registers `fn` to run on shutdown. `name` appears in the logs. */
export function onShutdown(name, fn) {
  steps.push({ name, fn });
}

export const isShuttingDown = () => stopping;

export async function shutdown(reason, exitCode = 0) {
  if (stopping) return;
  stopping = true;
  log.info("shutting down", { reason });
  const timer = setTimeout(() => {
    log.error("shutdown grace period exceeded, exiting");
    process.exit(1);
  }, config.http.shutdownGraceMs);
  timer.unref();
  for (const { name, fn } of steps.reverse()) {
    try {
      await fn();
    } catch (err) {
      log.warn("shutdown step failed", { step: name, err });
    }
  }
  process.exit(exitCode);
}

export function installSignalHandlers() {
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (err) => log.error("unhandled rejection", { err }));
  process.on("uncaughtException", (err) => {
    log.error("uncaught exception", { err });
    shutdown("uncaughtException", 1);
  });
}
