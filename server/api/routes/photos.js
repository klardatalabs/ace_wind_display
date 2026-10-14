// Photos for the chat page's banner: GET /api/photos?q=wind+turbine&count=5

import { Router } from "express";
import { searchPhotos, photosEnabled } from "../../integrations/unsplash.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { LIMITS } from "../rateLimits.js";
import { unavailable } from "../../lib/errors.js";

export const photoRoutes = Router();

photoRoutes.get("/", rateLimit("photos", LIMITS.photos), async (req, res) => {
  if (!photosEnabled()) throw unavailable("Photo search is not set up.");
  const photos = await searchPhotos(String(req.query.q || "wind turbine landscape"), {
    count: Number(req.query.count) || 5,
    orientation: req.query.orientation === "portrait" ? "portrait" : "landscape",
  });
  res.set("Cache-Control", "public, max-age=3600").json({ photos: photos.map(({ downloadLocation, ...safe }) => safe) });
});
