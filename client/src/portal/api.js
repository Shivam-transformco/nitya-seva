import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../lib/apiBase";

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const sessionEndedListeners = new Set();

/** Called whenever the server says the session is gone, so the portal can show the login screen. */
export function onSessionEnded(fn) {
  sessionEndedListeners.add(fn);
  return () => sessionEndedListeners.delete(fn);
}

export async function api(path, { method = "GET", body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      signal,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0, "NETWORK");
  }

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) {
    if (res.status === 401 && path !== "/auth/login") sessionEndedListeners.forEach((fn) => fn());
    throw new ApiError(payload?.error || `Request failed (${res.status}).`, res.status, payload?.code, payload?.details);
  }
  return payload.data;
}

export function qs(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return entries.length ? `?${new URLSearchParams(entries)}` : "";
}

export const pledgesCsvUrl = `${API_BASE}/api/reports/pledges.csv`;

/** GETs `path` (skipped when null) and re-fetches when it changes or `reload()` is called. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return undefined;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path, { signal: ctrl.signal }).then(
      (data) => setState({ data, error: null, loading: false }),
      (error) => {
        if (error.name !== "AbortError") setState((s) => ({ ...s, error, loading: false }));
      },
    );
    return () => ctrl.abort();
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

const NOTIFICATIONS_CHANGED = "ns:notifications-changed";
export const notificationsChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
export function onNotificationsChanged(fn) {
  window.addEventListener(NOTIFICATIONS_CHANGED, fn);
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED, fn);
}
