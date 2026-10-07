// The origin phones should open from QR codes. Kiosks often run on localhost, so the
// server can advertise a public URL via PUBLIC_ORIGIN (see GET /api/config).

import { useEffect, useState } from "react";

let cached = null;

export function usePublicOrigin() {
  const [origin, setOrigin] = useState(cached || window.location.origin);
  useEffect(() => {
    if (cached) return;
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg?.publicOrigin) {
          cached = cfg.publicOrigin.replace(/\/$/, "");
          setOrigin(cached);
        }
      })
      .catch(() => {});
  }, []);
  return origin;
}
