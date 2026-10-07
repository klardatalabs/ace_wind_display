import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { pool } from "./timescaleDb.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECRET_KEY = process.env.DATASET_SECRET_KEY || "ace-wind-dataset-secret-token-key-2026";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

const DATASET_FILES = {
  "10m_scada": {
    filename: "ace-wind-2026-10m-latest.parquet",
    label: "10-Minute SCADA Telemetry (11,219 Intervals)",
    format: "Apache Parquet",
    approxSize: "8.7 MB",
  },
  "daily": {
    filename: "ace-wind-2026-daily-latest.parquet",
    label: "Daily Operational Aggregates & Yield",
    format: "Apache Parquet",
    approxSize: "337 KB",
  },
  "events": {
    filename: "ace-wind-2026-events-latest.parquet",
    label: "Chronological Status & Grid Events",
    format: "Apache Parquet",
    approxSize: "325 KB",
  },
};

// Ensure dataset_downloads table exists in database
async function initDatasetTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dataset_downloads (
        id BIGSERIAL PRIMARY KEY,
        requested_at TIMESTAMPTZ DEFAULT NOW(),
        name TEXT,
        email TEXT NOT NULL,
        organization TEXT,
        purpose TEXT,
        dataset_type TEXT DEFAULT '10m_scada',
        token TEXT NOT NULL,
        download_count INTEGER DEFAULT 0,
        last_downloaded_at TIMESTAMPTZ
      );
    `);
  } catch (err) {
    console.warn("[Dataset] Warning ensuring dataset_downloads table:", err.message);
  }
}
initDatasetTable();

/**
 * Generate a cryptographically signed download token valid for 24 hours.
 */
export function generateDownloadToken(email, datasetType) {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload = `${email}|${datasetType}|${expiresAt}`;
  const hmac = crypto.createHmac("sha256", SECRET_KEY).update(payload).digest("hex");
  const token = Buffer.from(`${payload}|${hmac}`).toString("base64url");
  return { token, expiresAt };
}

/**
 * Verify a download token.
 */
export function verifyDownloadToken(token) {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [email, datasetType, expiresAtStr, receivedSig] = raw.split("|");
    const expiresAt = Number(expiresAtStr);

    if (Date.now() > expiresAt) {
      return { valid: false, error: "Download link has expired (24-hour limit)." };
    }

    const payload = `${email}|${datasetType}|${expiresAt}`;
    const expectedSig = crypto.createHmac("sha256", SECRET_KEY).update(payload).digest("hex");

    if (crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSig))) {
      return { valid: true, email, datasetType, expiresAt };
    }
    return { valid: false, error: "Invalid cryptographic signature." };
  } catch (e) {
    return { valid: false, error: "Malformed download token." };
  }
}

/**
 * Retrieve absolute file path for dataset.
 */
export function getDatasetFilePath(datasetType) {
  const meta = DATASET_FILES[datasetType] || DATASET_FILES["10m_scada"];
  const filePath = path.join(__dirname, "..", "data", "zenodo", meta.filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dataset file ${meta.filename} not found on server disk.`);
  }
  return { filePath, filename: meta.filename, meta };
}

/**
 * Handle dataset download request: records request, generates token, and optionally sends email.
 */
export async function requestDatasetDownload({ name, email, organization, purpose, datasetType = "10m_scada", host = "localhost:4100" }) {
  if (!email || !email.includes("@")) {
    throw new Error("A valid email address is required.");
  }

  const cleanType = DATASET_FILES[datasetType] ? datasetType : "10m_scada";
  const { token, expiresAt } = generateDownloadToken(email, cleanType);
  const downloadUrl = `http://${host}/api/datasets/download?token=${token}`;

  // Record request in database
  try {
    await pool.query(
      `INSERT INTO dataset_downloads (name, email, organization, purpose, dataset_type, token)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [name || "Anonymous", email, organization || "Independent", purpose || "Research", cleanType, token]
    );
  } catch (err) {
    console.warn("[Dataset] Error saving audit log to db:", err.message);
  }

  // Attempt to send email if Resend API key is present
  let emailSent = false;
  if (RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "ACE Wind Turbine <datasets@acewind.org>",
          to: [email],
          subject: "Your ACE Wind Turbine Dataset Download Link",
          html: `
            <h2>Ambition Community Energy — Open SCADA Dataset</h2>
            <p>Hi ${name || "there"},</p>
            <p>Thank you for requesting access to the verified SCADA dataset for England's largest community wind turbine (Avonmouth, Bristol).</p>
            <p><b>Requested Dataset:</b> ${DATASET_FILES[cleanType].label} (${DATASET_FILES[cleanType].format})</p>
            <p><a href="${downloadUrl}" style="background:#0284c7;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;">Download Dataset Now</a></p>
            <p><i>Note: This secure link is valid for 24 hours.</i></p>
            <p>DOI: <a href="https://doi.org/10.5281/zenodo.22662372">10.5281/zenodo.22662372</a> · Licence: CC-BY-4.0</p>
          `,
        }),
      });
      emailSent = res.ok;
    } catch (e) {
      console.warn("[Dataset] Resend email send failed:", e.message);
    }
  }

  return {
    success: true,
    emailSent,
    downloadUrl,
    dataset: DATASET_FILES[cleanType],
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

/**
 * Record successful file download in audit table.
 */
export async function recordDownloadSuccess(token) {
  try {
    await pool.query(
      `UPDATE dataset_downloads 
       SET download_count = download_count + 1, last_downloaded_at = NOW() 
       WHERE token = $1;`,
      [token]
    );
  } catch (e) {
    // ignore
  }
}

export { DATASET_FILES };
