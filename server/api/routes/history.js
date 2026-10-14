// History for charts and screens, from the shared cache. Browsers and the load balancer may
// reuse a response for a minute, and serve a stale one for ten while it refreshes.

import { Router } from "express";
import * as history from "../services/history.js";
import { badRequest } from "../../lib/errors.js";

export const historyRoutes = Router();

const cacheable = (res) => res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=600, stale-if-error=86400");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clampInt = (value, min, max, fallback) => Math.max(min, Math.min(max, Math.floor(Number(value)) || fallback));

historyRoutes.get("/", async (req, res) => {
  cacheable(res).json(await history.series(clampInt(req.query.hours, 1, 24 * 30, 24)));
});

historyRoutes.get("/daily", async (req, res) => {
  cacheable(res).json(await history.recentDays(clampInt(req.query.limit, 1, 366, 30)));
});

historyRoutes.get("/records", async (_req, res) => {
  cacheable(res).json(await history.records());
});

historyRoutes.get("/power-curve", async (_req, res) => {
  cacheable(res).json(await history.powerCurve());
});

// ?mode=custom&start1=YYYY-MM-DD&end1=...&start2=...&end2=... (end dates exclusive), or this month vs last.
historyRoutes.get("/compare", async (req, res) => {
  if (req.query.mode !== "custom") return cacheable(res).json(await history.monthComparison());
  const { start1, end1, start2, end2 } = req.query;
  if (![start1, end1, start2, end2].every((d) => DATE.test(d ?? ""))) throw badRequest("Dates must be YYYY-MM-DD.");
  if (end1 <= start1 || end2 <= start2) throw badRequest("Each period must end after it starts.");
  cacheable(res).json(await history.periodComparison({ from: start1, to: end1 }, { from: start2, to: end2 }));
});
