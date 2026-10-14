// The visitor's address for WebSocket upgrades (Express's req.ip covers HTTP requests).
// The load balancer sets X-Real-IP; it is only believed when the connection itself comes
// from a private address (i.e. from our own proxy), so a visitor can't spoof it.

import net from "node:net";

const PRIVATE = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^127\./, /^::1$/, /^fc|^fd/i, /^::ffff:(10|127|192\.168|172\.(1[6-9]|2\d|3[01]))\./];

export function isPrivateAddress(address = "") {
  return PRIVATE.some((p) => p.test(address));
}

export function clientIp(req) {
  const remote = req.socket.remoteAddress ?? "";
  const forwarded = String(req.headers["x-real-ip"] ?? "").trim();
  return isPrivateAddress(remote) && net.isIP(forwarded) ? forwarded : remote;
}
