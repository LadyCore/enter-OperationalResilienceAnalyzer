import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { routers } from "@/router";

const router = createBrowserRouter(routers);

export function AuthGate() {
  return <RouterProvider router={router} />;
}
