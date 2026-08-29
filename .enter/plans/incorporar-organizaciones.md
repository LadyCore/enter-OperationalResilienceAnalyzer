# ORA multi-organización: importación Excel/CSV + persistencia en Enter Cloud

## Context

ORA hoy es una demo de una sola organización (Meridian Group) persistida en `localStorage`
(clave `ora-data-v1`), sin concepto de "organización activa"; "Reset Demo Data" reemplaza
todo el dataset. El objetivo es que ORA funcione como prototipo aplicable a organizaciones
reales: incorporar organizaciones desde archivos Excel/CSV (flujo `archivo → carga → mapeo →
validación → creación → análisis`) sin tocar la organización demo.

Decisiones confirmadas con el usuario:
1. **Persistencia en Enter Cloud (backend) desde el inicio** — no localStorage para los datos.
2. **Login email y contraseña** — cada usuario tiene sus organizaciones; al primer login se crea
   automáticamente su organización demo (Meridian Group). "Reset Demo Data" resetea solo esa demo.
3. **Entidad Área completa** — nueva entidad `Area`; personas y tareas pueden pertenecer a un área.
4. **Relaciones jerárquicas** — campo `Person.managerId` (responsable/superior).
5. **Estructura de importación: tabla plana** — una fila por persona; listas múltiples separadas
   por `;` en la celda (tareas, competencias, funciones, procesos).

Principio rector: la demo queda intacta como dataset independiente y protegida (nunca eliminable).

---

## 1. Esquema de datos (migración Enter Cloud)

Una sola migración (tool `supabase_migration`). Todas las tablas en `public`, con **RLS habilitada
en la misma migración** y políticas que aíslan por usuario. Ids `text` generados en el cliente
(reutilizando `uid()` de `src/lib/id.ts`); `organization_id` con `on delete cascade`.

- `profiles` (id uuid PK → auth.users, email, created_at) + **trigger `handle_new_user`** que inserta
  el perfil al hacer signup (convención Enter Cloud).
- `organizations` (id text PK, name, description, is_demo bool, owner_id uuid → auth.users, created_at).
- `areas` (id text PK, organization_id, name, description).
- `competencies` (id text PK, organization_id, name, description).
- `roles` (id text PK, organization_id, name, description, competency_ids text[]).
- `people` (id text PK, organization_id, name, role_id → roles, area_id → areas, manager_id → people,
  is_active bool, competency_ids text[], task_ids text[]).
- `processes` (id text PK, organization_id, name, description, criticality).
- `org_functions` (id text PK, organization_id, process_id → processes, name, description, criticality)
  — nombre `org_functions` para evitar choque conceptual con funciones SQL; el frontend sigue usando
  `db.functions`.
- `tasks` (id text PK, organization_id, function_id → org_functions, area_id → areas, name, description,
  criticality, is_documented bool, system_name, required_competency_ids text[]).

**RLS:** función security-definer `user_org_ids()` → ids de organizaciones con `owner_id = auth.uid()`.
Políticas: `organizations` → `owner_id = auth.uid()`; tablas hijas → `organization_id = any(user_org_ids())`;
`profiles` → `id = auth.uid()`.

**Nota clave sobre PK:** los ids del seed son fijos (`org_meridian`, `p_ana`…). Como las PK son globales,
la demo por usuario se crea **re-mapeando todos los ids del seed** (nueva util `remapSeedIds`) para evitar
conflictos entre usuarios. La importación ya genera ids frescos con `uid()`.

**Auth:** `supabase_configure_auth` — habilitar signup por email con auto-confirmación (para no depender
de verificar email en pruebas).

**Verificación post-migración:** `supabase_get_table_schema` sobre cada tabla nueva confirmando RLS
habilitada y políticas listadas (chequeo obligatorio de la guía Enter Cloud).

---

## 2. Modelo y seed (frontend)

- `src/types/index.ts`: nueva interfaz `Area`; `Db.areas: Area[]`; `CollectionKey` += `"areas"`;
  `Person.managerId?: string; areaId?: string`; `Task.areaId?: string`; `Organization.isDemo?: boolean`.
- `src/data/seed.ts`: `seedDb.areas = []`; `SEED_ORG.isDemo = true`; nueva util
  `remapSeedIds(seedDb): Db` que reasigna todos los ids y referencias (org, procesos, funciones,
  tareas, roles, personas, competencias) preservando nombres/relaciones.
- `src/integrations/supabase/client.ts` y `types.ts` **no se tocan** (los reescribe el framework tras
  la migración; las queries se tipan contra el `Database` regenerado).

---

## 3. Store: multi-organización + backend (`src/store/OraContext.tsx`)

Refactor manteniendo el API actual **sincrónico** para que los formularios existentes no cambien:

- **Sesión:** `supabase.auth.onAuthStateChange` registrado **antes** de `getSession` (regla auth.md);
  estado `user`, `session`, `isLoading`. Sin callbacks async en el listener; llamadas a `supabase`
  dentro del callback diferidas con `setTimeout(…, 0)`.
- **Estado:** `organizations` (resumen `{id, name, isDemo}` del usuario), `activeOrganizationId`
  (persistido en `localStorage` clave `ora-active-org`), y el `Db` completo de la org activa en memoria.
- **Demo por usuario:** al cargar sesión, si el usuario no tiene organizaciones → `addOrganization(remapSeedIds(seedDb))`.
- **Mutaciones (API existente, sin cambios para los llamadores):** `setOrganization`, `upsert`,
  `remove`, `resetToSeed` aplican en memoria y persisten en backend mediante **cola de escrituras
  encadenada** (preserva orden; toast de error si falla).
- **Nuevas acciones:** `addOrganization(db)` (inserta org + filas en orden de FKs y activa),
  `setActiveOrganization(id)` (carga filas de la org), `removeOrganization(id)` (rechaza `isDemo`),
  `signOut`.
- **`resetToSeed`:** borra la org demo del usuario (cascade) y la recrea desde `remapSeedIds(seedDb)`;
  si la org activa no es la demo no hace nada.
- Nuevo módulo `src/integrations/ora/api.ts`: mapeo colección↔tabla, serialización (inyecta
  `organization_id`), CRUD por fila, load de org completa, y orden de insert para `addOrganization`
  (procesos → funciones → tareas → áreas → competencias → roles → personas con `manager_id` nulo y
  segundo pase de update para las jerarquías).

---

## 4. Auth UI

- `src/components/auth/AuthGate.tsx`: mientras restaura sesión → loader; sin sesión → `LoginPage`;
  con sesión → la app (envuelve el router en `src/App.tsx`).
- `src/components/auth/LoginPage.tsx`: email + contraseña con tabs login/signup;
  `signUp` con `emailRedirectTo: ${window.location.origin}/`; `signInWithPassword`.
- `AppShell`: dropdown de usuario (email) con "Cerrar sesión".

---

## 5. Importación Excel/CSV (nuevo)

- **Dependencia:** agregar `xlsx` (parsea xlsx y csv).
- `src/lib/importer/types.ts`: campos ORA mapeables (`persona`, `area`, `responsable`, `rol`,
  `proceso`, `funcion`, `tarea`, `competencia`, `documentada`, `activo`, `criticidad`);
  `ColumnMapping`; `ParsedFile`; `ValidationSummary`; `ImportIssue`.
- `src/lib/importer/parseFile.ts`: lee el archivo (ArrayBuffer → `XLSX.read`), primera hoja,
  header row → `{ columns, rows }`.
- `src/lib/importer/mapping.ts`: `suggestMapping(columns)` con coincidencia por palabras clave
  es/en (ej. "empleado|persona|nombre"→persona, "sector|área|departamento"→area,
  "responsable|superior|manager|jefe"→responsable, "puesto|rol|cargo"→rol…) + mapeo manual editable.
- `src/lib/importer/validate.ts`: dado rows+mapeo → resumen con: cantidad de registros, personas
  detectadas, áreas, roles/puestos, relaciones jerárquicas (personas con responsable), registros
  incompletos (fila sin nombre, o persona sin ningún atributo), posibles duplicados (mismo nombre
  normalizado en varias filas), y columnas de origen sin mapear / valores no utilizables.
- `src/lib/importer/buildOrganization.ts`: datos normalizados + `{name, description}` → `Db` completo
  (ids con `uid()`); procesos/funciones default `important`, tareas default `standard` salvo columna
  `criticidad` mapeada; personas → `taskIds` desde la columna tareas de cada fila.
- `src/pages/ImportOrganizationPage.tsx` (wizard 4 pasos, ruta `/import` lazy en `router.tsx`):
  1. nombre + descripción + archivo; 2. mapeo de columnas (select por campo ORA, sugerencia automática);
  3. validación (resumen + issues, botón "volver al mapeo" para corregir); 4. confirmar →
  `addOrganization(db)` → navega al dashboard (la org queda activa y usa todo el análisis existente).

---

## 6. UI de organización activa

- `src/components/layout/AppShell.tsx`: **switcher de organizaciones** en el header del sidebar
  (dropdown con las orgs del usuario + "Incorporar organización" → `/import`).
- `src/pages/OrganizationPage.tsx`: listado de organizaciones con selector activo, botón
  "Incorporar organización", eliminar org no-demo (con diálogo de confirmación reutilizando
  `ConfirmDeleteDialog`), y conteo de áreas en "Model in numbers".
- `src/pages/Dashboard.tsx`: botón "Reset demo data" visible **solo cuando la org activa es la demo**
  (garantiza que nunca toca datos reales).
- `src/pages/PeoplePage.tsx` + `src/components/entities/PersonFormDialog.tsx`: columnas/campos
  "Área" y "Responsable" (select de personas, sin auto-referencia).
- `src/components/entities/TaskFormDialog.tsx`: campo "Área" (para no perder `areaId` al editar
  tareas importadas).

---

## Archivos críticos

| Archivo | Acción |
|---|---|
| Migración Enter Cloud (`supabase_migration`) | crear 9 tablas + RLS + trigger profiles + `user_org_ids()` |
| `supabase_configure_auth` | signup email auto-confirm |
| `src/types/index.ts`, `src/data/seed.ts` | tipos (Area, managerId, areaId, isDemo) + `remapSeedIds` |
| `src/store/OraContext.tsx` | refactor multi-org + sesión + persistencia backend |
| `src/integrations/ora/api.ts` | nuevo: capa CRUD ↔ tablas |
| `src/components/auth/{AuthGate,LoginPage}.tsx` | nuevos |
| `src/lib/importer/*` (5 archivos) | nuevos |
| `src/pages/ImportOrganizationPage.tsx` + `src/components/import/*` | nuevos |
| `src/router.tsx`, `src/App.tsx` | rutas `/login`, `/import`, AuthGate |
| `src/components/layout/AppShell.tsx`, `src/pages/OrganizationPage.tsx`, `src/pages/Dashboard.tsx`, `src/pages/PeoplePage.tsx`, `src/components/entities/{PersonFormDialog,TaskFormDialog}.tsx` | ajustes UI |
| `package.json` | agregar `xlsx` |

Reutilizados: `uid()` (`src/lib/id.ts`), `cloneDb` (`src/data/seed.ts`), `ConfirmDeleteDialog`,
`PageHeader`, `MultiSelect`, `Field`, componentes shadcn existentes, `useOra()` (mismo API para
formularios), funciones de análisis (`src/lib/analysis.ts`) sin cambios.

---

## Implementation checklist

- [ ] Migración única: crear `profiles`, `organizations`, `areas`, `competencies`, `roles`, `people`,
      `processes`, `org_functions`, `tasks` + trigger `handle_new_user` + `user_org_ids()` + RLS en cada
      tabla con políticas por usuario.
- [ ] Verificar con `supabase_get_table_schema` que RLS está habilitada y las políticas existen en cada
      tabla nueva; corregir en el mismo turno si falta.
- [ ] `supabase_configure_auth`: email signup habilitado con auto-confirmación.
- [ ] `src/types/index.ts`: `Area`, `Db.areas`, `CollectionKey`+`areas`, `Person.managerId`/`areaId`,
      `Task.areaId`, `Organization.isDemo`.
- [ ] `src/data/seed.ts`: `areas: []`, `isDemo: true`, util `remapSeedIds` (re-mapea todos los ids y
      referencias).
- [ ] `src/integrations/ora/api.ts`: mapeo colección↔tabla, CRUD por fila, load de org, `addOrganization`
      con orden de FKs (manager_id en segundo pase).
- [ ] `src/store/OraContext.tsx`: sesión (listener antes de getSession), multi-org, org activa persistida
      (`ora-active-org`), API sincrónico + cola de escrituras, demo automática en primer login,
      `resetToSeed` solo sobre la demo.
- [ ] Auth UI: `AuthGate` (loader / login / app) + `LoginPage` (login y signup) + signOut en AppShell.
- [ ] Dep `xlsx` agregada; `src/lib/importer/*` implementado (parse, mapping con sugerencia, validate,
      buildOrganization).
- [ ] `ImportOrganizationPage` wizard 4 pasos funcional de punta a punta (archivo → mapeo → validación
      → creación) + ruta `/import` lazy.
- [ ] Switcher de organizaciones en AppShell; OrganizationPage con listado/switch/import/eliminar
      no-demo; Dashboard con "Reset demo data" solo en demo.
- [ ] PeoplePage/PersonFormDialog (Área, Responsable) y TaskFormDialog (Área) actualizados.
- [ ] `pnpm run check` y `pnpm run build` en verde.

## Verification checklist

- [ ] Positivo: al primer login se crea la org demo (Meridian Group) y el dashboard se ve idéntico a la
      demo actual; cambiar nombre/descripción persiste en backend (recargar la página conserva el dato).
- [ ] Positivo: importar un xlsx/csv de ejemplo (columnas `Empleado, Sector, Responsable, Puesto,
      Tareas, Competencias`) crea la org, queda activa y el dashboard/analysis/simulation la procesan.
- [ ] Mapeo: con columnas con nombres distintos a los de ORA la sugerencia acierta o permite corregir
      manualmente antes de importar.
- [ ] Validación: el resumen muestra registros, personas, áreas, roles, relaciones jerárquicas,
      incompletos, duplicados y columnas sin mapear; volver al mapeo y reintentar funciona.
- [ ] Separación: la org demo nunca puede eliminarse; `removeOrganization` sobre una importada la borra
      sin afectar a la demo; "Reset demo data" visible solo en demo y restaura solo Meridian Group.
- [ ] Multi-usuario: con una segunda cuenta, las organizaciones de la primera no son visibles (RLS).
- [ ] Negativo: email inválido o contraseña corta muestran error en login/signup; archivo corrupto o sin
      hoja muestra error claro en el paso 1.
- [ ] Límite: archivo con filas sin nombre → excluidas y contadas como incompletas; duplicados de nombre
      → marcados, no silenciados.
- [ ] Build: `pnpm run build` y `pnpm run check` (lint + tsc) pasan en verde.
