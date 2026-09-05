import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, X } from "lucide-react";
import { AssistantPanel } from "./AssistantPanel";

/**
 * Floating access point for the ORA contextual assistant (authenticated area).
 * Positioned above the Feedback pill so both coexist without overlap.
 */
export function AssistantFab() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="pointer-events-none fixed bottom-20 right-4 z-40 print:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? t("assistant.close") : t("assistant.open")}
          aria-expanded={open}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
        >
          {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
        </button>
      </div>

      <AssistantPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
