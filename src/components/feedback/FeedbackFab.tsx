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

/**
 * Persistent, discreet "Feedback" access point available on every screen
 * (pre-login and authenticated). It opens the feedback dialog without
 * navigating, so the user never loses their working state.
 *
 * Positioning: fixed at the bottom-right, below modals (z-40 < dialog z-50) and
 * with `pointer-events-none` on the wrapper so only the button itself receives
 * clicks — it never blocks buttons, navigation or forms underneath it.
 */
export function FeedbackFab() {
  const { user, organizations, activeOrganizationId } = useOra();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Single-page-load telemetry capture + route tracking (no personal data).
  useEffect(() => {
    startFeedbackTelemetry();
  }, []);

  useEffect(() => {
    trackRoute(location.pathname);
  }, [location.pathname]);

  const activeOrg = organizations.find((o) => o.id === activeOrganizationId) ?? null;

  const context = getFeedbackContext(location.pathname);
  const technical = collectTechnicalContext({
    authenticated: Boolean(user),
    organizationId: activeOrg?.id,
    organizationName: activeOrg?.name,
    screen: location.pathname,
  });

  return (
    <>
      <div className="pointer-events-none fixed bottom-4 right-4 z-40 print:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
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
        context={context}
        technical={technical}
      />
    </>
  );
}
