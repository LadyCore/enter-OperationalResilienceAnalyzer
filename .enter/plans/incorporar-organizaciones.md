# ORA — Acceso, DEMO y Licenciamiento

## Context

ORA es un analizador de resiliencia operacional (Vite + React + TS + Tailwind + shadcn + Enter Cloud). Hoy todo usuario autenticado tiene acceso pleno e ilimitado: al registrarse se le crea una organización DEMO y puede importar organizaciones. No existe gestión de acceso, vencimientos ni licencias.

Se requiere una capa nueva de gestión de usuarios, DEMO y licenciamiento que **no altere** la metodología, el análisis, la simulación ni el chatbot de ORA. `mariaeugeniasaldi@gmail.com` es la cuenta **propietaria**: acceso permanente, exento de DEMO/licencias, con capacidad administrativa. La modalidad **Suscripción queda preparada pero deshabilitada** comercialmente. No se implementan pagos reales.

**Datos reales en la base (verificados):**
- Propietaria: `mariaeugeniasaldi@gmail.com` (6656c6eb-…) con 11 organizaciones.
- Usuarios con evidencia de uso previo (tienen org DEMO creada antes de esta implementación): `facundo20072@gmail.com` (ac6954a5-…), `prueba2024@gmail.com` (a8776c7a-…).
- `ora-test@example.com` (4a9bb4f2-…) tiene **0 organizaciones**: sin evidencia confiable de uso → **no se migra**, queda listada para revisión administrativa.
- La cuenta propietaria queda excluida de la migración.

## Modelo de datos (nuevas tablas en `public`, migración única vía `supabase_migration`)

```
CLIENTE (clients)
   └── LICENCIA (licenses)
          └── license_users (usuario ↔ licencia)
demo_sessions        — DEMO por usuario (started_at, expires_at)
demo_usage_history   — registro de uso por DNI/CUIT (independiente de la cuenta)
notification_outbox  — avisos de email pendientes (arquitectura preparada, sin envío)
```

1. `profiles`: agregar columna `is_owner boolean not null default false`; marcar `true` a la propietaria por email. (No tocar `auth.users`.)
2. `clients`: `id uuid pk`, `name text not null`, `tax_type text check (dni|cuit) null`, `tax_id text null`, `email text null`, `created_at`. Índice único parcial sobre `tax_id` donde no nulo.
3. `licenses`: `id uuid pk`, `client_id fk clients`, `modality text check (perpetual|subscription)`, `status text check (active|suspended|expired) default active`, `version text not null default 'current'`, `issued_at`, `start_date`, `renewal_date null` (futuro de suscripción), `notes`.
4. `license_users`: `id uuid pk`, `license_id fk licenses on delete cascade`, `user_id fk auth.users on delete cascade`, `granted_at`, único `(license_id, user_id)`.
5. `demo_sessions`: `id uuid pk`, `user_id fk auth.users on delete cascade`, `client_id fk clients null`, `started_at timestamptz not null`, `expires_at timestamptz not null`, `created_at`.
6. `demo_usage_history`: `id uuid pk`, `tax_id text not null`, `tax_type text check (dni|cuit) not null`, `client_id fk clients null`, `demo_session_id fk null`, `used_at timestamptz default now()`. **Sin FK a usuario** → sobrevive a la eliminación de la cuenta y bloquea nuevos DEMO con el mismo DNI/CUIT durante 12 meses.
7. `notification_outbox`: `id uuid pk`, `user_id fk auth.users`, `demo_session_id fk null`, `kind text check (demo_expiring_3days|demo_expired)`, `planned_for timestamptz`, `status check (pending|sent|failed) default pending`, `created_at`, `sent_at null`.

**RLS en TODAS las tablas nuevas** (verificación obligatoria con `supabase_get_table_schema` después de migrar):
- `clients`, `licenses`, `license_users`, `demo_sessions`, `demo_usage_history`, `notification_outbox`: policy owner ALL (`using (public.is_owner())`).
- `license_users`, `demo_sessions`, `notification_outbox`: además policy SELECT del propio usuario (`user_id = auth.uid()` / subconsulta vía helper security definer `user_license_ids()` para evitar recursión en `licenses`).
- Usuarios: **sin policies de INSERT/UPDATE/DELETE** sobre estas tablas — todas las escrituras pasan por funciones security definer (`request_demo`, `grant_license`, etc.).

**Funciones (security definer, `search_path = public`):**
- `is_owner() returns boolean` — `select coalesce((select is_owner from profiles where id = auth.uid()), false)`.
- `request_demo(p_tax_type text, p_tax_id text, p_client_name text) returns jsonb` — activación atómica: valida DNI/CUIT; rechaza si propietario / licencia activa / DEMO activa; **rechaza si hay `demo_usage_history` con ese `tax_id` en los últimos 12 meses** (mensaje con fecha de re-elegibilidad); crea/reencontra cliente, `demo_sessions` (15 días corridos), `demo_usage_history`, y outbox (trigger).
- `get_my_access() returns jsonb` — resolución autoritativa de estado del usuario: `owner | perpetual_active | subscription_active (futuro) | demo_active | demo_expiring (≤3 días) | demo_expired | subscription_expired (futuro) | none` + días restantes, fecha de vencimiento, versión, modalidades disponibles.
- `grant_license(p_user_email, p_modality, p_version, p_client_name, p_tax_type, p_tax_id) returns jsonb` — solo owner (lanza si no). **`modality` acepta únicamente `perpetual`**; `subscription` se rechaza con "not available yet".
- `revoke_license(p_license_id) returns jsonb` — solo owner; estado `suspended`.
- `admin_grant_demo(p_user_email, p_tax_type, p_tax_id, p_client_name) returns jsonb` — solo owner; mismas reglas de elegibilidad que `request_demo` pero para el usuario objetivo.
- Trigger `demo_notifications_on_insert` sobre `demo_sessions`: inserta 2 filas en `notification_outbox` (`demo_expiring_3days` con `planned_for = expires_at - 3 days`; `demo_expired` con `planned_for = expires_at`). Esto cubre también la migración de usuarios históricos.

**Migración de usuarios pre-DEMO** (en la misma migración, con `now()` = fecha de implementación, sin inventar datos):
- `INSERT INTO demo_sessions (user_id, started_at, expires_at) SELECT id, now(), now() + interval '15 days' FROM profiles WHERE lower(email) IN ('facundo20072@gmail.com','prueba2024@gmail.com')` — DEMO de 15 días desde la migración. `client_id null` y **sin** `demo_usage_history` (no existe DNI/CUIT → no se inventa).
- Propietaria y `ora-test@example.com` quedan sin tocar (esta última visible en el panel de administración para revisión).

**Nota de decisión (seguridad):** el bloqueo por DEMO vencida se aplica en la capa de producto (`AccessGate` usa `get_my_access`, autoritativo del lado servidor). Las tablas de organizaciones conservan su RLS actual (datos propios del usuario intactos para no romper el funcionamiento existente ni la cuenta propietaria); el acceso al producto se bloquea al vencimiento y se restaura al licenciar.

## Flujo de acceso (frontend)

Estados expuestos al cliente: `owner`, `perpetual_active`, `subscription_active` (futuro), `demo_active`, `demo_expiring` (≤3 días), `demo_expired`, `subscription_expired` (futuro), `none`, y `demo_not_eligible` (resultado de activación).

- **Owner**: navega normal + ítem de navegación "Access & licensing" (único) → `/access`.
- **Nuevo usuario (estado `none`)**: pantalla de **activación de DEMO obligatoria** antes de usar ORA (toggle Persona→DNI / Empresa→CUIT + nombre de cliente). `request_demo` valida elegibilidad de 12 meses. Error "no elegible" muestra fecha de re-elegibilidad. Éxito → refresca acceso y entra.
- **`demo_active` / `demo_expiring`**: se usa ORA normal + **banner en cada acceso al Dashboard** ("You are using ORA in DEMO version. N days left. Expires DD/MM/YYYY. Continue with a Perpetual License of the current version."). Cuando `daysLeft ≤ 3` el banner pasa a variante obligatoria y destacada ("Your DEMO expires in 3 days on DD/MM/YYYY; after that your DEMO access ends — continue with a paid license"). Contador calculado en vivo desde `expires_at`.
- **`demo_expired`**: **bloqueo total** — pantalla de acceso denegado con `LicenseInfoDialog` (Licencia perpetua = disponible; Suscripción = futura/no disponible), contacto vía mailto a la propietaria. Sin pagos.
- **`perpetual_active` / `subscription_active`**: acceso normal, sin banners (owner tampoco).
- **Conversión DEMO→licencia**: sin perder cuenta ni datos; el owner otorga la licencia (manualmente, sin pago) y el siguiente `get_my_access` devuelve `perpetual_active`.

## Archivos

**Nuevos:**
- `src/lib/access/types.ts` — tipos (`AccessStatus`, `MyAccess`, constantes `DEMO_DAYS=15`, `ELIGIBILITY_MONTHS=12`, `OWNER_EMAIL`, `SUBSCRIPTION_ENABLED=false`).
- `src/lib/access/status.ts` — helpers puros: `daysLeft(expiresAt)`, `formatDateDDMMYYYY(date)` (ej. `10/09/2026`), `isExpiring(daysLeft)`, `resolveAccessState()`.
- `src/lib/access/status.test.ts` — tests unitarios (bordes: 0, 1, 3, 4, 14, 15 días; fecha).
- `src/lib/access/api.ts` — RPCs tipadas (`getMyAccess`, `activateDemo`, `grantLicense`, `revokeLicense`, `reissueDemo`) + consultas del panel admin (owner, via RLS).
- `src/lib/access/notifications.ts` — stub documentado del futuro envío por email (lee `notification_outbox`, NO envía; sin servidor de correo configurado).
- `src/components/access/AccessGate.tsx` — resuelve `get_my_access`; bloquea (activación / expirado) o renderiza hijos + banner; refresca tras acciones.
- `src/components/access/DemoActivationScreen.tsx` — DNI/CUIT + nombre; maneja `demo_not_eligible`.
- `src/components/access/DemoBanner.tsx` — banner de acceso + variante de vencimiento a 3 días (para `Dashboard`).
- `src/components/access/AccessBlockedScreen.tsx` — bloqueo por DEMO vencida.
- `src/components/access/LicenseInfoDialog.tsx` — modalidades (perpetua disponible; suscripción futura). Sin botones de pago.
- `src/pages/AccessAdminPage.tsx` — panel owner: resumen de usuarios (email, estado, fechas de DEMO, licencia), clientes, licencias, historial de uso; acciones: otorgar licencia perpetua, revocar/suspender, re-emitir DEMO.
- `src/components/access/admin/GrantLicenseDialog.tsx`, `ReissueDemoDialog.tsx` — formularios del panel.

**Modificados:**
- `src/integrations/supabase/types.ts` — regenerado por el framework tras la migración (no editarlo; si no se regenera, usar casts `as never`, patrón ya existente en `api.ts`).
- `src/store/OraContext.tsx` — exponer `access: MyAccess | null`, `refreshAccess()`, `isOwner` (cargar acceso junto al workspace, patrón `setTimeout` dentro del listener).
- `src/components/auth/AppGuard.tsx` — envolver `AppShell` con `<AccessGate>`.
- `src/components/layout/AppShell.tsx` — ítem "Access & licensing" solo owner.
- `src/router.tsx` — ruta `/access` (guard owner; redirect a `/`).
- `src/pages/Dashboard.tsx` — renderizar `<DemoBanner/>` arriba (aviso en cada acceso al inicio).

**No se tocan:** `src/lib/analysis.ts`, `exposure.ts`, `simulation.ts`, `src/lib/importer/*`, páginas de entidades, flujo de importación, formularios de autenticación existentes.

## Implementation checklist

- [ ] Migración única: tablas `clients`, `licenses`, `license_users`, `demo_sessions`, `demo_usage_history`, `notification_outbox` + columna `profiles.is_owner` + índices + triggers + funciones + policies RLS + asignación de propietaria + migración de los 2 usuarios históricos. Aplicada con `supabase_migration` y verificada con `supabase_get_table_schema` (RLS habilitado y policies presentes en cada tabla nueva).
- [ ] `request_demo` rechaza propietaria / licencia activa / DEMO activa / DNI-CUIT usado en los últimos 12 meses (respuesta con fecha de re-elegibilidad) y crea DEMO de 15 días corridos + `demo_usage_history` + outbox.
- [ ] `get_my_access` devuelve los estados: owner, perpetual_active, subscription_active (futuro), demo_active, demo_expiring (≤3 días), demo_expired, subscription_expired (futuro), none.
- [ ] `grant_license` solo owner, solo `perpetual` (rechaza `subscription`), asocia cliente + usuarios vía `license_users`; `revoke_license` → `suspended`; `admin_grant_demo` respeta la regla de 12 meses.
- [ ] Trigger de `notification_outbox` genera avisos `demo_expiring_3days` y `demo_expired` al insertar una `demo_sessions` (cubre migración histórica).
- [ ] `src/lib/access/status.ts` + tests: `daysLeft`, `formatDateDDMMYYYY`, `isExpiring` (bordes 0/1/3/4 días).
- [ ] `OraContext` expone `access`, `refreshAccess`, `isOwner` cargados en la restauración de sesión.
- [ ] `AccessGate` bloquea en `none` (activación obligatoria DNI/CUIT) y en `demo_expired` (pantalla de acceso denegado + `LicenseInfoDialog`); owner pasa siempre.
- [ ] `DemoBanner` en `Dashboard` en cada acceso durante DEMO activa: días restantes calculados en vivo, fecha exacta `DD/MM/YYYY`, variante obligatoria destacada a ≤3 días, CTA "Licencia perpetua".
- [ ] `LicenseInfoDialog` y pantallas no muestran botones de compra de Suscripción (deshabilitada) ni pagos.
- [ ] Ruta `/access` + nav solo owner con acciones: otorgar licencia perpetua, revocar/suspender, re-emitir DEMO; usuarios sin acceso (ej. `ora-test@example.com`) listados para revisión.
- [ ] `notifications.ts` documenta la arquitectura de email (outbox → envío futuro); sin envío ni simulación.

## Verification checklist

- [ ] `pnpm run check` pasa (lint + `tsc --noEmit`).
- [ ] `pnpm test` pasa (incluye tests nuevos de `status`).
- [ ] `pnpm run build` pasa.
- [ ] `supabase_get_table_schema` muestra RLS habilitado y policies en `clients`, `licenses`, `license_users`, `demo_sessions`, `demo_usage_history`, `notification_outbox`.
- [ ] Positivo: login propietaria → sin banners, sin bloqueo, ve "Access & licensing".
- [ ] Positivo: login `facundo20072@gmail.com` / `prueba2024@gmail.com` → DEMO activa desde migración, banner con días restantes y fecha `DD/MM/YYYY`.
- [ ] Positivo: nuevo usuario activa DEMO con DNI → banner DEMO; owner otorga licencia perpetua → banner desaparece (sin perder datos).
- [ ] Negativo: segundo intento de activación con el mismo DNI/CUIT (incluso con otra cuenta) → rechazo con fecha de re-elegibilidad a 12 meses.
- [ ] Negativo: `grant_license` con `modality=subscription` → error "not available yet"; sin UI de suscripción.
- [ ] Frontera: `daysLeft` 3 → variante de vencimiento destacada; 0 → bloqueo total (`demo_expired`) con opción de licencia.
- [ ] Invariante: `demo_usage_history` sin FK de usuario — eliminando una cuenta, el DNI/CUIT sigue bloqueado (verificado por consulta SQL).
