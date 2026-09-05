import { lazy } from "react";
import { AppGuard } from "@/components/auth/AppGuard";
import { AppLayout } from "@/components/layout/AppLayout";

// Public auth routes and the 404 are loaded on demand: an anonymous visitor
// landing on "/" should not download the verify/forgot/reset/not-found code.
const VerifyEmailPage = lazy(() =>
  import("@/components/auth/VerifyEmailPage").then((m) => ({ default: m.VerifyEmailPage }))
);
const ForgotPasswordPage = lazy(() =>
  import("@/components/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import("@/components/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage }))
);
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsPage = lazy(() => import("./pages/TermsPage").then((m) => ({ default: m.TermsPage })));

// Route-level code splitting: each page is loaded on demand, keeping the
// initial module graph (and first paint) small.
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const OrganizationPage = lazy(() =>
  import("@/pages/OrganizationPage").then((m) => ({ default: m.OrganizationPage }))
);
const ProcessesPage = lazy(() =>
  import("@/pages/ProcessesPage").then((m) => ({ default: m.ProcessesPage }))
);
const TasksPage = lazy(() => import("@/pages/TasksPage").then((m) => ({ default: m.TasksPage })));
const CompetenciesPage = lazy(() =>
  import("@/pages/CompetenciesPage").then((m) => ({ default: m.CompetenciesPage }))
);
const PeoplePage = lazy(() => import("@/pages/PeoplePage").then((m) => ({ default: m.PeoplePage })));
const AnalysisPage = lazy(() =>
  import("@/pages/AnalysisPage").then((m) => ({ default: m.AnalysisPage }))
);
const SimulationPage = lazy(() =>
  import("@/pages/SimulationPage").then((m) => ({ default: m.SimulationPage }))
);
const ImportOrganizationPage = lazy(() =>
  import("@/pages/ImportOrganizationPage").then((m) => ({ default: m.ImportOrganizationPage }))
);
const AccessAdminPage = lazy(() =>
  import("@/pages/AccessAdminPage").then((m) => ({ default: m.AccessAdminPage }))
);
const FeedbackAdminPage = lazy(() =>
  import("@/pages/FeedbackAdminPage").then((m) => ({ default: m.FeedbackAdminPage }))
);

/**
 * Root router. The top-level pathless route mounts AppLayout (cross-cutting
 * Feedback access via <Outlet/>) and keeps every existing route — public auth
 * routes, the guarded "/" tree and the catch-all — under it, preserving their
 * exact behavior.
 */
export const routers = [
  {
    element: <AppLayout />,
    children: [
      /* Public auth routes (reachable with or without a session) */
      { path: "/verify-email", name: "verify-email", element: <VerifyEmailPage /> },
      { path: "/forgot-password", name: "forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", name: "reset-password", element: <ResetPasswordPage /> },
      { path: "/terms", name: "terms", element: <TermsPage /> },
      {
        path: "/",
        element: <AppGuard />,
        children: [
          { index: true, name: "dashboard", element: <Dashboard /> },
          { path: "organization", name: "organization", element: <OrganizationPage /> },
          { path: "processes", name: "processes", element: <ProcessesPage /> },
          { path: "tasks", name: "tasks", element: <TasksPage /> },
          { path: "competencies", name: "competencies", element: <CompetenciesPage /> },
          { path: "people", name: "people", element: <PeoplePage /> },
          { path: "analysis", name: "analysis", element: <AnalysisPage /> },
          { path: "simulation", name: "simulation", element: <SimulationPage /> },
          { path: "import", name: "import", element: <ImportOrganizationPage /> },
          { path: "access", name: "access", element: <AccessAdminPage /> },
          { path: "feedback", name: "feedback", element: <FeedbackAdminPage /> },
        ],
      },
      /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
      {
        path: "*",
        name: "404",
        element: <NotFound />,
      },
    ],
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
