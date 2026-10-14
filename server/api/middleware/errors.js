// The last middleware: known HttpErrors are answered with their status and public message;
// anything else is logged and answered with a generic 500, so internals never leak.

import { HttpError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

const log = logger("api.errors");

// Express recognises an error handler by its four parameters.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  if (err instanceof HttpError) {
    if (err.headers) res.set(err.headers);
    res.status(err.status).json({ error: err.publicMessage, code: err.code });
    return;
  }
  if (err?.type === "entity.too.large" || err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "The request body is invalid or too large.", code: "bad_request" });
    return;
  }
  log.error("unhandled request error", { err, method: req.method, path: req.path, requestId: req.id });
  res.status(500).json({ error: "Something went wrong on our side. Please try again.", code: "internal" });
}
