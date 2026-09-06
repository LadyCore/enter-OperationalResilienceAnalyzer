import { ROUTE_MODULES } from "@/lib/feedback/context";
import type { FeedbackContext } from "@/lib/feedback/types";

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

/** Route → i18n key for the module label (mirrors ROUTE_MODULES). */
const ROUTE_MODULE_KEYS: Record<string, string> = {
  "/": "feedbackModule.signIn", // index route resolves to Dashboard when authenticated
  "/verify-email": "feedbackModule.verifyEmail",
  "/forgot-password": "feedbackModule.forgotPassword",
  "/reset-password": "feedbackModule.resetPassword",
  "/processes": "feedbackModule.processes",
  "/tasks": "feedbackModule.tasks",
  "/competencies": "feedbackModule.competencies",
  "/people": "feedbackModule.people",
  "/analysis": "feedbackModule.analysis",
  "/simulation": "feedbackModule.simulation",
  "/organization": "feedbackModule.organization",
  "/import": "feedbackModule.import",
  "/access": "feedbackModule.access",
};

/** Stored English module label → i18n key (labels persist in the DB as-is). */
export const MODULE_LABEL_KEYS: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(ROUTE_MODULE_KEYS).map(([route, key]) => [ROUTE_MODULES[route], key]),
  ),
  Dashboard: "feedbackModule.dashboard",
};

export function localizeModuleLabel(module: string | null | undefined, t: TFunc): string {
  if (!module) return "";
  const key = MODULE_LABEL_KEYS[module];
  return key ? t(key) : module;
}

/** i18n keys of the import wizard step names (already used by the import UI). */
const IMPORT_STEP_KEYS = [
  "importPage.step.organization",
  "importPage.step.mapping",
  "importPage.step.validation",
  "importPage.step.confirmation",
] as const;

/** Localize a stored feedback stage (People tabs / import wizard steps). */
export function localizeFeedbackStage(stage: string | null | undefined, t: TFunc): string {
  if (!stage) return "";

  // Import wizard: "Step N · <label>".
  const importMatch = stage.match(/^Step (\d+) · (.+)$/);
  if (importMatch) {
    const step = Number(importMatch[1]);
    const stepKey = IMPORT_STEP_KEYS[step - 1];
    if (stepKey) return t("feedbackStage.importStep", { step, label: t(stepKey) });
    return stage;
  }

  const key =
    stage === "People"
      ? "feedbackStage.people"
      : stage === "Roles"
        ? "feedbackStage.roles"
        : stage === "Coverage & on-call"
          ? "feedbackStage.coverage"
          : null;
  return key ? t(key) : stage;
}

/** Rebuild the "module → stage" line that feedback stores, fully localized. */
export function localizeFeedbackContext(context: FeedbackContext, t: TFunc): string {
  const module = localizeModuleLabel(context.module, t);
  const stage = localizeFeedbackStage(context.stage, t);
  if (stage && module) return `${module} → ${stage}`;
  if (module) return module;
  if (stage) return stage;
  return context.screen;
}
