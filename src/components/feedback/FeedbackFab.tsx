import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquareText } from "lucide-react";
import { useOra } from "@/store/OraContext";
import { FeedbackDialog } from "./FeedbackDialog";
import {
  collectTechnicalContext,
  getFeedbackContext,
  startFeedbackTelemetry,
  trackRoute,
} from "@/lib/feedback/context";
import type { FeedbackContext, FeedbackTechnicalContext } from "@/lib/feedback/types";

/**
 * Persistent, discreet "Feedback" access point available on every screen
 * (pre-login and authenticated). It opens the feedback dialog without
 * navigating, so the user never loses their working state.
 *
 * Positioning: fixed at the bottom-right, below modals (z-40 < dialog z-50) and
 * with `pointer-events-none` on the wrapper so only the button itself receives
 * clicks — it never blocks buttons, navigation or forms underneath it.
 *
 * Context capture: the functional/technical context is captured ONCE when the
 * user opens the dialog (frozen), so the report always reflects the screen the
 * user was on when they pressed Feedback — even if routes change while the
 * dialog stays open.
 */
export function FeedbackFab() {
  const { user, organizations, activeOrganizationId } = useOra();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [captured, setCaptured] = useState<{
    context: FeedbackContext;
    technical: FeedbackTechnicalContext;
  } | null>(null);

  // Single-page-load telemetry capture + route tracking (no personal data).
  useEffect(() => {
    startFeedbackTelemetry();
  }, []);

  useEffect(() => {
    trackRoute(location.pathname);
  }, [location.pathname]);

  const activeOrg = organizations.find((o) => o.id === activeOrganizationId) ?? null;

  const openFeedback = () => {
    const authenticated = Boolean(user);
    // Freeze the context of the REAL screen where Feedback was opened.
    setCaptured({
      context: getFeedbackContext(location.pathname, authenticated),
      technical: collectTechnicalContext({
        authenticated,
        organizationId: activeOrg?.id,
        organizationName: activeOrg?.name,
        screen: location.pathname,
      }),
    });
    setOpen(true);
  };

  return (
    <>
      <div className="pointer-events-none fixed bottom-4 right-4 z-40 print:hidden">
        <button
          type="button"
          onClick={openFeedback}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border bg-sidebar px-3.5 py-2 text-xs font-semibold text-sidebar-foreground shadow-sm transition-colors hover:bg-sidebar-accent"
          aria-label="Open feedback"
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          Feedback
        </button>
      </div>

      <FeedbackDialog
        open={open}
        onOpenChange={setOpen}
        context={captured?.context ?? getFeedbackContext(location.pathname, Boolean(user))}
        technical={
          captured?.technical ??
          collectTechnicalContext({
            authenticated: Boolean(user),
            organizationId: activeOrg?.id,
            organizationName: activeOrg?.name,
            screen: location.pathname,
          })
        }
        initialEmail={user?.email ?? ""}
      />
    </>
  );
}
