# Fix blank Live Preview (visual probe timeout)

## Context

The automated final build reported `live-preview-visual-probe-timeout`: at startup the preview's JavaScript resources (`@vite/client` and `/src/main.tsx`) failed to load, so the page rendered zero DOM (`visibleRootChild:false`, `visibleElementCount:0`, `domScore:0`) and the visual probe stayed unhealthy after 3 automatic recovery attempts.

Read-only investigation of the startup path (`index.html` → `src/main.tsx` → `App.tsx`, `src/i18n/config.ts`, `src/analytics.ts`, `src/index.css`):

- All imports in the startup module graph resolve; every startup dependency (`@enter-pro/analytics-sdk`, `@tanstack/react-query`, `react-router-dom`, i18next stack, `@supabase/supabase-js`, `vite-plugin-enter-dev`) is installed.
- `public/locales/*.json` and `i18n.config.json` parse as valid JSON (the eager `import.meta.glob` in `i18n/config.ts` would fail the build otherwise).
- `src/types`, `src/data/seed`, and the UI providers used by `App.tsx` are valid.
- The last commit only added `src/integrations/supabase/client.ts` / `types.ts` / `supabase/config.toml` — none are imported by the app entry, so they are not in the startup path.
- The probe captured **no runtime errors** and `startupError:false`.
- The live preview **currently renders the full working app** (verified by screenshot: sidebar nav, dashboard header, 8 metric cards, coverage cards).

Conclusion: the reported failure was a transient preview/dev-server serving issue (its JS entry scripts were unreachable during the probe window), not a code defect. This plan (1) validates that the project builds and type-checks cleanly, and (2) adds one small startup guard so that a non-essential initialization failure (telemetry bootstrap) can never blank the whole tree again — the exact "root exists, nothing renders" failure mode.

## Files

- `src/main.tsx` — add the telemetry guard (only file changed).

## Implementation checklist

- [ ] Run `pnpm run build` and `pnpm run check` (lint + `tsc --noEmit`) against the current working tree; both pass with no errors before editing.
- [ ] In `src/main.tsx`, wrap `bootstrapGeneratedSiteAnalytics()` in `try/catch` so a telemetry init error is swallowed (with a `console.error`) and never prevents `createRoot(container).render(<App />)` from mounting the tree.
- [ ] Re-run `pnpm run build` and `pnpm run check` after the edit; both still pass with no errors (lint, type, and build clean).

## Verification checklist

- [ ] Positive: `pnpm run build` exits 0 and emits a `dist/` bundle; `pnpm run check` exits 0.
- [ ] Positive: live preview at `http://localhost:3000` renders the dashboard (sidebar + metric cards + coverage cards) — already observed; re-confirm after the edit.
- [ ] Default/negative: initial load shows no console errors; even if telemetry init throws, the app still mounts (guard logs only the analytics error).
- [ ] Boundary: the entry (`index.html` → `src/main.tsx`) still loads when served from the built `dist/`.
