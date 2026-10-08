import { Router } from "express";
import { getEnvironment, getWeather } from "../services/environmentService.js";

const router = Router();

// Everything a screen needs to draw the place: weather, any admin override, site location.
router.get("/", (_req, res) => res.json(getEnvironment()));

// Just the weather reading (null until the first successful fetch).
router.get("/weather", (_req, res) => {
  const weather = getWeather();
  if (!weather) return res.status(503).json({ error: "Weather not available yet" });
  res.json(weather);
});

export default router;
