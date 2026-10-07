// Researcher dataset requests and tokenised Parquet downloads.

import { Router } from "express";
import {
  requestDatasetDownload,
  verifyDownloadToken,
  getDatasetFilePath,
  recordDownloadSuccess,
  DATASET_FILES,
} from "../services/datasetService.js";
import { config } from "../config/env.js";

const router = Router();

router.get("/list", (_req, res) => res.json(DATASET_FILES));

router.post("/request", async (req, res) => {
  try {
    const { name, email, organization, purpose, datasetType } = req.body || {};
    const result = await requestDatasetDownload({
      name,
      email,
      organization,
      purpose,
      datasetType,
      host: req.get("host") || `localhost:${config.port}`,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: String(err.message ?? err) });
  }
});

router.get("/download", async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).send("Missing download token.");
    const verification = verifyDownloadToken(token);
    if (!verification.valid) return res.status(403).send(`Unauthorized: ${verification.error}`);
    const { filePath, filename } = getDatasetFilePath(verification.datasetType);
    await recordDownloadSuccess(token);
    res.download(filePath, filename);
  } catch (err) {
    res.status(500).send(`Server error: ${err.message}`);
  }
});

export default router;
