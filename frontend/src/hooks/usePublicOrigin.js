// The origin phones should open from QR codes. A phone can never reach localhost, so a
// local address is never used: first the server's PUBLIC_ORIGIN (GET /api/config), then
// the page's own origin, then VITE_PUBLIC_ORIGIN, then the live site.

import { useEffect, useState } from "react";

const LIVE_SITE = "https://we-do-wind.89-117-57-40.sslip.io";
const isLocal = (origin) => /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\]|[^/]*\.localhost)(:|\/|$)/i.test(origin);
const fallback = [window.location.origin, import.meta.env.VITE_PUBLIC_ORIGIN, LIVE_SITE].find((o) => o && !isLocal(o)).replace(/\/$/, "");

let cached = null;

export function usePublicOrigin() {
  const [origin, setOrigin] = useState(cached || fallback);
  useEffect(() => {
    if (cached) return;
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        const advertised = cfg?.publicOrigin?.replace(/\/$/, "");
        cached = advertised && !isLocal(advertised) ? advertised : fallback;
        setOrigin(cached);
      })
      .catch(() => {});
  }, []);
  return origin;
}
