// Validation helpers for ACE telemetry: timestamps (ISO with offset, or epoch ms/µs) and
// numbers that must be finite and inside a plausible range.

export const TEN_MINUTES_MS = 600_000;

/** Normalises a timestamp to an ISO UTC string; `tenMinute` also requires 10-minute alignment. */
export function normaliseTimestamp(raw, tenMinute = false) {
  if (typeof raw === "string" && !/(Z|[+-]\d{2}:\d{2})$/.test(raw)) throw new Error("Timestamp must include a UTC offset");
  if (typeof raw === "number" && (!Number.isSafeInteger(raw) || raw < 1e12)) throw new Error("Invalid epoch timestamp");
  // ACE sends epoch microseconds (16 digits); milliseconds are accepted too.
  const ms = typeof raw === "number" ? (raw > 1e14 ? raw / 1000 : raw) : Date.parse(raw);
  if (!Number.isFinite(ms) || (tenMinute && ms % TEN_MINUTES_MS)) throw new Error("Invalid or unaligned timestamp");
  return new Date(ms).toISOString();
}

export const validNumber = (value, min = -Infinity, max = Infinity) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export const isGoodQuality = (value) => typeof value === "string" && value.toLowerCase() === "good";
