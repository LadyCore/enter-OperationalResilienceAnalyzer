import { AppShell } from "@/components/layout/AppShell";
import { AnalysisPage } from "@/pages/AnalysisPage";
import { CompetenciesPage } from "@/pages/CompetenciesPage";
import { Dashboard } from "@/pages/Dashboard";
import { OrganizationPage } from "@/pages/OrganizationPage";
import { PeoplePage } from "@/pages/PeoplePage";
import { ProcessesPage } from "@/pages/ProcessesPage";
import { SimulationPage } from "@/pages/SimulationPage";
import { TasksPage } from "@/pages/TasksPage";
import NotFound from "./pages/NotFound";

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
