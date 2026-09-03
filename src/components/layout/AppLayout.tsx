import { Outlet } from "react-router-dom";
import { FeedbackFab } from "@/components/feedback/FeedbackFab";

/**
 * Root layout: adds the cross-cutting Feedback access (available on pre-login
 * and authenticated routes) while delegating all routing to the existing tree
 * via <Outlet />. It does not change authentication, guards, redirects or the
 * protected-route behavior of the nested AppGuard/AppShell.
 */
export function AppLayout() {
  return (
    <>
      <Outlet />
      <FeedbackFab />
    </>
  );
}
