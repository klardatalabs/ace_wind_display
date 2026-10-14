// Transactional email through Resend (dataset download links). Visitor-supplied text is
// HTML-escaped; links are always built from PUBLIC_ORIGIN, never from request headers.

import { config } from "../config/index.js";

export const emailEnabled = () => Boolean(config.datasets.resendApiKey);

export const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Sends a dataset download link. Resolves true when Resend accepted the email. */
export async function sendDatasetLink({ to, name, datasetLabel, downloadUrl, validHours }) {
  if (!emailEnabled()) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.datasets.resendApiKey}` },
    body: JSON.stringify({
      from: config.datasets.emailFrom,
      to: [to],
      subject: "Your ACE wind turbine dataset download link",
      html: `
        <h2>Ambition Community Energy: open turbine data</h2>
        <p>Hi ${escapeHtml(name || "there")},</p>
        <p>Here is your link to <b>${escapeHtml(datasetLabel)}</b>:</p>
        <p><a href="${escapeHtml(downloadUrl)}">Download the dataset</a></p>
        <p>The link works for ${validHours} hours. If you didn't ask for it, you can ignore this email.</p>
        <p>Licence: CC-BY-4.0 · DOI <a href="https://doi.org/10.5281/zenodo.22662372">10.5281/zenodo.22662372</a></p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok;
}
