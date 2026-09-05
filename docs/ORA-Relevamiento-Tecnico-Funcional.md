# ORA — Relevamiento Técnico y Funcional (Etapa 1)

**Versión del documento:** 1.0
**Fecha:** 2026-09-05
**Alcance:** Estado real de ORA relevado del código, la base de datos, la configuración y las funciones desplegadas. Documento base para la documentación técnica/funcional. No modifica la aplicación.

> Convenciones: **(✓)** implementado y confirmable desde el código/configuración; **(±)** parcialmente implementado; **(?)** no confirmado; **(×)** previsto / no implementado; **(n/d)** no determinable desde el proyecto.

---

## 1. Identificación de ORA

- **Nombre:** ORA — Analizador de Resiliencia Organizacional (*Organizational Resilience Analyzer*).
- **Tipo:** Aplicación web SPA.
- **Propósito declarado en UI:** modelar la estructura operativa de una organización y analizar dependencia operativa y cobertura de capacidades (nunca el desempeño individual de personas).
- **Marca visible:** ORA; asistente integrado denominado **"Asistente de ORA"** (nombre interno no comercial; no se usa "Laura" en la interfaz).

## 2. Descripción general

ORA permite a un usuario (cuenta propietaria) crear una organización, modelar su estructura (procesos → funciones → tareas; competencias; roles; personas; áreas; coberturas de vacaciones; guardia pasiva), cargar datos desde Excel/CSV, ejecutar un análisis de criticidad y dependencia basado en reglas, simular escenarios de ausencias, y explorar relaciones mediante filtros. Incluye gestión de acceso (DEMO/licencia perpetua), feedback con capturas y un asistente contextual.

## 3. Objetivo de la aplicación

Analizar cómo está distribuida la capacidad operativa de una organización, dónde se concentra (personas, roles, competencias) y qué pasa si personas/roles no están disponibles, **sin evaluar desempeño individual**. El análisis es estructural y derivado de los datos modelados.

## 4. Arquitectura

- **Frontend SPA:** Vite + React 19 + TypeScript. Componentes propios sobre Radix UI/shadcn-style, Tailwind CSS, i18next. Routing con React Router v7 (`src/router.tsx`).
- **Backend:** Enter Cloud (infraestructura gestionada tipo Supabase): Postgres, Auth, Storage (buckets privados), funciones de servidor (Edge Functions en Deno). El frontend usa el cliente `@supabase/supabase-js` y funciones RPC/edge.
- **Estado global:** `OraProvider` (`src/store/OraContext.tsx`) con sesión, acceso/licencia/DEMO, multi-organización, `db` (modelo operativo completo en memoria) y una cola de persistencia (escrituras ordenadas).
- **Estructura de carpetas:** `src/pages` (rutas), `src/components/{auth,access,layout,entities,import,feedback,common,assistant,ui}`, `src/lib` (dominio: analysis, exposure, oncall, simulation, importer, access, feedback, assistant, relational, passwordPolicy, emailVerification, terms), `src/store`, `src/i18n`, `src/integrations/supabase` (cliente + tipos generados) y `src/integrations/ora` (capa de acceso a datos de organización), `src/data/seed` (datos demo).
- **Rutas (relevadas de `src/router.tsx`):** `/verify-email`, `/forgot-password`, `/reset-password`, `/terms` (públicas); área protegida `/` (dashboard), `/processes`, `/tasks`, `/competencies`, `/people`, `/analysis`, `/simulation`, `/import`, `/organization`, `/access`, `/feedback`; catch-all 404.
- **Funciones de servidor (carpeta `supabase/functions`):** `submit-feedback` (verify_jwt=false), `feedback-screenshot-urls`, `feedback-migrate-screenshots`, `ora-assistant`, `resolve-feedback` (verify_jwt=true), `smtp-diagnose` (verify_jwt=false).
- **Migraciones SQL:** `supabase/migrations/` (11 archivos): esquema completo + RLS + funciones/triggers.

## 5. Tecnologías

- **Lenguaje/Framework:** TypeScript 5.9, React 19, Vite 7, Tailwind CSS 3.4.
- **UI/UX:** Radix UI (accordion, alert-dialog, dialog, select, tabs, etc.), lucide-react, framer-motion, recharts, sonner (toasts), embla-carousel, vaul, cmdk.
- **Estado/rutas:** React Router v7; contexto propio (OraContext).
- **i18n:** i18next + react-i18next + detector de idioma (cookie `i18next`), locales en `public/locales/en.json` y `es.json` (claves planas; ~890 claves).
- **Datos:** Postgres vía Enter Cloud (Supabase) + RLS; generación de plantillas Excel con `xlsx` y `jszip`.
- **Auth:** Proveedor gestionado (email+contraseña, verificación de email, recovery) consumido con supabase-js.
- **Servicios externos:** SMTP Turbo (Turbo SMTP) para correos de feedback (confirmación y resolución); Enter AI All (`api.enter.pro`, modelo Gemini 3.6 Flash) para el asistente; Enter Analytics SDK para telemetría.
- **Almacenamiento:** Bucket privado `feedback-screenshots` (auto-creado por la función `submit-feedback` al primer uso).
- **Despliegue:** Build estático Vite (`dist`, sourcemaps deshabilitados) servido por la plataforma; funciones de servidor desplegadas vía herramienta de deploy de la plataforma.
- **Herramientas de calidad:** ESLint (flat config), Vitest (120 tests), tsc.

## 6. Módulos y funcionalidades

### 6.1 Autenticación y cuentas
- **Registro/Login (✓):** `LoginPage` (modo sign-in/sign-up). Registro exige email válido (rechazo del proveedor clasificado con mensaje en el campo, H-001) y contraseña que cumpla la política (H-013: mínimo 8, sin tope propio). 
- **Verificación de email (✓):** obligatoria (`AppGuard` bloquea hasta `email_confirmed_at`); `VerifyEmailPage` procesa el token del enlace; reenvío disponible. El email de verificación es gestionado por el proveedor (plantilla fuera del repositorio).
- **Recuperación de contraseña (✓):** `ForgotPasswordPage` (`resetPasswordForEmail`); `ResetPasswordPage` cambia la contraseña; sesión `PASSWORD_RECOVERY` queda bloqueada (gate de recuperación) hasta completar el cambio.
- **Cambio de contraseña (✓):** `ChangePasswordDialog` (desde el menú de usuario).

### 6.2 Acceso: DEMO y licencias
- **DEMO (✓):** 15 días; elegibilidad por DNI/CUIT con regla de reutilización de 12 meses (RPC `request_demo`/`admin_grant_demo` server-side); estados activa/por vencer/vencida; banner con avisos (3 días).
- **Licencia perpetua (✓):** `grant_license`/`revoke_license` (propietario); `get_my_access` resuelve el estado autoritativo.
- **Suscripción (±):** modelada en tipos/RPC (`subscription`) pero **deshabilitada** (`SUBSCRIPTION_ENABLED=false`; `grant_license` la rechaza).
- **Puertas de acceso (✓):** `AccessGate` muestra activación de DEMO o pantalla de bloqueo; `gateState` decide unlocked/activate_demo/blocked.

### 6.3 Dashboard (✓)
`/` — métricas reales (`computeDashboardMetrics`, `detectRiskFlags`, `buildOnCallMetrics`): procesos/tareas críticas, tareas sin cobertura, brechas de documentación, competencias concentradas, factor bus, concentración por rol; ratios de cobertura; panel de guardia (solo si hay asignaciones); highlights de riesgo (top 6); banner DEMO; tarjeta de organización; acceso a import y reseteo de demo (solo org demo).

### 6.4 Organización (✓)
`/organization` — multi-organización (switch), eliminar org no-demo (con confirmación y cascada), perfil de la org activa, "Modelo en números", editar org.

### 6.5 Procesos (✓)
`/processes` — árbol Proceso→Funciones→Tareas con CRUD y eliminación en cascada; badges de criticidad/dependencia; **filtros relacionales (✓)** por texto y criticidad derivada, con panel de "Personas relacionadas" (impacto) al filtrar.

### 6.6 Tasks (✓)
`/tasks` — registro de tareas con criticidad **derivada** (motor real), competencias requeridas, personas capaces, roles, documentación, dependencia y razones expandibles; **filtros relacionales combinables (✓)**: texto, proceso, criticidad, competencia, persona.

### 6.7 Competencies (✓)
`/competencies` — registro de competencias con titulares (holders), tareas críticas que las requieren, estado (concentrada/limitada/cubierta/sin uso), **filtros relacionales (✓)** por texto, proceso, tarea y persona; muestra los **procesos relacionados**.

### 6.8 People (✓)
`/people` — pestañas People / Roles / Coverage & on-call. CRUD de personas y roles; badges de estado; panel de **cobertura de vacaciones** y panel de **guardia pasiva**; eliminación con efectos en cascada. No tiene buscador propio (por diseño).

### 6.9 Analysis (✓)
`/analysis` — tarjetas de métricas (flags, tareas de una sola persona, sin cobertura, cobertura crítica), sección explicativa "cómo funciona la criticidad", lista de señales de riesgo por categoría, tabla de dependencia a nivel de tarea con explicaciones.

### 6.10 Simulation (✓)
`/simulation` — panel de escenarios: personas no disponibles simultáneamente, tipo (temporal/planificada/permanente), categoría (Vacation, Maternity, Training, Assignment, Other — valores en inglés como códigos), días/fechas, aplicación de cobertura de vacaciones (solo "Vacation"), reporte de impacto y exposición temporal (corta 1-3d, prolongada 4-14d, sostenida >14d o permanente).

### 6.11 Importación Excel/CSV (✓)
`/import` — asistente de 4 pasos: (1) datos de la org + archivo; (2) mapeo de columnas (sugerencia automática por palabras clave ES/EN); (3) validación (reporte con errores/advertencias, resolución de referencias ambiguas, bloqueos por referencias inexistentes); (4) confirmación y creación de la organización. El archivo se procesa en memoria (no se conserva); los datos extraídos se persisten. Plantilla oficial descargable (`PLANTILLA DE DATOS.xlsx`) con hoja Organizacion (22 columnas) e Instrucciones.

### 6.12 Filtros y búsquedas relacionales (✓)
Implementados en Processes, Tasks y Competencies sobre las relaciones reales (ver §8). People aparece como resultado de impacto, no como punto de entrada.

### 6.13 Feedback y capturas (✓)
- FAB global (pre-login y autenticado). Reporte: tipo, descripción, email obligatorio, 1–3 capturas (regla H-010 validada en UI + API + función + trigger de BD), contexto funcional/técnico (módulo, pantalla, etapa, userAgent, viewport, errores JS recientes, org).
- Administración (owner): listado con filtros/paginación, detalle con capturas vía **URLs firmadas temporales (1 h)** de un bucket **privado**, cambio de estado, **resolución (✓)**: marca `resolved`, elimina físicamente las capturas del bucket, limpia `context.screenshots`, registra `resolvedAt`/`resolvedBy` y envía email de notificación al reportador **solo si** el reporte tiene email válido (idempotente, owner-only server-side).
- Migración de capturas legacy (data URLs) al bucket (acción admin).

### 6.14 Selector Castellano / English (✓)
`LanguageSwitcher` en Login, sidebar (desktop y móvil) y página de Términos; persiste en cookie `i18next`; toda la UI traducida (en/es) mediante claves planas.

### 6.15 Asistente de ORA (chatbot) (✓)
Ver §12. FAB en el área autenticada, panel con streaming SSE, i18n es/en, navegación con allowlist real.

### 6.16 Términos y condiciones (✓)
`/terms` — página pública bilingüe v1.0 con 14 secciones basadas en el estado real; fecha de vigencia pendiente de definición ("Por definir"); enlaces desde Login y sidebar.

### 6.17 Otros
- **NotFound (✓)**; **toasts (✓)**; **lazy loading de rutas (✓)**; **analytics SDK (✓)** inicializado en `main.tsx` (detalles del payload n/d).

## 7. Usuarios, roles y permisos

- **Tipos de usuario:** propietario de ORA (`is_owner` por email fijo `mariaeugeniasaldi@gmail.com` en `profiles`), usuario con licencia perpetua activa, usuario DEMO (activa/por vencer/vencida), usuario sin acceso (`none`), anónimo (pre-login), cuenta sin email verificado (solo verificación).
- **Permisos del propietario (server-side, RPC `security definer`):** otorgar/revocar licencias, otorgar DEMO, ver perfiles/clientes/licencias/historial DEMO/outbox, gestionar estados y resolver feedback, ver todos los reportes de feedback.
- **Permisos del usuario común:** crear/gestionar sus organizaciones y su modelo operativo; ver su propio acceso/DEMO/licencia y sus propios reportes de feedback.
- **Aislamiento:** cada organización es visible solo para su cuenta propietaria (`user_org_ids()` + RLS). El propietario de ORA **no** tiene acceso a los datos operativos de organizaciones ajenas (las policies de tablas de org usan `user_org_ids()`, que solo devuelve las orgs del propio `auth.uid()`).
- **Control de acceso:** decisión de privilegios en servidor (RLS + RPC), nunca en cliente; guardas de ruta (`AppGuard`), verificación de email y gate de acceso.

## 8. Datos y relaciones

**Entidades (tablas públicas):** `organizations`, `areas`, `competencies`, `roles`, `processes`, `org_functions`, `tasks`, `people`, `vacation_coverages`, `on_call_assignments`, `profiles`, `clients`, `licenses`, `license_users`, `demo_sessions`, `demo_usage_history`, `notification_outbox`, `feedback_reports`.

**Relaciones reales (de `src/types/index.ts`):**
- Organization → Processes / Functions / Tasks / Areas / Competencies / Roles / People / Coberturas / Guardia (todas con `organization_id`).
- **Process → OrgFunction** (`function.processId`); **OrgFunction → Task** (`task.functionId`).
- **Task → Competency** (`task.requiredCompetencyIds[]`); **Task → Area** (`task.areaId`); **Task → System** (`task.systemName`, texto libre).
- **Person → Role** (`person.roleIds[]`), **Person → Area** (`person.areaIds[]`), **Person → Competency** (`person.competencyIds[]`), **Person → Task** (`person.taskIds[]`), **Person → Manager** (`person.managerId` autorreferente).
- **Role → Competency** (`role.competencyIds[]`).
- **VacationCoverage:** persona que cubre (`coveringPersonId`) → persona cubierta (`coveredPersonId`), con `taskIds`, `competencyIds`, `roleId`.
- **OnCallAssignment:** persona + modalidad/período (texto libre) + `taskIds`/`competencyIds`.

**Cadena People → Roles → Competencias → Tasks → Procesos (documentación):**
- Person posee Competencies (`competencyIds`) y es capaz de Tasks (`taskIds`); Person ocupa Roles (`roleIds`); Role agrupa Competencies (`competencyIds`); Task requiere Competencies (`requiredCompetencyIds`) y pertenece a una Function; Function pertenece a un Process. Toda consulta relacional (filtros, análisis, asistente) se deriva de estos vínculos.

## 9. Persistencia y base de datos

- **RLS habilitada en todas las tablas públicas.** Policies clave: orgs `orgs_owner_all`; tablas de modelo `*_org_scoped` (`organization_id = any(user_org_ids())`); feedback `insert own-or-anon`, `select own-or-owner`, `update owner`; access `owner_all` + `user_select`.
- **Funciones SQL `security definer`:** `user_org_ids()`, `is_owner()`, `user_license_ids()`, `request_demo()`, `get_my_access()`, `grant_license()`, `revoke_license()`, `admin_grant_demo()`, `bootstrap_demo_organization()`.
- **Triggers:** `prevent_demo_org_delete` (la org demo no se borra), `demo_notifications_on_insert` (crea 2 filas `pending` en `notification_outbox` por DEMO), `feedback_enforce_screenshots` (1–3 capturas en INSERT).
- **Persistencia de feedback:** `feedback_reports` (kind, description, module/screen/stage, is_general, status, `context` jsonb con contexto técnico, email del reportador, claves de capturas, confirmación/resolución).
- **Storage:** bucket privado `feedback-screenshots`, claves `feedback/{reportId}/{i}.jpg`.
- **notifications (±):** la tabla y el trigger existen; **no hay consumidor** que envíe los correos (el código de cliente lo documenta: "Nothing is sent today").

## 10. Flujos principales

1. **Registro → verificación → acceso:** signup → email de verificación (proveedor) → `VerifyEmailPage`/auto → `AppGuard` desbloquea → workspace (org demo auto-creada si no existe).
2. **Login / recuperación:** signInWithPassword; recovery con gate de sesión.
3. **Modelado:** People/Roles/Competencias/Procesos/Tasks/coberturas/guardia (CRUD con cola de persistencia).
4. **Importación:** archivo → mapeo → validación → creación de org (transactional RPC para demo).
5. **Análisis/simulación:** derivación de criticidad/dependencia/riesgos; escenarios simultáneos con cobertura de vacaciones y exposición.
6. **Feedback:** captura de contexto → submit (función: valida, sube capturas, persiste, envía confirmación) → admin resuelve (función: borra capturas, marca resuelto, notifica).
7. **Asistente:** contexto de pantalla + org → función (knowledge + anti-invención) → streaming.

## 11. Validaciones y manejo de errores

- **Contraseña (✓):** mínimo 8 caracteres, letra, número, carácter especial, sin espacios (H-013). Mensajes localizados.
- **Email (✓):** requerido; formato inválido/soportado → mensaje en el campo (clasificación del rechazo del proveedor, H-001) en Registro y Verificación.
- **Importación (✓):** valores booleanos y de criticidad aceptados (listas reales del validador), separador `;`, referencias (responsable/cobertura) que deben resolverse (ambiguas/inexistentes bloquean), duplicados por firma repetida, columnas sin mapear, valores no utilizables.
- **Feedback (✓):** 1–3 capturas (UI + API + función + trigger), email obligatorio y válido.
- **Estados de carga y errores:** spinners, errores en tarjetas/toasts, reintentos (workspace, asistente).
- **Asistente (✓):** detección de errores SSE en 4 niveles; reintento y nueva conversación.

## 12. Laura / chatbot (Asistente de ORA)

- **Integración (✓):** `AssistantFab`/`AssistantPanel` montados en `AppShell` (área autenticada, conviven con `FeedbackFab`); FAB flotante (bottom-right, por encima de Feedback).
- **Activación:** clic en el FAB; panel con sugerencias rápidas y chat.
- **Contexto que recibe (✓):** ruta actual, nombre e id de la org activa, y un bloque de **agregados reales** calculados en el cliente con los motores de ORA (`computeDashboardMetrics`, `detectRiskFlags`, `buildTaskAnalysis`, `buildOnCallMetrics`) según la pantalla; historial de conversación acotado (últimos 10 turnos); idioma actual (`i18n.resolvedLanguage`).
- **Información que puede utilizar (✓):** reglas y hechos de ORA (knowledge pack server-side derivado de `downloadTemplate`, `validate`, `analysis`, `exposure`, `oncall`, `simulation`, tipos y navegación) + contexto permitido. **Nunca** acceso directo a la base.
- **Funciones (✓):** ayuda con Excel/carga, navegación (allowlist de 11 destinos reales con chip "Ir a…" validado), interpretación educativa de resultados; reglas anti-invención y redirección de consultas fuera de alcance; reconoce falta de información.
- **Idioma (✓):** responde en el idioma de la UI (instrucción server-side); toda la UI del widget es i18n es/en.
- **Dependencia técnica (✓):** `@microsoft/fetch-event-source` (SSE), función `ora-assistant` (verify_jwt=true), Gemini 3.6 Flash vía Enter AI All (secret server-side), org check por RLS.
- **Nota de diseño:** el asistente no es enciclopedia de datos; los filtros relacionales cubren la investigación manual. No se usa el nombre "Laura".

## 13. Carga de Excel

- Plantilla oficial bilingüe conceptual (hoja en español) con 22 columnas + hoja Instrucciones; generación y descarga cliente (`xlsx`+`jszip`), con respaldo del archivo estático `/PLANTILLA DE DATOS.xlsx`.
- Mapeo automático por palabras clave ES/EN (`mapping.ts`); editor manual por campo; validación (`validate.ts`): campos vacíos válidos, integridad referencial, bloqueos; construcción del modelo (`buildOrganization.ts`) con deduplicación por nombre y agrupación por Legajo/nombre.

## 14. Feedback

- Captura: FAB global; contexto funcional (módulo/pantalla/etapa) y técnico (organización, viewport, userAgent, errores JS) congelado al abrir; email del reportador; 1–3 capturas.
- Persistencia: función `submit-feedback` (valida, sube capturas al bucket privado, inserta con id cliente para idempotencia, envía confirmación best-effort por Turbo SMTP y registra el resultado en `context.confirmation`).
- Admin: listado (filtros por estado/tipo/módulo/fechas/texto, paginación), detalle con URLs firmadas temporales, cambio de estado, **resolución** (borrado físico de capturas, limpieza de referencias, registro de resolución, notificación por email solo si hay email válido; idempotente).
- Migración de capturas legacy (admin).

## 15. Internacionalización

- Sistema único i18next; locales `en` (fallback estructural) y `es` (espejo exacto); claves planas con puntos; detector cookie→navegador→htmlTag (cookie `i18next`); se sincroniza `document.lang/dir`.
- Selector global en Login, sidebar y Términos. Sin RTL (solo `ltr`).
- `check-i18n`/`scan-i18n` en verde (paridad completa). Textos derivados del motor (p. ej. razones de análisis en inglés) permanecen como contenido generado (documentado como limitación).

## 16. Licencias y modalidad DEMO

- DEMO 15 días; elegibilidad 12 meses por DNI/CUIT (server-side); banner con avisos (≤3 días); notificación por email **prevista pero no enviada** (outbox sin consumidor).
- Licencia perpetua de la versión actual; revocación/suspensión por el propietario.
- Suscripción **no disponible** (deshabilitada).
- `get_my_access` es la fuente autoritativa de estado; `gateState` deriva la puerta de acceso.

## 17. Despliegue

- **Dev:** `vite` (host `::`, puerto 8080) con `vite-plugin-enter-dev`; preview de la plataforma en vivo.
- **Prod:** build `dist` (minify esbuild, **sin sourcemaps** por seguridad), servido como estático por la plataforma (hostname actual del backend `*.supabase.opentrust.net`).
- **Backend:** Enter Cloud gestionado (base + auth + storage + edge functions); funciones desplegadas individualmente (deploy por `index.ts` de cada carpeta; el deploy toma `verify_jwt` de `supabase/config.toml`).
- **Configuración necesaria:** secrets en entorno de funciones (`AI_API_TOKEN_…`, `TURBO_SMTP_USER`, `TURBO_SMTP_PASSWORD`, URL/keys automáticas); bucket `feedback-screenshots` (privado, auto-creado); plantilla de email de verificación configurada en el proveedor (fuera del repo).
- **Diferencias preview/producción:** no verificables en detalle desde el repo (plugins de la plataforma).

## 18. Estado actual del sistema

**IMPLEMENTADO Y CONFIRMABLE**
- Autenticación completa (registro/login/verificación/recuperación/cambio de contraseña), política de contraseña (min 8), feedback de email inválido (H-001).
- Acceso: DEMO (15 días, elegibilidad 12 meses), licencia perpetua, gate de acceso, banner.
- Modelo completo: People, Roles, Competencies, Tasks, Procesos, Funciones, Áreas, cobertura de vacaciones, guardia pasiva, multi-organización.
- Análisis (criticidad derivada, dependencia, riesgo, concentraciones), simulación de escenarios y exposición.
- Importación Excel/CSV (plantilla, mapeo, validación, construcción).
- Filtros relacionales en Processes/Tasks/Competencies (con People como impacto).
- Feedback completo (captura, capturas en bucket privado con URLs firmadas, admin, resolución con borrado físico + notificación).
- Asistente de ORA (contextual, streaming, allowlist, i18n).
- i18n es/en global; Términos y condiciones v1.0 (vigencia por definir).
- RLS, autorización server-side, secretos server-side, funciones protegidas con JWT (salvo las marcadas), build sin sourcemaps.
- Suite de calidad: 120 tests OK, tsc/eslint/build OK.

**IMPLEMENTADO PERO NO CONFIRMADO**
- Flujos interactivos que requieren sesión real y no pudieron ejecutarse en este entorno (login real, envío de email de verificación, E2E visual de filtros, chat real con el modelo, resolución de feedback con JWT real). Endpoints verificados a nivel HTTP (401/CORS), lógica verificada por código y por pruebas unitarias sobre datos reales.
- Detalles del payload de Enter Analytics (SDK activo).
- Existencia/policies del bucket antes del primer uso (la función lo auto-crea privado).

**PARCIALMENTE IMPLEMENTADO**
- Suscripción (modelada, deshabilitada comercialmente).
- `notification_outbox` (trigger + filas `pending`, **sin consumidor/email**).
- Migración de capturas legacy de feedback (acción admin disponible).
- `smtp-diagnose` (herramienta de diagnóstico, verify_jwt=false).
- Dependencias instaladas sin uso confirmado: `zod`, `react-hook-form`, `@tanstack/react-query`, `framer-motion`, `recharts`, `date-fns`, `input-otp` (varias son parte del template de UI).
- Fecha de vigencia de Términos (pendiente de definición).

**PREVISTO / NO IMPLEMENTADO**
- Envío de correos de expiración/vencimiento de DEMO (outbox).
- Eliminación administrativa de usuarios.
- Exportación de datos de la organización.
- Eliminación de reportes de feedback completos (no existe; solo resolución).
- Remoción del código/número del email de verificación (plantilla gestionada por el proveedor; ajuste pendiente de aplicar allí).
- Modalidad suscripción disponible.
- Nombre comercial del asistente (hoy "Asistente de ORA").

**NO DETERMINABLE**
- Región/datacenter, cifrado en reposo, backups/retención de infraestructura.
- Retención de logs de funciones/asistente.
- TTLs de sesiones y enlaces del proveedor; políticas del proveedor de IA.
- Detalle de eventos/campos de analítica.
- Jurisdicción y definiciones legales (datos en T&C marcados como a definir).

## 19. Dependencias/configuraciones relevantes

- `package.json`: React 19, Vite 7, Tailwind 3.4, supabase-js 2.57.4, i18next 25, react-i18next 15, react-router-dom 7, xlsx, jszip, sonner, lucide-react, @microsoft/fetch-event-source, @enter-pro/analytics-sdk, radix/*, vitest 4.
- `supabase/config.toml`: funciones con `verify_jwt=false` (smtp-diagnose, submit-feedback) y `true` (ora-assistant, resolve-feedback; feedback-screenshot-urls y feedback-migrate-screenshots sin entrada → default true).
- Generados no editables: `src/integrations/supabase/client.ts` y `types.ts`.
- Vite: alias `@`, `base: '/'`, `sourcemap: false`, `minify: esbuild`.

## 20. Observaciones técnicas

- Las decisiones de privilegios y aislamiento se toman en servidor (RLS + RPC security definer); el cliente nunca decide roles.
- Las funciones de servidor se despliegan por archivo único (`index.ts`); cualquier helper debe embeberse (p. ej. knowledge del asistente).
- El modelo de datos está fuertemente normalizado por `organization_id`; la org demo no puede eliminarse (trigger).
- Los valores "guardados" de algunas UI permanecen en inglés como códigos estables (categorías de ausencia, estados), traduciéndose solo las etiquetas.
- Los motores de análisis son puros y reutilizados por páginas, dashboard, simulación, filtros relacionales y asistente.

## 21. Funcionalidades pendientes o no confirmadas

- Consumidor del outbox de DEMO (emails) — pendiente.
- Términos: definir fecha de vigencia y aprobar contenido (hoy v1.0, "Por definir").
- Email de verificación: quitar códigos de la plantilla (gestión del proveedor).
- Exportación/borrado completo de datos y de reportes de feedback (no definidos).
- Definiciones legales/administrativas (propiedad, jurisdicción, retención, portabilidad) — pendientes de política oficial.
- Suscripción comercial — no disponible.
- Verificación interactiva final con sesión real (login, email, chat, filtros en pantalla, resolución de feedback).

---
*Fin del relevamiento. Basado exclusivamente en el estado actual del repositorio y de las configuraciones desplegadas; los ítems marcados (?) / (n/d) no deben presentarse como hechos en la documentación.*
