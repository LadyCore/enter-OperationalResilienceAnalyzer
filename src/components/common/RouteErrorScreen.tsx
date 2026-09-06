import { useEffect } from "react";
import { useRouteError } from "react-router-dom";
import { reportClientError } from "@/lib/clientErrors";
import { ErrorFallbackScreen } from "@/components/common/AppErrorBoundary";

/**
 * errorElement for the router tree: React Router catches route render errors
 * and renders this screen instead of its default developer page, while the
 * error is reported to the client-error-log backend function.
 */
export function RouteErrorScreen() {
  const error = useRouteError();

  useEffect(() => {
    reportClientError({ source: "route", error });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ErrorFallbackScreen />;
}
