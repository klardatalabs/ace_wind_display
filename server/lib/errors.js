// Errors that are safe to show to a visitor carry an HTTP status and a public message.
// Anything else is logged and answered with a generic message, so internal details
// (SQL, hostnames, stack traces) never leave the server.

export class HttpError extends Error {
  constructor(status, publicMessage, { code, headers } = {}) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
    this.code = code;
    this.headers = headers;
  }
}

export const badRequest = (message) => new HttpError(400, message, { code: "bad_request" });
export const notFound = (message = "Not found") => new HttpError(404, message, { code: "not_found" });
export const unavailable = (message = "This is temporarily unavailable. Please try again shortly.") =>
  new HttpError(503, message, { code: "unavailable" });
