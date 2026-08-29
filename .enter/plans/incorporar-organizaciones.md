# ORA multi-organización: importación Excel/CSV + persistencia en Enter Cloud

## Context

ORA hoy es una demo de una sola organización (Meridian Group) persistida en `localStorage`
(`ora-data-v1`), sin "organización activa"; "Reset Demo Data" reemplaza todo el dataset. Objetivo:
ORA deja de ser una demo y se convierte en un prototipo que trabaja con organizaciones reales.
Flujo principal: `archivo Excel/CSV → carga → mapeo → validación → normalización → creación de
organización → análisis ORA`. La organización demo permanece como dataset independiente: nunca se
modifica ni elimina por operaciones sobre organizaciones reales.

Decisiones confirmadas (spec del usuario):
1. **Persistencia Enter Cloud desde el inicio** (no localStorage como almacenamiento principal).
2. **Auth email + contraseña** (login y signup, auto-confirmación).
3. **Multi-organización**: cada usuario tiene sus organizaciones y selecciona cuál analizar.
4. **Demo**: al primer login sin organizaciones, se crea automáticamente Meridian Group (por usuario).
5. **Reset Demo Data**: actúa solo sobre la demo. **Demo nunca eliminable** (también en la capa de datos).
6. **Área** como entidad independiente. **Jerarquía**: `Person.managerId` refiere a persona de la misma org.
7. **Importación tabla plana** (una fila = una persona; listas múltiples separadas por `;`).

Sin ampliar alcance: sin SAP/Workday/APIs externas/SSO/roles complejos/múltiples hojas. La arquitectura
(importer + capa `api.ts`) queda preparada para esas extensiones, sin implementarlas.

---

## 1. Esquema de datos (una única migración)

Tablas en `public`, **RLS habilitada en la misma migración**, ids `text` generados en cliente con
`uid()` (`src/lib/id.ts`), `organization_id` con `on delete cascade`:

- `profiles` (id uuid PK → auth.users, email, created_at) + **trigger `handle_new_user`** (inserta
  perfil al signup).
- `organizations` (id text PK, name, description, **is_demo bool**, owner_id uuid → auth.users, created_at).
- `areas`, `competencies`, `roles` (id text PK, organization_id, name, description; roles con
  competency_ids text[]).
- `people` (id text PK, organization_id, name, **employee_id text**, role_id → roles, area_id → areas,
  manager_id → people, is_active bool, competency_ids text[], task_ids text[]).
- `processes` (id text PK, organization_id, name, description, criticality).
- `org_functions` (id text PK, organization_id, process_id → processes, name, description, criticality).
- `tasks` (id text PK, organization_id, function_id → org_functions, area_id → areas, name, description,
  criticality, is_documented bool, system_name, required_competency_ids text[]).

**Protecciones de datos (demo y concurrencia):**
- Trigger **`prevent_demo_org_delete`**: `BEFORE DELETE ON organizations` lanza excepción si
  `is_demo = true` → la demo no puede eliminarse ni por UI ni por API/consulta directa.
- Índice único parcial **`organizations_one_demo_per_owner`**:
  `CREATE UNIQUE INDEX ... ON organizations (owner_id) WHERE is_demo IS TRUE;` → garantiza a nivel de
  base que cada usuario tiene a lo sumo una demo (bloquea carreras por pestañas/procesos simultáneos).

**RLS:** función security-definer `user_org_ids()` → `SELECT id FROM organizations WHERE owner_id = auth.uid()`.
Políticas: `organizations` → `owner_id = auth.uid()`; tablas hijas → `organization_id = any(user_org_ids())`;
`profiles` → `id = auth.uid()`.

**Auth:** `supabase_configure_auth` — signup email con auto-confirmación.

**Verificación obligatoria post-migración:** `supabase_get_table_schema` sobre cada tabla nueva →
existencia, columnas, FK, RLS habilitada y políticas listadas. Corregir en el mismo turno si falta.

---

## 2. Modelo y seed (frontend)

- `src/types/index.ts`: interfaz `Area`; `Db.areas: Area[]`; `CollectionKey` += `"areas"`;
  `Person.managerId?: string; areaId?: string; employeeId?: string`; `Task.areaId?: string`;
  `Organization.isDemo?: boolean`.
- `src/data/seed.ts`: `seedDb.areas = []`; `SEED_ORG.isDemo = true`; util **`remapSeedIds(seedDb)`**
  que reasigna TODOS los ids y referencias internas (org, procesos, funciones, tareas, roles, personas,
  competencias) preservando nombres y relaciones — los ids fijos del seed nunca se insertan tal cual.
- `src/integrations/supabase/client.ts` y `types.ts` no se editan (los reescribe el framework).

---

## 3. Capa de datos `src/integrations/ora/api.ts`

Capa entre el modelo `Db` de ORA y las tablas del backend:
- Mapeo colección ↔ tabla; serialización/deserialización; inyección de `organization_id`.
- CRUD por fila; carga completa de una organización; creación respetando FKs en orden
  **processes → org_functions → tasks → areas → competencies → roles → people**.
- Personas: insert inicial con `manager_id` nulo + **segundo pase** para resolver jerarquías.
- **`removeOrganization(id)`**: en esta capa, si la org es `is_demo` → rechazar (no depende solo de UI).
- **`ensureDemoOrgIfNeeded(userId)`**: crea la demo solo si el usuario no tiene ninguna; la creación
  es idempotente (el índice único parcial protege contra carreras; ante error de unicidad se relee).

---

## 4. Store `src/store/OraContext.tsx` (refactor)

- **Sesión:** `supabase.auth.onAuthStateChange` registrado **antes** de `getSession`; sin callbacks
  async dentro del listener; llamadas a `supabase` dentro del callback diferidas con `setTimeout(…,0)`.
  Estado: `user`, `session`, `isLoading`.
- **Estado de orgs:** `organizations` (resumen `{id, name, isDemo}`), `activeOrganizationId`
  (persistido solo como preferencia de UI en `localStorage` clave `ora-active-org`; los datos de las
  organizaciones viven exclusivamente en backend), `db` = org activa cargada en memoria.
- **API actual sincrónico mantenido** (formularios existentes no cambian): `setOrganization`, `upsert`,
  `remove`, `resetToSeed` → aplican en memoria y persisten vía `api.ts` con **cola de escrituras
  encadenada** (preserva orden; toast de error si falla).
- **Nuevas acciones:** `addOrganization(db)` (crea en backend y activa), `setActiveOrganization(id)`
  (carga filas), `removeOrganization(id)` (rechaza demo), `signOut`.
- **Demo al primer login:** tras restaurar sesión, si `organizations` está vacío →
  `ensureDemoOrgIfNeeded` (crea `remapSeedIds(seedDb)`) y la activa.
- **`resetToSeed`:** solo si la org activa es demo → elimina la demo del usuario (borrado + recreación
  con nuevos ids vía `remapSeedIds`) y **actualiza `activeOrganizationId` al nuevo id**; nunca toca
  organizaciones importadas.

---

## 5. Auth UI

- `src/components/auth/AuthGate.tsx`: restaurando → loader; sin sesión → `LoginPage`; con sesión → app
  (envuelve el router en `src/App.tsx`).
- `src/components/auth/LoginPage.tsx`: email + contraseña, tabs login/signup;
  `signUp` con `emailRedirectTo: ${window.location.origin}/`; `signInWithPassword`.
- `AppShell`: dropdown de usuario (email) con "Cerrar sesión".

---

## 6. Importación (nuevo)

**Dependencia:** `xlsx`.

Módulos `src/lib/importer/`:
- `types.ts`: campos ORA mapeables: `persona`, `employeeId` (identificador de persona), `area`,
  `responsable`, `managerId` (identificador del responsable), `rol`, `roleId`, `proceso`, `funcion`,
  `tarea`, `competencia`, `documentada`, `activo`, `criticidad`. `ColumnMapping`, `ParsedFile`,
  `ValidationSummary`, `ImportIssue`.
- `parseFile.ts`: `XLSX.read(ArrayBuffer)` → primera hoja → header row → `{columns, rows}`.
- `mapping.ts`: **`suggestMapping(columns)`** por palabras clave es/en, p. ej.:
  `empleado|persona|nombre`→persona; `legajo|employee id|employeeid|identificador`→employeeId;
  `sector|área|departamento|department`→area; `responsable|superior|manager|jefe`→responsable;
  `responsableid|managerid`→managerId; `puesto|rol|cargo|job title`→rol; etc. Edición manual total.
  No asumir que todas las columnas existen.
- `validate.ts`: construye el resumen de validación (ver §8) a partir de rows+mapeo; aplica la
  **regla estricta una fila = una persona** (filas con mismo nombre → posibles duplicados marcados,
  nunca ignorados silenciosamente ni fusionados).
- `buildOrganization.ts`: normalización `archivo → datos normalizados → entidades ORA → relaciones`:
  - Una única entidad por valor dentro de la org (áreas, roles, procesos, funciones, tareas,
    competencias) — sin duplicados porque el mismo valor aparezca en varias filas.
  - **Resolución de responsables:** si hay `managerId` de origen → resolver por identificador; si no,
    por nombre; **varias coincidencias → marca "ambigua" (bloqueante, exige revisión antes de
    importar)**; responsable inexistente → problema de validación. Nunca resolver silenciosamente.
  - Ids nuevos con `uid()`; procesos/funciones default `important`, tareas default `standard` salvo
    columna `criticidad`; valores de `criticidad` no reconocidos → "valores no utilizables".

---

## 7. Wizard `/import` (4 pasos)

`src/pages/ImportOrganizationPage.tsx` (ruta lazy en `router.tsx`):
1. Nombre + descripción + archivo Excel/CSV.
2. Mapeo de columnas (sugerencias automáticas + edición manual).
3. **Validación y resumen** (ver §8) + resolución de referencias ambiguas/inexistentes mediante
   selección manual; botón "volver al mapeo".
4. Confirmación → `buildOrganization` → `addOrganization(db)` → activa org → dashboard.

---

## 8. Validación (resumen mostrado antes de crear)

- Cantidad de registros; personas detectadas; áreas; roles; procesos; funciones; tareas; competencias;
  relaciones jerárquicas; registros incompletos (filas sin nombre → **excluidas de la creación** y
  contabilizadas); posibles duplicados; referencias inexistentes; referencias ambiguas; columnas sin
  mapear; valores no utilizables.
- Problemas bloqueantes (duplicados marcados, referencias inexistentes/ambiguas) impiden confirmar
  hasta resolverse; el resto se muestra informativo.

---

## 9. UI multi-organización y personas/tareas

- `AppShell`: **selector de organización** (dropdown en sidebar) con las orgs del usuario +
  "+ Incorporar organización" (`/import`); la org activa determina los datos que muestra ORA.
- `OrganizationPage`: listar organizaciones; cambiar org activa; incorporar; eliminar orgs no-demo
  (la demo no ofrece opción de eliminación). Conteo de áreas en "Model in numbers".
- `Dashboard`: "Reset demo data" visible solo cuando la org activa es la demo.
- `PeoplePage` + `PersonFormDialog`: columnas/campos **Área** y **Responsable** (select entre personas
  de la misma org, excluye a la propia persona).
- `TaskFormDialog`: campo **Área** (no perder `areaId` al editar tareas importadas).

---

## Archivos críticos

| Archivo | Acción |
|---|---|
| Migración (`supabase_migration`) | 9 tablas + RLS + `user_org_ids()` + trigger `handle_new_user` + trigger `prevent_demo_org_delete` + índice único parcial demo |
| `supabase_configure_auth` | signup email auto-confirm |
| `src/types/index.ts`, `src/data/seed.ts` | Area, employeeId, managerId, areaId, isDemo + `remapSeedIds` |
| `src/integrations/ora/api.ts` | nuevo: CRUD ↔ tablas, orden FKs, protección demo, `ensureDemoOrgIfNeeded` |
| `src/store/OraContext.tsx` | refactor sesión + multi-org + persistencia + cola de escrituras |
| `src/components/auth/{AuthGate,LoginPage}.tsx` | nuevos |
| `src/lib/importer/*` (5 archivos) | nuevos |
| `src/pages/ImportOrganizationPage.tsx` + `src/components/import/*` | nuevos |
| `src/router.tsx`, `src/App.tsx` | rutas `/login`, `/import`, AuthGate |
| `src/components/layout/AppShell.tsx`, `src/pages/{OrganizationPage,Dashboard,PeoplePage}.tsx`, `src/components/entities/{PersonFormDialog,TaskFormDialog}.tsx` | ajustes UI |
| `package.json` | `xlsx` |

Reutilizados: `uid()` (`src/lib/id.ts`), `cloneDb` (`src/data/seed.ts`), `ConfirmDeleteDialog`,
`PageHeader`, `MultiSelect`, `Field`, componentes shadcn, `useOra()` (mismo API para formularios),
análisis (`src/lib/analysis.ts`, `src/lib/simulation.ts`) sin cambios funcionales.

---

## Implementation checklist

- [ ] Migración única con 9 tablas + `handle_new_user` + `user_org_ids()` + `prevent_demo_org_delete` + índice único parcial demo + RLS con políticas por usuario en cada tabla.
- [ ] `supabase_get_table_schema` por tabla: existencia, columnas, FK, RLS y políticas verificadas; corregir en el turno si falta.
- [ ] `supabase_configure_auth`: signup email auto-confirm.
- [ ] Tipos y seed: `Area`, `Db.areas`, `CollectionKey`+areas, `Person.employeeId/managerId/areaId`, `Task.areaId`, `Organization.isDemo`, `remapSeedIds`.
- [ ] `api.ts`: mapeo colección↔tabla, CRUD, load org, create ordenado por FKs (manager en 2º pase), `removeOrganization` rechaza demo, `ensureDemoOrgIfNeeded` idempotente.
- [ ] Store: sesión (listener antes de getSession, sin async en callback), multi-org, `activeOrganizationId` como preferencia local, API sincrónico + cola de escrituras, demo al primer login, `resetToSeed` (solo demo, actualiza activeOrganizationId).
- [ ] AuthGate + LoginPage (login/signup) + signOut en AppShell.
- [ ] Dep `xlsx`; `src/lib/importer/*` completo (parse, mapping es/en, validate con regla fila=persona, buildOrganization con normalización y resolución de responsables sin ambigüedad).
- [ ] Wizard `/import` 4 pasos de punta a punta (incluye resolución de referencias en paso 3 y bloqueo por issues bloqueantes).
- [ ] Switcher en AppShell; OrganizationPage (listar/cambiar/incorporar/eliminar no-demo); Dashboard "Reset demo data" solo en demo.
- [ ] PeoplePage/PersonFormDialog (Área, Responsable sin auto-referencia) y TaskFormDialog (Área).
- [ ] `pnpm run check` y `pnpm run build` en verde.

## Verification checklist

- [ ] `supabase_get_table_schema` en las 9 tablas nuevas: columnas, FK, RLS habilitada, políticas listadas.
- [ ] Auth: signup/login con email; contraseña corta/email inválido muestran error; auto-confirmación permite entrar sin verificar email.
- [ ] Primer usuario: primer login crea automáticamente Meridian Group y el dashboard se ve igual al actual.
- [ ] Persistencia: editar nombre/descripción → recargar → persiste (backend).
- [ ] Importación: cargar Excel/CSV de prueba con `Empleado;Sector;Responsable;Puesto;Tareas;Competencias`, mapear, validar, crear → org activa; dashboard/analysis/simulation funcionan con ella.
- [ ] Identificadores: filas con `employeeId`/`managerId` resuelven relaciones por id antes que por nombre.
- [ ] Referencias: responsable inexistente → problema; varias coincidencias por nombre → ambigua y bloqueante hasta revisión; nunca se resuelve silenciosamente.
- [ ] Normalización: mismo área/rol/proceso/función/tarea/competencia en varias filas → una sola entidad por valor en la org.
- [ ] Duplicados: dos filas con el mismo nombre de persona → marcados como posibles duplicados; filas sin nombre → excluidas y contabilizadas como incompletas.
- [ ] Separación: eliminar una org importada deja la demo intacta; la demo no ofrece eliminación; `removeOrganization`/delete por datos rechazan `is_demo` (trigger).
- [ ] Unicidad demo: dos inits/escenarios concurrentes no producen una segunda demo (índice único parcial).
- [ ] Reset: estando en demo, reset restaura solo Meridian Group y deja activa la nueva demo con su nuevo id; las orgs importadas no cambian.
- [ ] Multi-usuario: segunda cuenta no ve organizaciones de la primera (RLS).
- [ ] Errores: archivo corrupto o sin hoja → error claro en paso 1.
- [ ] Build: `pnpm run build` y `pnpm run check` en verde.
