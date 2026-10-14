// Fresh story words for the hoarding screens, written by the collector (jobs/stories.js).
// Empty when there are none yet: the screens then use their own hand-written words.

import { Router } from "express";
import { redis } from "../../infra/redis.js";
import { STORIES_KEY } from "../../live/shapes.js";

export const storyRoutes = Router();

storyRoutes.get("/", async (_req, res) => {
  const raw = await redis.get(STORIES_KEY).catch(() => null);
  res.set("Cache-Control", "public, max-age=300").json(raw ? JSON.parse(raw) : { screens: {} });
});
