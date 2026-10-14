// Dataset downloads, two ways:
//   - the download button: stream the CSV for a chosen dataset and date range straight away;
//   - "email me a link": a time-limited link sent only by email (never in the response), for
//     researchers who want the request on record. Only a SHA-256 of the random token is stored,
//     and the link is built from PUBLIC_ORIGIN, never from request headers.

import crypto from "node:crypto";
import { config } from "../../config/index.js";
import { createRequest, markEmailed, findActiveRequest, recordDownload, recentRequestCount } from "../../db/repositories/datasets.js";
import { sendDatasetLink, emailEnabled } from "../../integrations/email.js";
import { validateExport } from "./datasetExport.js";
import { HttpError, badRequest } from "../../lib/errors.js";
import { LIMITS } from "../rateLimits.js";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const sha256 = (text) => crypto.createHash("sha256").update(text).digest();
const clip = (v, n) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

export async function emailDownloadLink({ datasetId, from, to, email, name, organisation, purpose }) {
  if (!emailEnabled()) throw new HttpError(503, "Email delivery isn't set up here. Please use the download button instead.", { code: "email_unavailable" });
  const address = String(email ?? "").trim().toLowerCase();
  if (!EMAIL.test(address) || address.length > 254) throw badRequest("Please enter a valid email address.");
  const dataset = validateExport(datasetId, from, to);
  const { limit, windowMs } = LIMITS.datasetEmailPerAddress;
  if ((await recentRequestCount(address, windowMs / 3_600_000)) >= limit) {
    throw new HttpError(429, "Several links have already been sent to this address today. Please check your inbox.", { code: "rate_limited" });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const requestId = await createRequest({
    email: address, datasetId, dateFrom: from, dateTo: to,
    fullName: clip(name, 120), organisation: clip(organisation, 160), purpose: clip(purpose, 1000),
    tokenSha256: sha256(token), expiresAt: new Date(Date.now() + config.datasets.linkTtlHours * 3_600_000),
  });
  const sent = await sendDatasetLink({
    to: address, name: clip(name, 120), datasetLabel: `${dataset.label}, ${from} to ${to}`,
    downloadUrl: `${config.http.publicOrigin}/api/datasets/download?token=${token}`, validHours: config.datasets.linkTtlHours,
  });
  if (!sent) throw new HttpError(502, "We couldn't send the email just now. Please try again, or use the download button.", { code: "email_failed" });
  await markEmailed(requestId);
}

/** The dataset and range a download token unlocks (and logs the download). */
export async function redeemToken(token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw badRequest("This download link is not valid.");
  const request = await findActiveRequest(sha256(token));
  if (!request) throw new HttpError(410, "This download link has expired or is not valid. Please request a new one.", { code: "link_expired" });
  await recordDownload(request.requestId);
  return request;
}
