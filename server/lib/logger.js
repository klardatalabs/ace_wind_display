// Structured JSON logs, one line per event, so container logs can be searched and shipped.
// Never pass visitor text (chat messages, emails, query strings) into a log call.

import { config } from "../config/index.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

function write(level, component, message, fields) {
  if (LEVELS[level] < threshold) return;
  const entry = { time: new Date().toISOString(), level, component, message, instance: config.instanceId, ...fields };
  if (fields?.err instanceof Error) entry.err = { name: fields.err.name, message: fields.err.message, code: fields.err.code };
  const line = JSON.stringify(entry);
  if (LEVELS[level] >= LEVELS.warn) process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

/** A logger bound to one component name, e.g. logger("collector.live"). */
export function logger(component) {
  return {
    debug: (message, fields) => write("debug", component, message, fields),
    info: (message, fields) => write("info", component, message, fields),
    warn: (message, fields) => write("warn", component, message, fields),
    error: (message, fields) => write("error", component, message, fields),
  };
}
