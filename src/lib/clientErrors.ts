import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/client";

/**
 * Client-side error instrumentation.
 *
 * Reports React/runtime errors (route-level errorElement, error boundary and
 * global window handlers) to the `client-error-log` backend function with a
 * minimal, sanitized context (route, url, user-agent, message, stack). It is
 * fire-and-forget: a failure to report never affects the app.
 */

interface ClientErrorInfo {
  source: "boundary" | "route" | "window" | "unhandledrejection";
  error: unknown;
}

const MAX_REPORTS_PER_SESSION = 20;
const reportedKeys = new Set<string>();

function normalizeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack };
  }
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

export function reportClientError(info: ClientErrorInfo): void {
  if (typeof window === "undefined") return;
  const { message, stack } = normalizeError(info.error);
  const route = window.location.pathname || "/";
  const key = `${info.source}:${route}:${message.slice(0, 120)}`;
  if (reportedKeys.has(key)) return;
  if (reportedKeys.size >= MAX_REPORTS_PER_SESSION) return;
  reportedKeys.add(key);

  const body = {
    source: info.source,
    route,
    url: window.location.href.slice(0, 500),
    message,
    stack: stack ? stack.slice(0, 8000) : undefined,
    userAgent: navigator.userAgent,
  };

  try {
    void fetch(`${SUPABASE_URL}/functions/v1/client-error-log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      /* fire-and-forget: ignore reporting failures */
    });
  } catch {
    /* fire-and-forget */
  }
}

let started = false;

/** Install global window error / unhandled rejection listeners once. */
export function startClientErrorReporting(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("error", (event) => {
    reportClientError({
      source: "window",
      error: event.error ?? new Error(event.message || "Unknown window error"),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportClientError({ source: "unhandledrejection", error: event.reason });
  });
}
