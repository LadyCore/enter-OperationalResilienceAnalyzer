/**
 * Navigation allowlist for the ORA assistant.
 *
 * Mirrors the REAL routes registered in `src/router.tsx` and the module labels
 * shown in `src/components/layout/AppShell.tsx` / `src/lib/feedback/context.ts`.
 * The assistant model may only reference these destinations; the client only
 * renders a navigation chip when a label resolves exactly to one of them.
 */

export interface AssistantDestination {
  path: string;
  en: string;
  es: string;
}

export const ASSISTANT_NAVIGATION: AssistantDestination[] = [
  { path: "/", en: "Dashboard", es: "Panel" },
  { path: "/processes", en: "Processes", es: "Procesos" },
  { path: "/tasks", en: "Tasks", es: "Tareas" },
  { path: "/competencies", en: "Competencies", es: "Competencias" },
  { path: "/people", en: "People", es: "Personas" },
  { path: "/analysis", en: "Analysis", es: "Análisis" },
  { path: "/simulation", en: "Simulation", es: "Simulación" },
  { path: "/import", en: "Import", es: "Importar" },
  { path: "/organization", en: "Organization", es: "Organización" },
  { path: "/access", en: "Access & licensing", es: "Acceso y licencias" },
  { path: "/feedback", en: "Feedback", es: "Comentarios" },
];

export const NAVIGATION_MARKER = "⟶ Go to ";

const normalizeLabel = (label: string) =>
  label.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Resolve an assistant navigation label (in any supported language) to a real
 * route. Returns null when the label matches no allowed destination.
 */
export function resolveAssistantRoute(label: string): string | null {
  const normalized = normalizeLabel(label);
  const hit = ASSISTANT_NAVIGATION.find(
    (d) => normalizeLabel(d.en) === normalized || normalizeLabel(d.es) === normalized,
  );
  return hit?.path ?? null;
}

export interface ParsedNavigation {
  /** Message content with navigation marker lines removed. */
  cleanContent: string;
  /** Resolved navigation targets (label + real path). */
  targets: { label: string; path: string }[];
}

/**
 * Extract `⟶ Go to <label>` lines from an assistant reply. Only lines that
 * resolve to a real allowed route produce a chip; everything else is ignored.
 */
export function parseAssistantNavigation(content: string): ParsedNavigation {
  const lines = content.split("\n");
  const targets: { label: string; path: string }[] = [];
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(NAVIGATION_MARKER)) {
      const label = trimmed.slice(NAVIGATION_MARKER.length).trim();
      const path = resolveAssistantRoute(label);
      if (path) {
        targets.push({ label, path });
        continue; // the chip replaces the raw line
      }
    }
    kept.push(line);
  }
  return { cleanContent: kept.join("\n").replace(/\n{3,}/g, "\n\n").trim(), targets };
}
