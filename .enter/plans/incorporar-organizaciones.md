# ORA — Feedback integrado (transversal, contextual, persistente)

## Context

ORA necesita que sus usuarios puedan reportar problemas de funcionamiento, errores, lentitud, bloqueos y sugerencias de mejora desde cualquier pantalla de la app autenticada, con contexto detectado automáticamente y persistencia para análisis posterior. Es independiente del chatbot y de la telemetría existente. Alcance acordado: **solo dentro de la app autenticada** (AppShell) y **contexto automático + instrumentación de pasos en páginas clave** (importación y People). No se agrega panel de administración en esta etapa.

## Arquitectura

### Persistencia (Enter Cloud, migración única)
Tabla `public.feedback_reports`:
- `id uuid pk default gen_random_uuid()`
- `user_id uuid references auth.users(id) on delete set null`
- `created_at timestamptz default now()`
- `kind text check in ('not_working','error','slow','stuck','suggestion','other')`
- `description text not null`
- `module text` (p. ej. "People", "Simulation", "Import")
- `screen text` (pathname)
- `stage text null` (paso/sección instrumentada, p. ej. "Step 2 · Column mapping")
- `is_general boolean default false`
- `status text default 'new'` (futura gestión interna)
- `context jsonb default '{}'` (técnico: ruta previa, userAgent, viewport, errores JS recientes, organización activa)

RLS en la misma migración: insert `with check (user_id = auth.uid())`; select del propio usuario (`user_id = auth.uid()`) y del owner (`public.is_owner()`); sin update/delete de usuario. **Verificar con `supabase_get_table_schema`** tras migrar (RLS on + policies).

### Frontend (solo app autenticada)
- `src/lib/feedback/types.ts` — `FeedbackKind`, `FeedbackInput`, tipos de contexto técnico.
- `src/lib/feedback/context.ts` — singleton de contexto:
  - `startFeedbackTelemetry()`: suscribe `window` a `error` y `unhandledrejection` y mantiene ring buffer (máx ~6) de errores JS con marca de tiempo.
  - `trackRoute(pathname, module)`: registra ruta previa/actual.
  - `setFeedbackStage(label | null)`: usado por páginas instrumentadas.
  - `collectContext()`: arma JSON técnico (ruta, ruta previa, userAgent, viewport, org activa id/nombre, errores recientes, timestamp).
- `src/lib/feedback/api.ts` — `submitFeedback(input)` inserta la fila tipada (reusa `supabase`).
- `src/components/feedback/FeedbackDialog.tsx` — formulario: tipo (6 opciones con íconos), textarea obligatoria, panel "Contexto detectado" (módulo/ruta/etapa), checkbox "Feedback general" (envía `is_general=true`, sin contexto funcional forzado), botón Enviar; estado de éxito con confirmación y reset.
- `src/components/feedback/FeedbackFab.tsx` — botón flotante discreto "Feedback" fijo (bottom-right) dentro de la app autenticada; abre el diálogo sin navegar (no pierde el estado de trabajo).

### Puntos de montaje / instrumentación (modificados)
- `src/components/layout/AppShell.tsx` — montar `<FeedbackFab />` y arrancar telemetría (`useEffect startFeedbackTelemetry`); derivar módulo de la ruta vía `useLocation` + mapa de rutas (reutilizando las etiquetas de `nav`/router).
- `src/pages/ImportOrganizationPage.tsx` — `useEffect([step])` → `setFeedbackStage(`Step ${step} · ${STEPS[step-1]}`)` (no altera la lógica del wizard).
- `src/pages/PeoplePage.tsx` — registrar la pestaña/sección activa si expone tabs (solo lectura del estado existente).

### No se toca
Chatbot (no existe componente propio en esta base; no se crea), análisis, simulación, DEMO/licencias/RLS de acceso, lógica de importación, autenticación, identidad visual general. No se agrega UI administrativa.

## Implementation checklist
- [ ] Migración: tabla `feedback_reports` + RLS (insert propio, select propio/owner) aplicada y verificada con `supabase_get_table_schema`.
- [ ] `src/lib/feedback/types.ts` y `src/lib/feedback/context.ts` (telemetría de errores + rutas + stage + collector).
- [ ] `src/lib/feedback/api.ts` (`submitFeedback`).
- [ ] `src/components/feedback/FeedbackDialog.tsx` (tipos, descripción obligatoria, contexto visible, "Feedback general", confirmación).
- [ ] `src/components/feedback/FeedbackFab.tsx` (acceso persistente no invasivo).
- [ ] `src/components/layout/AppShell.tsx`: montar FAB + `startFeedbackTelemetry()` + mapeo ruta→módulo.
- [ ] `ImportOrganizationPage`: reportar paso actual vía `setFeedbackStage`.
- [ ] `PeoplePage`: reportar pestaña activa vía `setFeedbackStage` (si la página expone tab/estado).

## Verification checklist
- [ ] `pnpm run check` pasa (lint + `tsc --noEmit`).
- [ ] `pnpm test` pasa (54 tests existentes).
- [ ] `pnpm run build` pasa.
- [ ] `supabase_get_table_schema` muestra `feedback_reports` con RLS habilitado y las policies.
- [ ] Insert manual (SQL owner/admin) de una fila de prueba y consulta: la fila persiste y es legible por el owner.
- [ ] Manual UI: el botón "Feedback" aparece fijo dentro de la app (Dashboard/People/…); al abrirlo no navega; enviar sin descripción muestra validación; enviar completo muestra confirmación.
- [ ] Contexto: abrir desde `/import` en el paso 2 → contexto muestra "Import · Step 2 · Column mapping"; marcar "Feedback general" lo envía sin forzar etapa.
- [ ] RLS negativo: verificar que un usuario no pueda listar filas ajenas (policy select propio) y que insert con `user_id` distinto a `auth.uid()` sea rechazado.
- [ ] Sin regresión de análisis/simulación/importación (no se modificó su lógica).
