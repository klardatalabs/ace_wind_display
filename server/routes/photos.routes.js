import { Router } from "express";
import { searchPhotos, trackDownload, isPhotoSearchEnabled } from "../services/photoService.js";
import { checkRateLimit } from "../db/redisClient.js";

const router = Router();

// GET /api/photos?q=wind+turbine&count=5  ->  { photos: [...] }  (the chat page's photo banner)
router.get("/", async (req, res) => {
  if (!isPhotoSearchEnabled()) return res.status(503).json({ error: "Photo search is not configured", photos: [] });
  const rl = await checkRateLimit(`ww:rl:photos:${req.ip}`, 30, 60);
  if (!rl.allowed) return res.status(429).json({ error: "Too many photo requests", photos: [] });
  try {
    const photos = await searchPhotos(String(req.query.q || "wind turbine landscape"), { count: Number(req.query.count) || 5, orientation: req.query.orientation === "portrait" ? "portrait" : "landscape" });
    if (req.query.track === "1") trackDownload(photos);
    res.json({ photos });
  } catch (err) {
    res.status(502).json({ error: err.message, photos: [] });
  }
});

export default router;
