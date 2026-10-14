// Express middleware for a named limit. Sets the standard RateLimit headers on every
// response and Retry-After on a 429.

import { consume } from "../../infra/rateLimit.js";
import { HttpError } from "../../lib/errors.js";

export function applyLimitHeaders(res, decision) {
  res.set("RateLimit-Limit", String(decision.limit));
  res.set("RateLimit-Remaining", String(decision.remaining));
  if (!decision.allowed) res.set("Retry-After", String(Math.ceil(decision.retryAfterMs / 1000)));
}

/** Throws a 429 HttpError unless `key` still has room under `policy`. */
export async function enforce(res, key, policy, message = "Too many requests. Please slow down and try again shortly.") {
  const decision = await consume(key, policy);
  applyLimitHeaders(res, decision);
  if (!decision.allowed) {
    throw new HttpError(429, message, { code: "rate_limited", headers: { "Retry-After": String(Math.ceil(decision.retryAfterMs / 1000)) } });
  }
  return decision;
}

/** Middleware form: `keyOf(req)` names the bucket (e.g. by IP or session). */
export const rateLimit = (name, policy, keyOf = (req) => req.ip, message) => async (req, res, next) => {
  await enforce(res, `${name}:${keyOf(req)}`, policy, message);
  next();
};
