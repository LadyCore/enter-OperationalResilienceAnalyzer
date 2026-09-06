import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/clientErrors";
import i18n from "@/i18n/config";

/**
 * Fallback screen shown after an unexpected application error. Language-aware
 * via the i18n singleton (no hooks available inside a class boundary).
 */
export function ErrorFallbackScreen() {
  const t = i18n.t.bind(i18n);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-lg font-semibold">{t("errorScreen.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("errorScreen.message")}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" /> {t("errorScreen.retry")}
          </Button>
          <Button asChild variant="outline">
            <a href="/">
              <Home className="h-4 w-4" /> {t("errorScreen.backHome")}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

/** Top-level boundary: catches errors not handled by the router errorElement. */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    reportClientError({ source: "boundary", error });
  }

  render() {
    if (this.state.hasError) return <ErrorFallbackScreen />;
    return this.props.children;
  }
}
