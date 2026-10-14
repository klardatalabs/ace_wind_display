// Reads .env (when present) into process.env and offers typed readers. Values already set
// in the environment win over the file, so Docker and CI settings are never overridden.

import fs from "node:fs";
import path from "node:path";

export function loadDotEnv(file = path.resolve(process.cwd(), ".env")) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const read = (name) => {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
};

export const env = {
  string: (name, fallback = "") => read(name) ?? fallback,
  int(name, fallback) {
    const value = read(name);
    if (value === undefined) return fallback;
    const n = Number(value);
    if (!Number.isInteger(n)) throw new Error(`${name} must be an integer`);
    return n;
  },
  number(name, fallback) {
    const value = read(name);
    if (value === undefined) return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
    return n;
  },
  bool(name, fallback = false) {
    const value = read(name);
    if (value === undefined) return fallback;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  },
};
