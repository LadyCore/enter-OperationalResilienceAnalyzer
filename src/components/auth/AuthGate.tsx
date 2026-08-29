import { Loader2 } from "lucide-react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { routers } from "@/router";
import { useOra } from "@/store/OraContext";
import { LoginPage } from "./LoginPage";

const router = createBrowserRouter(routers);

export function AuthGate() {
  const { user, isLoading, db } = useOra();

  if (isLoading || (user && !db)) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Loading your organizations…</span>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return <RouterProvider router={router} />;
}
