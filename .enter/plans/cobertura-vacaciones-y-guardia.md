# ORA · H-010 — Screenshots a Storage + email de confirmación de feedback

## Context

Hoy cada reporte de feedback guarda las capturas como data URLs base64 dentro de
`feedback_reports.context.screenshots` (una fila real pesa ~106 KB). Eso escala mal
en tamaño de fila y mantiene PII/imágenes embebidas en la base de datos.

La mejora H-010 pide:
1. **Migrar screenshots a file storage** (bucket **privado** `feedback-screenshots` +
   URLs firmadas temporales para el admin). No romper históricos; regla **1–3
   screenshots** validada en frontend **y** backend.
2. **Email de confirmación al autor** tras persistir el reporte (best-effort: suma
   ~2–5 s, nunca bloquea el reporte si el email falla; errores logueados).
   Contenido: app, confirmación, ID reporte, fecha, tipo, módulo, N screenshots.
   Texto "received with N screenshot(s)" sin adjuntar imágenes.
3. **Migrar también los históricos** (data URLs base64 → Storage), **conservando el
   original** (`context.screenshotsLegacy`) hasta verificar en el panel.

Decisiones de producto confirmadas por el owner:
- El **email es obligatorio para todo reporte** (también anónimos). Se pide en el diálogo.
- El email se envía **dentro de la misma operación de persistencia**, best-effort.
- Arquitectura: **bucket privado + URLs firmadas vía backend function** y email
  reutilizando **Turbo SMTP** (secrets `TURBO_SMTP_USER` / `TURBO_SMTP_PASSWORD`).
- Idempotencia: `reportId` (uuid) generado en el cliente; reintentos no duplican fila ni email.

## Arquitectura elegida

La persistencia pasa por una backend function `submit-feedback` (la única forma de
validar 1–3 en backend real y enviar email tras persistir en una sola operación).
RLS existente **no se toca** (insert/select/update siguen iguales); la fila se
inserta con el id del cliente y `ignoreDuplicates`. El bucket se crea desde la
function con service role (`storage.createBucket`) — no se hace DDL ni policies en
el esquema `storage`.

### Formato de `context.screenshots` (array de strings, como hoy)
- **Histórico / old:** `"data:image/jpeg;base64,..."`
- **Nuevo / migrado:** storage key string → `feedback/{reportId}/{i}.jpg`
  (dentro del bucket privado `feedback-screenshots`). Se conserva `string[]`, así
  conteo, tests y regla 1–3 no cambian de forma.

El admin resuelve las keys con URLs firmadas **solo al abrir el detalle**, vía una
function que exige JWT y deja que RLS del reporte decida (usuario propietario u
owner). Migración de históricos: function **solo owner** que recorre filas con data
URLs, las sube a Storage y reescribe `context` conservando el original en
`context.screenshotsLegacy`.

## Cambios de backend

### Migración SQL (defensa en profundidad, no toca RLS)
Nuevo trigger en `feedback_reports` **solo INSERT** que exige
`context->'screenshots'` array de 1 a 3 strings no vacíos. No es CHECK para no
romper UPDATE de estado sobre filas viejas. Se aplica con `supabase_migration`.

### Backend functions (en `supabase/functions/`)
| Function | verify_jwt | Rol | Qué hace |
|---|---|---|---|
| `submit-feedback` | `false` | anon + autenticado | valida payload (kind, description, email, 1–3 capturas data URL, tamaños); resuelve `user_id` del JWT si hay sesión; asegura bucket privado; sube cada captura decodificada a `feedback/{id}/{i}.jpg`; inserta fila `id=clientReportId` con `context.screenshots`=keys y `context.reporterEmail`=email (insert `.upsert(..., {onConflict:'id', ignoreDuplicates:true})`); si la fila **ya existía** → responde OK sin re-enviar (idempotente); si fue insert nuevo → envía email Turbo SMTP best-effort y guarda `context.confirmation` `{state:'sent'\|'failed', sentAt, error}`; devuelve `{ok, id, emailState}` |
| `feedback-screenshot-urls` | `true` (default) | autor del reporte u owner | body `{reportId}`; crea client con el JWT del caller (RLS decide quién puede ver); firma con service role cada key de `context.screenshots` que no sea `data:`; devuelve `{urls:[{index,url}]}` por índice original |
| `feedback-migrate-screenshots` | `true` (default) | **solo owner** (`is_owner()` con client del caller) | procesa N filas por llamada cuyo `context.screenshots` contenga algún `data:`; por cada una sube a `feedback/{id}/{i}.jpg`, escribe `context.screenshots`=keys y guarda el original en `context.screenshotsLegacy`; devuelve `{scanned,migrated,skipped,remaining}` |

Detalles comunes: `Deno.serve`, CORS (headers `authorization, x-client-info,
apikey, content-type`), imports desde esm.sh, client `createClient(SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})` (env estándar que el
runtime ya inyecta; se valida en logs), **sin SQL crudo**. Email: helper SMTP en
línea copiado del patrón de `smtp-diagnose` (TLS 465 a `pro.turbo-smtp.com`, FROM
`no-reply@oraresilience.com`), cuerpo plano con los datos + "received with N
screenshot(s)", sin adjuntos.

### `supabase/config.toml`
Añadir `[functions.submit-feedback] verify_jwt = false`. Las otras dos usan el
default (`true`).

## Cambios de frontend

- `src/lib/feedback/types.ts` — `FeedbackInput.email: string` (obligatorio).
- `src/lib/feedback/screenshots.ts` — helper `assertFeedbackEmailValid(email)`
  (no vacío + formato básico). Se mantiene `assertFeedbackScreenshotsValid`.
- `src/lib/feedback/api.ts` — `submitFeedback()` genera `crypto.randomUUID()` y
  llama `supabase.functions.invoke('submit-feedback', {body})`; valida email +
  1–3 antes; devuelve `{id, emailState}`. Se elimina el insert directo.
- `src/lib/feedback/admin.ts` — helpers puros:
  - `isStorageScreenshotKey(value)` → no empieza por `data:`.
  - `parseFeedbackReporterEmail(context)` (lee `context.reporterEmail`).
  - `fetchFeedbackScreenshotUrls(reportId)` → invoke `feedback-screenshot-urls`.
- `src/components/feedback/FeedbackDialog.tsx` — input de **email obligatorio**
  (prefill con email de sesión vía `FeedbackFab`); mensaje de privacidad breve;
  pantalla de éxito menciona el email de confirmación; estados de error si el
  email falla (el reporte igual quedó persistido).
- `src/components/feedback/FeedbackFab.tsx` — pasa `user?.email` como email inicial.
- `src/components/feedback/FeedbackDetailDialog.tsx` — muestra email del autor
  (perfil si hay `user_id`, si no `context.reporterEmail`); resuelve screenshots:
  las `data:` se renderizan directo; las storage keys piden URLs firmadas al abrir
  el detalle (estado loading/error por si expira o falla) y se muestran igual.
- `src/pages/FeedbackAdminPage.tsx` — botón owner-only **"Move historical
  screenshots to secure storage"** que invoca `feedback-migrate-screenshots` y
  muestra resultado (migrated/remaining) con toast.

## Reuso
- `fileToCompressedDataUrl()` (compresión a JPEG) — sin cambios.
- `assertFeedbackScreenshotsValid()` — sin cambios (misma regla 1–3).
- Patrón SMTP de `supabase/functions/smtp-diagnose/index.ts` (secrets Turbo).
- `parseFeedbackContext` / tabla + RLS existentes intactas.
- Tipos `Database["public"]["Tables"]["feedback_reports"]` sin cambios de columna
  (todo vive en `context`, columna ya `jsonb`).

## Archivos críticos
- `supabase/functions/submit-feedback/index.ts` (nuevo)
- `supabase/functions/feedback-screenshot-urls/index.ts` (nuevo)
- `supabase/functions/feedback-migrate-screenshots/index.ts` (nuevo)
- `supabase/config.toml`
- Migración SQL vía `supabase_migration` (trigger INSERT 1–3)
- `src/lib/feedback/{types,screenshots,api,admin}.ts`
- `src/components/feedback/{FeedbackDialog,FeedbackFab,FeedbackDetailDialog}.tsx`
- `src/pages/FeedbackAdminPage.tsx`

## Implementation checklist
- [ ] Migración SQL aplicada: trigger BEFORE INSERT en `feedback_reports` que exige
      `context->'screenshots'` array con 1–3 strings no vacíos; verificar con
      `supabase_get_table_schema`.
- [ ] `config.toml` con `[functions.submit-feedback] verify_jwt = false`.
- [ ] Escribir `submit-feedback/index.ts`: validaciones (kind, description, email,
      1–3 data URLs, topes de tamaño), resolución de `user_id` por JWT, ensure
      bucket privado `feedback-screenshots`, upload `feedback/{id}/{i}.jpg`,
      insert `onConflict:'id' ignoreDuplicates`, email Turbo SMTP best-effort,
      `context.confirmation` y respuesta `{ok,id,emailState}`.
- [ ] Deploy de `submit-feedback` y comprobación en logs de que
      `SUPABASE_SERVICE_ROLE_KEY` está disponible y el bucket se crea.
- [ ] Escribir y desplegar `feedback-screenshot-urls`: devuelve URLs firmadas por
      índice solo si RLS deja leer la fila al caller.
- [ ] Escribir y desplegar `feedback-migrate-screenshots`: solo owner, conserva
      `context.screenshotsLegacy`, devuelve contadores; probado contra fila real
      `ad6c7170-ea31-46a0-afb7-b4b201a4eba9`.
- [ ] Frontend `types.ts` + `screenshots.ts` (email) + `api.ts` (invoke, uuid).
- [ ] `FeedbackDialog.tsx`: campo email obligatorio + validación + textos.
- [ ] `FeedbackFab.tsx`: prefill email de sesión.
- [ ] `admin.ts` helpers + `FeedbackDetailDialog.tsx`: render data: directo, storage
      keys vía URLs firmadas, email del autor correcto.
- [ ] `FeedbackAdminPage.tsx`: botón de migración owner-only con resultado.
- [ ] Tests de unidad actualizados/añadidos para helpers nuevos y regla de email
      (mantener suite `feedback/*.test.ts` verde).

## Verification checklist
- [ ] `pnpm lint` + `pnpm exec tsc --noEmit` + `pnpm test` (suite completa en verde).
- [ ] Regla 1–3: 0 capturas → bloqueado; 1/2/3 → OK; 4ª → bloqueada (frontend **y**
      function devuelve error si se fuerza por la API).
- [ ] Envío real (feedback): reporte con 1, 2 y 3 screenshots persiste con keys de
      storage (no base64) y `context.reporterEmail`; verificar fila por
      `supabase_read_query` (tamaño de fila pequeño).
- [ ] Idempotencia: repetir el mismo `reportId` no crea fila duplicada ni reenvía email.
- [ ] Email: logs de `submit-feedback` muestran SMTP 250/aceptado (Turbo), con
      contenido reporte id/fecha/tipo/módulo/N screenshots y sin adjuntos; si SMTP
      falla, el reporte sigue persistido y `context.confirmation.state='failed'`.
- [ ] Admin: abrir detalle como owner → screenshots visibles vía URL firmada (imagen
      carga en el panel); como no-owner/no-autor → la function no firma (403/vacío).
- [ ] Histórico: fila `ad6c7170-…` migrada → screenshots visibles y
      `context.screenshotsLegacy` conserva el base64 original.
- [ ] Email obligatorio: intentar submit sin email → error de validación en frontend
      y en la function.
