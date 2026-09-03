# ORA — Feedback integrado (transversal, contextual, persistente)

## Context

ORA necesita que los usuarios puedan reportar problemas de funcionamiento, errores, lentitud, bloqueos y sugerencias desde cualquier etapa del flujo. Decisión del usuario: el acceso a Feedback debe estar disponible **tanto en la aplicación autenticada como en las pantallas pre-login** (login/signup, verificación de email, recuperación de contraseña, activación DEMO y bloqueo), porque una falla de autenticación o de envío de correo puede impedir el ingreso. El **contexto capturado se adapta al nivel de información disponible en cada etapa** (sin usuario → reporte anónimo con contexto de pantalla/técnico; con usuario → se suma sesión/org/módulo). Es independiente del chatbot y de la telemetría existente. No se agrega panel de administración en esta etapa.

## Arquitectura

### Persistencia (Enter Cloud, migración única)
Tabla `public.feedback_reports`:
- `id uuid pk default gen_random_uuid()`
- `user_id uuid null references auth.users(id) on delete set null` — **nullable** para reportes pre-login (anónimos)
- `created_at timestamptz default now()`
- `kind text check in ('not_working','error','slow','stuck','suggestion','other')`
- `description text not null`
- `module text` (derivado de la ruta; null si es feedback general)
- `screen text` (pathname)
- `stage text null` (paso/sección instrumentada: verificación, reset, step del wizard…)
- `is_general boolean default false`
- `status text default 'new'` (futura gestión interna)
- `context jsonb default '{}'` (técnico según etapa: ruta previa/actual, userAgent, viewport, errores JS recientes, org activa cuando hay sesión)

RLS en la misma migración:
- insert: `with check (user_id is null or user_id = auth.uid())` → autenticados reportan con su id; pre-login insertan fila anónima.
- select: propio (`user_id = auth.uid()`) o owner (`public.is_owner()`).
- grants: `grant insert, select on public.feedback_reports to anon, authenticated;` (anon solo insert de filas con user_id null por la policy).
- Verificar con `supabase_get_table_schema` tras migrar (RLS on + policies).

### Frontend
- `src/lib/feedback/types.ts` — `FeedbackKind`, `FeedbackInput`, contexto técnico tipado.
- `src/lib/feedback/context.ts` — singleton:
  - `startFeedbackTelemetry()`: suscribe `window` a `error` y `unhandledrejection`, mantiene ring buffer (máx ~6) de errores JS.
  - `trackRoute(pathname)` + mapa ruta→módulo/pantalla (login/signup `/`, `/verify-email`, `/forgot-password`, `/reset-password`, `/processes`, `/people`, `/simulation`, `/import`, `/access`, …).
  - `setFeedbackStage(label|null)` para páginas/estados instrumentados.
  - `collectContext({ hasUser, org })`: arma JSON técnico adaptado (siempre: pathname, userAgent, viewport, errores recientes, timestamp; si hay sesión: email de perfil NO, org id/nombre, módulo/etapa; si es pre-login: solo pantalla/etapa).
- `src/lib/feedback/api.ts` — `submitFeedback(input)` inserta la fila (user_id: user?.id ?? null).
- `src/components/feedback/FeedbackDialog.tsx` — formulario: tipo (6 opciones), textarea obligatoria, panel "Contexto detectado" (módulo/etapa/pantalla, oculto/simplificado si es general), checkbox "Feedback general", Enviar; confirmación de recibido y reset.
- `src/components/feedback/FeedbackFab.tsx` — botón flotante discreto "Feedback" (bottom-right) que abre el diálogo sin navegar (no pierde estado de trabajo). Usa `useLocation` y `useOra` para contexto.

### Montaje transversal (todas las pantallas, con y sin sesión)
- `src/router.tsx` — nueva ruta **layout raíz** sin path: elemento `AppLayout` que renderiza `<Outlet />` + `<FeedbackFab />` y arranca la telemetría en un efecto. Todas las rutas actuales (verify-email, forgot-password, reset-password, "/" con AppGuard) quedan anidadas bajo ese layout → el botón aparece en login, verificación, reset y app autenticada.
- `src/components/layout/AppLayout.tsx` (nuevo) — `Outlet` + `FeedbackFab` + `useEffect(startFeedbackTelemetry)`.
- `src/pages/ImportOrganizationPage.tsx` — `useEffect([step])` → `setFeedbackStage(...)` (solo lectura del estado existente).
- `src/pages/PeoplePage.tsx` — reportar pestaña/sección activa si la expone (solo lectura).
- Opcional/estados con contexto extra: pantallas de auth ya quedan cubiertas por el mapeo de rutas del diálogo (no hace falta tocar LoginPage/VerifyEmail/Reset/Forgot; el FAB está vía layout).

### No se toca
Chatbot, análisis, simulación, DEMO/licencias/RLS de acceso, lógica de importación, autenticación/SMTP/redirects, identidad visual general. No se agrega UI administrativa.

## Implementation checklist
- [ ] Migración: `feedback_reports` + RLS (insert propio o anónimo; select propio/owner) + grants; verificada con `supabase_get_table_schema`.
- [ ] `src/lib/feedback/types.ts` y `context.ts` (telemetría de errores + rutas + stage + `collectContext` adaptado por sesión).
- [ ] `src/lib/feedback/api.ts` (`submitFeedback`, user_id null cuando no hay sesión).
- [ ] `src/components/feedback/FeedbackDialog.tsx` (6 tipos, descripción obligatoria, contexto visible según etapa, "Feedback general", confirmación).
- [ ] `src/components/feedback/FeedbackFab.tsx` (acceso persistente no invasivo).
- [ ] `src/components/layout/AppLayout.tsx` (Outlet + FAB + telemetría) y `src/router.tsx` (layout raíz que envuelve todas las rutas).
- [ ] `ImportOrganizationPage`: reportar paso actual. `PeoplePage`: reportar pestaña activa (si aplica).

## Verification checklist
- [ ] `pnpm run check`, `pnpm test`, `pnpm run build` pasan.
- [ ] `supabase_get_table_schema`: `feedback_reports` con RLS habilitado y policies (insert anónimo + propio, select propio/owner).
- [ ] SQL: insert de prueba con user_id null y con user_id; ambas persisten y el owner las lee.
- [ ] Manual UI: botón "Feedback" visible en **login**, `/verify-email`, `/forgot-password`, `/reset-password`, **y** en Dashboard/People/etc. Abrir no navega.
- [ ] Sin descripción → validación; completo → confirmación y reset del formulario.
- [ ] Contexto: pre-login muestra pantalla/etapa (sin exigir usuario); autenticado desde `/import` paso 2 muestra "Import · Step 2"; "Feedback general" evita forzar módulo.
- [ ] RLS negativo: un usuario no lista filas ajenas; insert con user_id ≠ auth.uid() es rechazado; insert anónimo solo con user_id null.
- [ ] Sin regresión de análisis/simulación/importación.
