/**
 * Single source of truth for the DropVault backend.
 *
 * `VITE_BACKEND_URL` points at the origin that serves both the REST API and
 * the collaboration WebSocket server. The API base URL and the WebSocket URL
 * are derived from it so the two can never drift apart.
 *
 * When the variable is not set the app falls back to the origin it is served
 * from, which is what a single-host deployment expects (static assets plus
 * `/api` and `/collab` proxied to the backend).
 */

const DEV_BACKEND_ORIGIN = "http://localhost:1234";

const normalizeOrigin = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
};

const configuredOrigin = normalizeOrigin(import.meta.env.VITE_BACKEND_URL);

const pageOrigin = typeof window !== "undefined" ? window.location.origin : "";

export const backendOrigin =
  configuredOrigin ?? (import.meta.env.DEV ? DEV_BACKEND_ORIGIN : pageOrigin);

if (!configuredOrigin && !import.meta.env.DEV) {
  console.warn(
    "[backend] VITE_BACKEND_URL is not set - falling back to same-origin requests. " +
      "Set it to the backend origin (e.g. https://dropvault-collab.onrender.com) " +
      "when the API is hosted separately from the frontend."
  );
}

/** REST API base URL. Relative when no backend origin is configured. */
export const apiBaseUrl = backendOrigin ? `${backendOrigin}/api` : "/api";

/** Absolute URL for a REST endpoint, e.g. `apiUrl("/activity")`. */
export const apiUrl = (path = "") => {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl}${suffix}`;
};

/** WebSocket base URL for the collaboration server. */
export const wsBaseUrl = `${backendOrigin.replace(/^http/i, "ws")}/collab`;
