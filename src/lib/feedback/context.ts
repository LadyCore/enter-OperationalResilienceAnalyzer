import type { FeedbackContext, FeedbackTechnicalContext } from "./types";

/**
 * Lightweight client-side context capture for the integrated Feedback reports.
 *
 * It is intentionally independent from the site telemetry SDK: it only keeps a
 * small in-memory ring buffer of recent JS errors/rejections and the current /
 * previous routes, used exclusively to enrich a feedback report when the user
 * submits it. Nothing is sent anywhere on its own and no personal data is
 * collected automatically.
 */

/** Route → human-readable module label. Pre-login routes included. */
export const ROUTE_MODULES: Record<string, string> = {
  "/": "Sign in",
  "/verify-email": "Email verification",
  "/forgot-password": "Password recovery",
  "/reset-password": "Password reset",
  "/processes": "Processes",
  "/tasks": "Tasks",
  "/competencies": "Competencies",
  "/people": "People",
  "/analysis": "Analysis",
  "/simulation": "Simulation",
  "/organization": "Organization",
  "/import": "Import",
  "/access": "Access & licensing",
};

/**
 * Distinct human-readable module labels, for admin filters. The index route
 * ("/") resolves to "Sign in" pre-login but to "Dashboard" once authenticated,
 * so both labels are filterable here.
 */
export const FEEDBACK_MODULES: string[] = Array.from(
  new Set([...Object.values(ROUTE_MODULES), "Dashboard"]),
);

/**
 * Resolve the module label for a route. The index route ("/") is the login
 * screen for anonymous visitors and the Dashboard for authenticated users, so
 * it is resolved by the session state instead of a fixed default.
 */
export function moduleForRoute(pathname: string, authenticated = false): string | null {
  if (pathname === "/") return authenticated ? "Dashboard" : "Sign in";
  return ROUTE_MODULES[pathname] ?? null;
}

interface RecentError {
  at: string;
  message: string;
  stack?: string;
}

const MAX_RECENT_ERRORS = 6;

let started = false;
let currentRoute = typeof window !== "undefined" ? window.location.pathname : "/";
let previousRoute: string | null = null;
let stage: string | null = null;
const recentErrors: RecentError[] = [];

function pushError(message: string, stack?: string) {
  recentErrors.push({ at: new Date().toISOString(), message, stack });
  if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.shift();
}

/** Start capturing window errors/rejections once per page load. */
export function startFeedbackTelemetry(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("error", (event) => {
    pushError(event.message || "Unknown error", event.error?.stack);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as unknown;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "object" && reason !== null && "message" in reason
          ? String((reason as { message: unknown }).message)
          : "Unhandled promise rejection";
    pushError(message, reason instanceof Error ? reason.stack : undefined);
  });
}

/** Register the current route (call from the feedback context provider). */
export function trackRoute(pathname: string): void {
  if (pathname === currentRoute) return;
  previousRoute = currentRoute;
  currentRoute = pathname;
}

/** Pages with wizard/tabs call this to report the active step/section. */
export function setFeedbackStage(label: string | null): void {
  stage = label;
}

/**
 * Functional context visible to the user before sending. `authenticated` is
 * required to resolve the index route ("/") correctly: Dashboard for a signed-in
 * session, Sign in otherwise.
 */
export function getFeedbackContext(pathname?: string, authenticated = false): FeedbackContext {
  const route = pathname ?? currentRoute;
  const module = moduleForRoute(route, authenticated);
  return {
    module,
    screen: route,
    stage,
    breadcrumb: stage && module ? `${module} → ${stage}` : module ?? null,
  };
}

/** Technical context attached to the report (never contains personal data). */
export function collectTechnicalContext(opts: {
  authenticated: boolean;
  organizationId?: string | null;
  organizationName?: string | null;
  screen?: string;
}): FeedbackTechnicalContext {
  return {
    capturedAt: new Date().toISOString(),
    authenticated: opts.authenticated,
    organizationId: opts.authenticated ? (opts.organizationId ?? null) : null,
    organizationName: opts.authenticated ? (opts.organizationName ?? null) : null,
    screen: opts.screen ?? currentRoute,
    viewport:
      typeof window !== "undefined" && window.innerWidth
        ? { width: window.innerWidth, height: window.innerHeight }
        : null,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : null,
    recentErrors: [...recentErrors],
  };
}
