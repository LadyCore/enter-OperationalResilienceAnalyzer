# ORA — Persona multi-área y multi-rol (importación por Legajo + Manager ID)

## Context

El archivo de prueba (`ORA_test_bug_manager_multiarea.xlsx`) expresa que **una persona puede pertenecer a varios sectores** y tener **un rol distinto por sector** (Diego Correa / Legajo 2001 aparece en IT Infrastructure con rol "Director de IT" y en Sales con rol "Ejecutivo de Cuentas"), y que **varias personas pueden depender del mismo responsable** (Lucía, Martín y Valeria → Manager ID 2001 = Diego) o de distintos.

Hoy el modelo es estrictamente "1 fila = 1 persona con 1 sector y 1 rol": `Person.areaId` y `Person.roleId` son únicos, la DB usa `people.area_id`/`people.role_id` (FK únicas), y el validador marca a Diego como "posible duplicado" y al Manager ID 2001 como "ambiguo" (porque el ID se repite en 2 filas).

Decisiones confirmadas por el usuario:
1. **Multi-área real**: una persona puede tener varios sectores (N:M).
2. **Rol por sector**: una persona puede tener varios roles.
3. **Jerarquía por Manager ID (Legajo)**: es la fuente de la relación responsable→persona.
4. **Análisis**: roles múltiples sin vínculo estricto al área; `capableRoles` pasa a ser el **conjunto de roles de las personas capaces** de la tarea (puede devolver varios).

## Modelo objetivo

- `Person` pasa de `roleId`/`areaId` a **`roleIds: string[]`** y **`areaIds: string[]`** (mismo patrón que ya usan `taskIds`/`competencyIds` en `people`).
- El **responsable sigue siendo único por persona** (`managerId`), resuelto desde el archivo por la columna **Manager ID** (referencia a `employeeId` de otra persona), con fallback al nombre del responsable. Si filas de una misma persona declaran responsables distintos, se marca como conflicto a resolver (no se adivina).
- Análisis: `capableRoles(db, taskId)` = unión de `roleIds` de las personas capaces; la métrica "cubierta por un único rol" pasa a "un único rol en el conjunto de roles de quienes la cubren".

## Migración DB (única)

Tabla `people`:
- Agregar `area_ids text[] not null default '{}'` y `role_ids text[] not null default '{}'`.
- Backfill desde columnas actuales: `area_ids = array[area_id]` cuando `area_id` no es null (idem `role_ids`).
- **Conservar** `area_id`/`role_id` (legacy): el código nuevo lee/escribe los arrays; no se dropean FKs para no romper datos existentes ni el seed. Verificar RLS intacto con `supabase_get_table_schema`.

## Frontend — cambios por archivo

### Modelo y serialización
- `src/types/index.ts`: `Person { roleIds: string[]; areaIds: string[] }` (remplaza `roleId`/`areaId`).
- `src/integrations/ora/api.ts`: `payloadFor("people")` escribe `role_ids`/`area_ids` (arrays) y deja `role_id`/`area_id` como primer elemento o null (compat); `toPerson` lee arrays con fallback a los legacy; `toTask` intacto (`tasks.area_id` es del área de la tarea, no de la persona).
- RPC `bootstrap_demo_organization` y el seed (`src/data/seed.ts`, remap): enviar `role_ids`/`area_ids` arrays.
- `src/components/common/MultiSelect.tsx`: ya existe y se reutiliza.

### Análisis (sin cambiar fórmulas de cobertura)
- `src/lib/analysis.ts`:
  - `capableRoles` → unión de `roleIds` de `capablePeople`.
  - `taskDependency` → `roleIds` unión; el aviso "single role" solo si el conjunto tiene tamaño 1.
  - `processOperationalWeight` (áreas del proceso) → usar `flatMap(p => p.areaIds)`.
  - Revisar todos los usos de `p.roleId`/`p.areaId` (incluye concentración de roles en flags/dashboard) para pasar a conjuntos.
- `src/lib/simulation.ts`: sin cambio semántico (opera sobre `capablePeople`/`holdersOf`); verificar que no lea `p.roleId`/`p.areaId` directamente (grep indica que no).

### Importación (1 persona = 1 Legajo, multi-fila)
- `src/lib/importer/types.ts`: `NormalizedRow` ya tiene `area`/`rol` por fila; se agrega semántica de **agrupación**: personas identificadas por `employeeId` (o nombre si no hay ID).
- `src/lib/importer/validate.ts`:
  - Agrupar filas por identidad (`employeeId`; si falta, nombre normalizado). Cada persona acumula **áreas y roles únicos** por fila y la **unión** de tareas/competencias.
  - `people` del resumen = personas únicas; `possibleDuplicates` solo cuando **dos filas comparten identidad pero con rol/área idénticos** (caso a revisar) o cuando no hay ID y el nombre se repite con contenido distinto (sigue siendo warning revisable, nunca se descarta).
  - Resolución de manager: primero por **Manager ID → employeeId único** (sin ambigüedad tras agrupar); si no hay ID, por nombre único; si el ID no existe o el nombre es ambiguo → error bloqueante a resolver (comportamiento actual).
  - Si filas de la misma persona declaran **responsables distintos** → marcarlo como conflicto (warning/error) para revisión, no adivinar.
- `src/lib/importer/buildOrganization.ts`: construir una persona por identidad agrupada con `roleIds`/`areaIds`; la creación de áreas/roles/procesos/funciones/tareas/competencias se mantiene igual (dedupe por nombre). Mantener la resolución de `managerId` a partir de la persona correcta (Diego único → 2001 deja de ser ambiguo).

### UI
- `src/pages/PeoplePage.tsx`: mostrar **lista de roles** y **lista de áreas** (badges) en la tabla; conteo de roles por tarjeta usa `roleIds.includes`.
- `src/components/entities/PersonFormDialog.tsx`: selección **múltiple** de roles y áreas con `MultiSelect` (mantiene manager único). Guardado escribe arrays.
- `src/pages/ImportOrganizationPage.tsx` / `ValidationReport.tsx`: textos y resumen acordes (people = personas únicas; hint de agrupación por Legajo); sin tocar el wizard de pasos.
- Copy del resumen de confirmación: si el archivo trae "Personas = N filas" pasa a personas únicas.

## Archivos a modificar
- `supabase` (migración) + regeneración de `types.ts` (no editarla a mano).
- `src/types/index.ts`
- `src/integrations/ora/api.ts` (payload/toperson de people)
- `src/data/seed.ts` + RPC demo si aplica
- `src/lib/analysis.ts`
- `src/lib/importer/types.ts`, `validate.ts`, `buildOrganization.ts`
- `src/pages/PeoplePage.tsx`, `src/components/entities/PersonFormDialog.tsx`
- Componentes de validación/confirmación del import si muestran contadores
- Tests: fixtures de `analysis.test.ts`/`simulation.test.ts` (roleId→roleIds), y **nuevo test** de importación multi-área/multi-rol con el fixture del archivo real.

## Implementation checklist
- [ ] Migración `people`: columnas `area_ids`, `role_ids` + backfill; RLS intacta (verificar con `supabase_get_table_schema`).
- [ ] `types/index.ts`: `Person.roleIds[]`, `Person.areaIds[]`.
- [ ] `api.ts`: serialización/lectura de `role_ids`/`area_ids` (con fallback legacy) en people; seed y RPC demo con arrays.
- [ ] `analysis.ts`: `capableRoles` y todos los usos de `p.roleId`/`p.areaId` pasan a conjuntos; métricas existentes sin otro cambio.
- [ ] `validate.ts`: agrupación por identidad (employeeId → nombre), acumulación de áreas/roles/tareas/competencias, resolución de manager por Manager ID, manejo de responsables distintos por persona.
- [ ] `buildOrganization.ts`: personas únicas por identidad con arrays de roles/áreas.
- [ ] `PeoplePage` + `PersonFormDialog`: visualización/edición multi-rol y multi-área.
- [ ] Resumen/validación de import: contadores por persona única y textos.
- [ ] Tests actualizados + test con el fixture del archivo (Diego 2001 en 2 sectores; 3 personas con manager 2001 → importa sin duplicados ni ambigüedad).

## Verification checklist
- [ ] `pnpm run check`, `pnpm test`, `pnpm run build` pasan.
- [ ] Importar `ORA_test_bug_manager_multiarea.xlsx`: **0 duplicados**, **0 managers ambiguos**, personas = únicas (5), áreas = 3, roles = 5, y jerarquía: Lucía/Martín/Valeria → Diego (por ID 2001).
- [ ] Diego queda como **1 sola persona** con `areaIds` = [IT Infrastructure, Sales] y `roleIds` = [Director de IT, Ejecutivo de Cuentas], tareas/competencias = unión.
- [ ] Análisis/dashboard/simulación siguen mostrando los mismos tipos de métricas (con roles múltiples, "single role" solo si el conjunto de roles capaces tiene tamaño 1).
- [ ] Editar persona en People: permite varios roles y áreas y persiste arrays en DB (re-carga correcta).
- [ ] Personas existentes (demo Meridian, orgs previas) siguen cargando: backfill de arrays = valor legacy.
- [ ] Sin regresión de flujo DEMO/licencias/feedback/auth.
