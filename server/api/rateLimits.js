// Every application rate limit in one place. These are the second layer: nginx (the load
// balancer) applies coarse per-IP request-rate limits first, so floods never reach Node.
// Per-IP limits allow for a whole classroom sharing one school address.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const LIMITS = {
  api: { limit: 600, windowMs: MINUTE }, // any /api request, per IP
  chatSessionCreate: { limit: 60, windowMs: MINUTE }, // per IP
  chatMessagePerSession: { limit: 8, windowMs: MINUTE },
  chatMessagePerIp: { limit: 60, windowMs: MINUTE },
  photos: { limit: 30, windowMs: MINUTE }, // per IP
  screenCommandPerSession: { limit: 20, windowMs: MINUTE },
  screenWalkPerSession: { limit: 600, windowMs: MINUTE }, // the walk slider sends ~10 updates a second
  screenShowCooldown: { limit: 1, windowMs: 12_000 }, // per screen: one animation at a time
  datasetDownloadPerIp: { limit: 20, windowMs: HOUR },
};
