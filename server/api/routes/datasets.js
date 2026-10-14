// Open data: the dataset list, the instant download button, "email me a link", and the
// emailed link itself.

import { Router } from "express";
import { DATASETS, ARCHIVE_DOI_URL } from "../../../shared/datasets.js";
import { streamExport } from "../services/datasetExport.js";
import { emailDownloadLink, redeemToken } from "../services/datasets.js";
import { emailEnabled } from "../../integrations/email.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { LIMITS } from "../rateLimits.js";

export const datasetRoutes = Router();

datasetRoutes.get("/", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300").json({ datasets: DATASETS, archiveUrl: ARCHIVE_DOI_URL, emailLinks: emailEnabled() });
});

// The download button: /api/datasets/scada_10m.csv?from=2026-08-01&to=2026-08-31
datasetRoutes.get(
  "/:dataset.csv",
  rateLimit("dataset-download", LIMITS.datasetDownloadPerIp, (req) => req.ip, "You've downloaded a lot in the last hour. Please try again later."),
  async (req, res) => {
    await streamExport(res, req.params.dataset, String(req.query.from ?? ""), String(req.query.to ?? ""));
  }
);

datasetRoutes.post(
  "/request",
  rateLimit("dataset-email", LIMITS.datasetEmailPerIp, (req) => req.ip, "Too many requests from here. Please try again later."),
  async (req, res) => {
    const b = req.body ?? {};
    await emailDownloadLink({ datasetId: b.datasetId, from: b.from, to: b.to, email: b.email, name: b.name, organisation: b.organisation, purpose: b.purpose });
    res.json({ emailSent: true });
  }
);

datasetRoutes.get("/download", async (req, res) => {
  const request = await redeemToken(req.query.token);
  await streamExport(res, request.datasetId, request.dateFrom, request.dateTo);
});
