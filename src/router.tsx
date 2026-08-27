import { lazy } from "react";
import { AppShell } from "@/components/layout/AppShell";
import NotFound from "./pages/NotFound";

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

export const routers = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, name: "dashboard", element: <Dashboard /> },
      { path: "organization", name: "organization", element: <OrganizationPage /> },
      { path: "processes", name: "processes", element: <ProcessesPage /> },
      { path: "tasks", name: "tasks", element: <TasksPage /> },
      { path: "competencies", name: "competencies", element: <CompetenciesPage /> },
      { path: "people", name: "people", element: <PeoplePage /> },
      { path: "analysis", name: "analysis", element: <AnalysisPage /> },
      { path: "simulation", name: "simulation", element: <SimulationPage /> },
    ],
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
