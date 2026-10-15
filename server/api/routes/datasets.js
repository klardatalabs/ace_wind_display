// Open data: the dataset list (with the dates each covers) and the instant CSV download.

import { Router } from "express";
import { DATASETS, ARCHIVE_DOI_URL } from "../../../shared/datasets.js";
import { streamExport, datasetCoverage } from "../services/datasetExport.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { LIMITS } from "../rateLimits.js";

export const datasetRoutes = Router();

datasetRoutes.get("/", async (_req, res) => {
  // The dates each dataset covers; if the database is down the list still answers, without them.
  const coverage = await datasetCoverage().catch(() => ({}));
  res.set("Cache-Control", "public, max-age=300").json({
    datasets: DATASETS.map((d) => ({ ...d, coverage: coverage[d.id] ?? null })),
    archiveUrl: ARCHIVE_DOI_URL,
  });
});

// The download: /api/datasets/scada_10m.csv?from=2026-08-01&to=2026-08-31, or with times,
// from=2026-08-01T06:00&to=2026-08-01T18:00 (UK local time).
datasetRoutes.get(
  "/:dataset.csv",
  rateLimit("dataset-download", LIMITS.datasetDownloadPerIp, (req) => req.ip, "You've downloaded a lot in the last hour. Please try again later."),
  async (req, res) => {
    await streamExport(res, req.params.dataset, String(req.query.from ?? ""), String(req.query.to ?? ""));
  }
);
