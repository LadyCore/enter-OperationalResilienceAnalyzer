# ORA — Feedback integrado (transversal, contextual, persistente)

## Context

ORA necesita un sistema para reportar problemas, errores, lentitud, bloqueos y sugerencias desde **cualquier pantalla** (pre-login y autenticada), con contexto detectado automáticamente y persistencia para análisis posterior. Es independiente del chatbot y de la telemetría existente. No se agrega panel administrativo en esta etapa. Alcance confirmado por el usuario: acceso en app autenticada **y** pre-login (login/signup, verify-email, forgot/reset password, activación DEMO, bloqueo) porque una falla de auth/email puede impedir el ingreso. Contexto adaptado al nivel de información disponible en cada etapa.

## Decisiones de arquitectura (revisadas contra el código real)

- Rutas: `createBrowserRouter(routers)` plano (públicas + "/" con `AppGuard` + catch-all). No hay layout raíz hoy.
- Autenticación/sesión: `OraProvider` (`user`, `session`, `access`) + `AppGuard` (login si no hay usuario; `AccessGate` para activación/bloqueo; `AppShell` autenticado).
- Persistencia: Enter Cloud (tabla nueva, RLS). Reutiliza `supabase` y la función existente `public.is_owner()` para el owner.
- Telemetría existente: `@enter-pro/analytics-sdk` (page views / eventos de sitio). El Feedback **no la usa ni la duplica**: su captura técnica es un ring buffer local de errores JS/rejection que solo se adjunta al reporte al enviarlo.

## Privacidad (obligatorio)
- El contexto técnico **nunca** agrega automáticamente email, nombre u otros datos personales.
- Solo identificadores técnicos/funcionales necesarios: user_id (uuid), organización activa (id y nombre — contexto funcional), ruta/module/stage, userAgent, viewport, timestamp, últimos errores JS (message/stack, sin payloads de red).
- Si el usuario escribe datos personales en la descripción, es contenido que él decidió enviar.

## Persistencia (migración única)
Tabla `public.feedback_reports`:
- `id uuid pk default gen_random_uuid()`
- `user_id uuid null references auth.users(id) on delete set null` (null = pre-login)
- `created_at timestamptz default now()`
- `kind text check in ('not_working','error','slow','stuck','suggestion','other')`
- `description text not null`
- `module text null`, `screen text null`, `stage text null`
- `is_general boolean default false`
- `status text default 'new'`
- `context jsonb default '{}'` (sin datos personales)

RLS (misma migración): insert `with check (user_id is null or user_id = auth.uid())`; select `user_id = auth.uid() or is_owner()`; grants insert/select a `authenticated, anon` (anon solo puede insertar con user_id null por policy). Verificar con `supabase_get_table_schema`.

## Frontend

- `src/lib/feedback/types.ts` — tipos.
- `src/lib/feedback/context.ts` — singleton:
  - `startFeedbackTelemetry()`: listeners `error`/`unhandledrejection` (ring buffer máx ~6), solo para adjuntar al reporte.
  - `trackRoute(pathname)` y mapa ruta→módulo/etiqueta (login `/`, `/verify-email`, `/forgot-password`, `/reset-password`, `/processes`, `/people`, `/simulation`, `/import`, `/organization`, `/access`, …).
  - `setFeedbackStage(label|null)` para instrumentación.
  - `collectContext(scope)`: arma `context` técnico y `module/screen/stage` según sesión (autenticado suma org activa; pre-login solo pantalla/etapa). Sin email/name.
- `src/lib/feedback/api.ts` — `submitFeedback(input)` inserta con `user_id: user?.id ?? null`.
- `src/components/feedback/FeedbackDialog.tsx` — 6 tipos, textarea obligatoria, panel "Contexto detectado", checkbox "Feedback general" (no fuerza módulo), botón Enviar, confirmación de recibido + reset.
- `src/components/feedback/FeedbackFab.tsx` — botón fijo discreto abajo a la derecha, con identidad visual existente; **responsive**: `z-40` (por debajo de modales `z-50`), pequeño, no intercepta el área (solo el botón), sin solapar navegación/wizard/menús; en mobile queda por encima del contenido pero por debajo de modales y sin cubrir controles de la cabecera.

## Integración con la arquitectura real de rutas
- `src/components/layout/AppLayout.tsx` (nuevo): layout raíz **sin path** que renderiza `<Outlet />` + `<FeedbackFab />` y arranca la telemetría una vez (efecto). No modifica `AppGuard` ni las rutas hijas.
- `src/router.tsx`: envolver el array existente bajo un objeto `{ element: <AppLayout />, children: routers }`. **AppGuard, rutas públicas, rutas protegidas y el catch-all conservan exactamente su comportamiento** (layout sin path no altera matching). Se conservan `name`, `__routers__` y el lazy-loading.
- `src/pages/ImportOrganizationPage.tsx`: `useEffect([step])` → `setFeedbackStage(\`Step ${step} · ${STEPS[step-1]}\`)`. Solo lectura del estado existente; sin tocar la lógica del wizard.
- `src/pages/PeoplePage.tsx`: controlar el Tabs existente (value/onValueChange) para reportar la pestaña activa ("People"/"Roles") vía `setFeedbackStage`. Sin cambios funcionales visibles.

## No se toca
Chatbot, motor de análisis, simulaciones, DEMO/licencias, lógica de importación, autenticación/SMTP/redirects, identidad visual general, analytics existente. No se agrega panel administrativo.

## Implementation checklist
- [ ] Migración `feedback_reports` + RLS + grants; verificada con `supabase_get_table_schema`.
- [ ] `src/lib/feedback/types.ts` y `context.ts` (telemetría local de errores + mapa de rutas + stage + `collectContext` sin datos personales).
- [ ] `src/lib/feedback/api.ts` (`submitFeedback`, user_id null pre-login).
- [ ] `src/components/feedback/FeedbackDialog.tsx`.
- [ ] `src/components/feedback/FeedbackFab.tsx` (responsive, z-index bajo modales, no bloquea controles).
- [ ] `src/components/layout/AppLayout.tsx` (Outlet + FAB + telemetría).
- [ ] `src/router.tsx` (layout raíz que envuelve las rutas existentes sin alterarlas).
- [ ] `ImportOrganizationPage` y `PeoplePage`: instrumentación de etapa/tab.
- [ ] Confirmar con build que `AppGuard`, rutas públicas y protegidas quedan bajo el layout sin cambios de comportamiento.

## Verification checklist
- [ ] `pnpm run check`, `pnpm test`, `pnpm run build` pasan.
- [ ] `supabase_get_table_schema`: `feedback_reports` con RLS on y policies (insert anónimo/propio, select propio/owner).
- [ ] SQL: insert de prueba con user_id null y con user_id; persisten y el owner las lee.
- [ ] Manual UI: Feedback visible en **login**, **verify-email**, **forgot/reset password**, y en la app autenticada; abrir no navega ni pierde estado.
- [ ] Contexto cambia por pantalla (pre-login muestra pantalla/etapa; autenticado desde /import paso 2 muestra "Import · Step 2"; People muestra tab activa).
- [ ] "Feedback general" no fuerza módulo/etapa.
- [ ] FAB no bloquea botones/wizard/modales/formularios (desktop y mobile).
- [ ] No autenticado → flujo de login idéntico; autenticado → acceso idéntico; rutas protegidas y redirects sin cambios.
- [ ] El `context` jsonb guardado no contiene email ni nombre automático.
- [ ] Sin regresión de auth, importación, análisis, simulación ni licenciamiento.
