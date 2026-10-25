import { Router } from "express";
import { redis } from "../../infra/redis.js";
import { NEWS_KEY } from "../../live/shapes.js";

export const newsRoutes = Router();

newsRoutes.get("/", async (_req, res) => {
  const raw = await redis.get(NEWS_KEY).catch(() => null);
  let news;
  try { news = raw ? JSON.parse(raw) : null; } catch { news = null; }
  const updatedAt = news?.updatedAt ?? null;
  res.set("Cache-Control", "public, max-age=300").json({
    updatedAt,
    stale: !updatedAt || Date.now() - Date.parse(updatedAt) > 6 * 3600_000,
    items: Array.isArray(news?.items) ? news.items : [],
  });
});
