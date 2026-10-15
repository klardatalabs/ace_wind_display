// The grid around the turbine right now: GET /api/grid -> the South West's generation mix
// and carbon intensity for this half hour (integrations/carbonIntensity.js).

import { Router } from "express";
import { fetchRegionalGrid } from "../../integrations/carbonIntensity.js";
import { unavailable } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

const log = logger("api.grid");

export const gridRoutes = Router();

gridRoutes.get("/", async (req, res) => {
  let grid;
  try {
    grid = await fetchRegionalGrid();
  } catch (err) {
    log.warn("grid lookup failed", { error: err.message });
    throw unavailable("The grid figures aren't available right now.");
  }
  res.set("Cache-Control", "public, max-age=300").json(grid);
});
