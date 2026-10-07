// Admin API access. If the server sets ADMIN_TOKEN, every call needs it; the token is
// asked for once and kept in this tab's sessionStorage.

import { useCallback, useState } from "react";
import { api } from "../../lib/api.js";

const KEY = "ww.admin.token";
const read = () => {
  try {
    return sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
};

export function useAdmin() {
  const [token, setTokenState] = useState(read);
  const [needsToken, setNeedsToken] = useState(false);
  const [error, setError] = useState(null);

  const setToken = useCallback((t) => {
    try {
      sessionStorage.setItem(KEY, t);
    } catch {
      // memory only
    }
    setTokenState(t);
    setNeedsToken(false);
  }, []);

  /** Runs an admin call (fn receives the token). Returns its result, or null on failure. */
  const call = useCallback(
    async (fn) => {
      try {
        const out = await fn(token);
        setError(null);
        return out;
      } catch (err) {
        if (err.status === 401) setNeedsToken(true);
        else setError(err.message);
        return null;
      }
    },
    [token]
  );

  return { token, setToken, needsToken, error, call, admin: api.admin };
}
