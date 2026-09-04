# Cobertura por vacaciones + Guardia pasiva en ORA

## Context

ORA modela la resiliencia operacional a partir de **personas** cuyas capacidades habituales
(`taskIds` = tareas que pueden realizar, `competencyIds`) definen la cobertura de cada tarea.
Hoy no existe forma de representar:

1. **Cobertura temporal por ausencia planificada (vacaciones)**: una persona B que puede cubrir
   tareas concretas de la persona A solo mientras A está de vacaciones. No debe alterar el perfil
   ordinario de B ni la estructura organizacional, y debe intervenir **exclusivamente** en
   simulaciones de ausencia planificada con categoría "Vacations".
2. **Guardia pasiva (on-call)**: disponibilidad operacional **permanente** de una persona fuera del
   horario ordinario (H24 o por turnos), que cubre un set de tareas con ciertas competencias. No
   reemplaza a nadie y **no** participa en simulaciones de ausencia; se refleja como indicador de
   capacidad permanente (dashboard principal).

Modelo decidido (confirmado con la propietaria):
- Entidades **nuevas** con **tablas/colecciones separadas** (patrón `org_scoped` ya existente).
- Cobertura: tareas concretas (`taskIds`) + competencias (`competencyIds`) + persona cubierta; en la
  simulación de vacaciones las competencias de cobertura también **mitigan** competencias que
  quedarían sin holders.
- Guardia: cubre **tareas concretas** (`taskIds`), con modalidad y período **en texto libre**
  (para no imponer una estructura mañana/tarde/noche) + competencias habilitantes.
- Ambas entidades se cargan desde la **planilla** (columnas opcionales) y se administran en **tabs
  nuevos dentro de People**.
- El **seed del demo** incluye ejemplos de ambas para poder probar vacaciones + cobertura y guardia
  en Meridian Group de inmediato.

Reglas de separación conceptual (invariantes):
- `Person.taskIds/competencyIds` = rol habitual. **No se tocan** para guardias ni coberturas.
- Cobertura de vacaciones **solo** en simulación planned con tipo "Vacation".
- Guardia **nunca** entra en `capablePeople/holdersOf/taskDependency` (no cambia el análisis base) y
  **nunca** en simulaciones.

## Diseño de datos

### Colecciones nuevas en `Db`

```ts
export interface VacationCoverage {
  id: string;
  coveringPersonId: string;  // B: persona que cubre
  coveredPersonId: string;   // A: dependencia original ausente
  roleId?: string;           // rol de A que B cubre (opcional, referencial)
  taskIds: string[];         // tareas concretas de A que B puede realizar durante la ausencia
  competencyIds: string[];   // competencias que habilitan la cobertura (mitigan en sim de vacaciones)
}

export interface OnCallAssignment {
  id: string;
  personId: string;          // persona en guardia (conserva rol/dependencia habitual)
  modality: string;          // texto libre: "H24", "Shifts", esquema propio…
  period: string;            // texto libre: "Night", "Weekend", "Semana 2"…
  taskIds: string[];         // función/capacidad cubierta = tareas concretas
  competencyIds: string[];   // competencias que habilitan esa función
}
```

### Migración SQL (nueva)

Patrón idéntico a `people_org_scoped`/`tasks_org_scoped` (ver `migration_20260829_233022000`):
- `public.vacation_coverages`: `id text pk`, `organization_id` → orgs (cascade),
  `covering_person_id` → people, `covered_person_id` → people, `role_id` → roles (nullable),
  `task_ids text[]`, `competency_ids text[]`.
  `check (covering_person_id <> covered_person_id)`.
- `public.on_call_assignments`: `id text pk`, `organization_id` → orgs (cascade),
  `person_id` → people, `modality text`, `period text`, `task_ids text[]`, `competency_ids text[]`.
- RLS habilitada + policy `vacation_coverages_org_scoped` / `on_call_assignments_org_scoped`
  (`organization_id = any(user_org_ids())` con su `with check`).
- Actualizar `public.bootstrap_demo_organization(p_data jsonb)`: insertar ambas tablas desde
  `p_data->'vacation_coverages'` / `p_data->'on_call_assignments'` (mismo estilo `jsonb_to_recordset`
  de las tablas existentes), después de people.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/migrations/<nueva>` | Tablas + RLS + bootstrap actualizado |
| `src/types/index.ts` | Interfaces nuevas, `Db` + `Entity` + `CollectionKey` extendidos |
| `src/store/OraContext.tsx` | `EMPTY_DB` con los dos arrays vacíos |
| `src/data/seed.ts` | Arrays en `seedDb` + ejemplos + remapeo de ids en `remapSeedIds` |
| `src/integrations/ora/api.ts` | `TableName`, `COLLECTION_TABLE`, `payloadFor`, converters, `loadOrganization`, onda de inserción nueva, `CHILD_TABLES`, `ensureDemoOrganization` |
| `src/lib/simulation.ts` | Simulación con cobertura de vacaciones (opción, no altera el default) |
| `src/lib/oncall.ts` (nuevo) + `oncall.test.ts` | Métricas permanentes de guardia |
| `src/components/entities/SimulationPanel.tsx` | Activar cobertura solo en Vacation + mitigación |
| `src/pages/PeoplePage.tsx` | Tab "Coverage & on-call" |
| `src/components/entities/VacationCoveragePanel.tsx` (nuevo) + diálogo form | CRUD coberturas |
| `src/components/entities/OnCallPanel.tsx` (nuevo) + diálogo form | CRUD guardias |
| `src/lib/importer/types.ts` | `ImportField` + labels + `NormalizedRow` + summary |
| `src/lib/importer/mapping.ts` | keywords de sugerencia |
| `src/lib/importer/validate.ts` | parseo opcional + duplicados + resoluciones |
| `src/lib/importer/buildOrganization.ts` | Construcción de las dos colecciones |
| `src/lib/importer/downloadTemplate.ts` | Columnas opcionales + instrucciones + ejemplos |
| `public/PLANTILLA DE DATOS.xlsx` | Regenerar con las columnas nuevas |
| `src/components/import/ValidationReport.tsx` | Contadores nuevos |
| `src/pages/ImportOrganizationPage.tsx` | Stats de confirmación (si aplica) |
| `src/components/import/ImportHelpCard.tsx` | Ayuda breve de los campos opcionales |
| `src/lib/simulation.test.ts` (o archivo nuevo) | Tests de cobertura de vacaciones |

### Notas técnicas
- `src/integrations/supabase/types.ts` es **generado** (no se edita): se regenera al aplicar la
  migración. El código nuevo usa el patrón `as never` de `upsertRow`/`ensureDemoOrganization` para
  no depender de que el tipo ya exista en el momento del cambio.
- Reutilizar: `MultiSelect` (`src/components/common/MultiSelect.tsx`), `SearchableSelect`,
  `Field`, `uid()`, patrón de diálogos `PersonFormDialog`, convertidores de `api.ts`,
  resolución por Legajo/nombre de `validate.ts`.

## Planilla (columnas opcionales; vacías = sin datos, sin errores)

Formato "una fila = una persona", multivalores con `;`, persona repetible en varias filas:

- **Guardia pasiva** (fila = la persona en guardia):
  `Guardia pasiva (Sí/No, opcional)` · `Modalidad guardia` · `Turno/Período guardia` ·
  `Tareas de guardia` (nombres de tareas) · `Competencias de guardia`.
- **Cobertura de vacaciones** (fila = la persona B que cubre):
  `Cubre ausencias de (Legajo o nombre de A)` · `Rol que cubre (opcional)` ·
  `Tareas que cubre` (nombres de tareas) · `Competencias de cobertura`.

Validación:
- Una fila repetida de la misma persona **no** es duplicado si difiere en (área, rol, guardia,
  persona cubierta) — extender la tupla de duplicados actual en `validate.ts`.
- Warnings no bloqueantes: tareas de cobertura que no son tareas de A; modalidad/periodo en blanco
  cuando hay tareas de guardia; referencias a personas/tareas/competencias inexistentes.
- Guardia con columnas presentes = 1 `OnCallAssignment`; B cubriendo a varias A = 1
  `VacationCoverage` por fila (referencia resuelta por Legajo o nombre, como manager).

## Simulación de vacaciones con cobertura

`simulateAbsence(db, personId, days)` queda **sin cambios de firma/resultado por defecto**
(temporary / planned no-vacación / permanent igual que hoy). Se agrega:

```ts
export interface VacationCoverageOptions {
  applyCoverage: boolean; // true solo cuando absenceType === "Vacation"
}

export interface SimulationResult {
  // …campos existentes intactos…
  vacationCoveredTaskIds?: string[];      // tareas de A sin cobertura si no hubiera cobertura, y cubiertas gracias a B
  vacationCoveredCompetencyIds?: string[];// competencias de A que dejarían de tener holders sin cobertura
  appliedCoverages?: { covererName: string; taskNames: string[] }[];
}
```

Comportamiento con cobertura: sobre el Db simulado (A inactiva), a cada B con `VacationCoverage`
sobre A y `B.isActive` se le **agregan** (solo en la copia) los `taskIds` y `competencyIds` de la
cobertura; luego corre el diff actual. La mitigación se calcula comparando contra la simulación sin
cobertura. Coberturas de personas inactivas o inexistentes se ignoran silenciosamente.

`SimulationPanel`: en scenario **planned** con absence type **"Vacation"**, si existen coberturas
para la persona ausente, correr con cobertura y mostrar: banner "N coberturas aplicadas" +
StatCards "Tareas cubiertas por cobertura" / "Competencias cubiertas". El resto de escenarios y la
ayuda textual quedan intactos.

## Guardia pasiva en el dashboard

`src/lib/oncall.ts`: `buildOnCallMetrics(db)` → personas con guardia (únicas), asignaciones por
modalidad (H24 vs turnos/otras), tareas cubiertas por guardia (total y críticas), funciones
cubiertas. `Dashboard.tsx` muestra una card "On-call (guardia)" solo cuando hay asignaciones
(`onCallAssignments.length > 0`); sin datos no se muestra nada (no genera warnings ni rompe
diseño).

## Seed del demo (ejemplos)

En `src/data/seed.ts`, sobre Meridian Group:
- Coberturas: p. ej. **Jorge** cubre `t_validate`/`t_quote` (+ `c_pricing`) de **Diana**;
  **Ana** cubre `t_backup`/`t_restore` de **Bruno**.
- Guardias: **Carlos** (IT support) modalidad "Shifts", período "Night", `t_triage`;
  **Ana** (sysadmin) modalidad "H24", período "H24", `t_patch`/`t_triage`; para que el tab y la
  card del dashboard muestren datos de ejemplo.

## Implementation checklist

- [ ] Migración nueva crea `vacation_coverages` y `on_call_assignments` (FK, arrays, RLS
      `org_scoped` + `with check`) y actualiza `bootstrap_demo_organization` para insertarlas.
- [ ] `src/types/index.ts`: tipos `VacationCoverage`, `OnCallAssignment`, campos en `Db`,
      miembros en `Entity` y `CollectionKey`.
- [ ] `OraContext.tsx` `EMPTY_DB` incluye `vacationCoverages: []` y `onCallAssignments: []`.
- [ ] `api.ts`: `TableName`/`COLLECTION_TABLE` con las 2 tablas; `payloadFor` para ambas
      colecciones; converters `toVacationCoverage`/`toOnCallAssignment`; `loadOrganization` las
      consulta en paralelo; `insertChildren` inserta en una onda posterior a tasks/people;
      `CHILD_TABLES` las borra primero; `ensureDemoOrganization` envía los arrays al RPC.
- [ ] `seed.ts`: arrays poblados, ejemplos coherentes, y `remapSeedIds` remapea ids de ambas.
- [ ] `simulation.ts`: opción `applyCoverage` (sin efecto por defecto) + campos nuevos en
      `SimulationResult`; mitigación calculada por diff con la sim sin cobertura.
- [ ] `SimulationPanel`: activa cobertura solo en planned + "Vacation"; muestra banner + statcards
      de mitigación; escenarios restantes sin cambios.
- [ ] UI People: tab "Coverage & on-call" con paneles + diálogos CRUD (reutilizan
      `MultiSelect`/`SearchableSelect`/patrón `PersonFormDialog`); `useOra().upsert/remove` con las
      colecciones nuevas.
- [ ] `oncall.ts` + card en Dashboard (solo con datos) + test de métricas.
- [ ] Importador: campos opcionales en `ImportField`/labels/mapping/validate/build/template;
      detección de duplicados extendida; warnings; contadores en `ValidationReport`.
- [ ] `public/PLANTILLA DE DATOS.xlsx` regenerada con las columnas opcionales y `ImportHelpCard`
      las menciona.
- [ ] Tests unitarios nuevos (simulación con cobertura, métricas on-call, import con columnas
      opcionales vacías/pobladas) y suite existente en verde.

## Verification checklist

- [ ] `pnpm run build` en verde (tsc + vite).
- [ ] Tests existentes (`vitest`) siguen en verde sin cambios de expectativas.
- [ ] Test positivo: simulación planned + "Vacation" con cobertura muestra tareas que quedan
      cubiertas y competencias mitigadas; sim sin cobertura (temporary/permanent/planned no-
      vacación) produce resultados idénticos a antes.
- [ ] Test default: org sin guardias ni coberturas importa sin errores ni advertencias.
- [ ] Test planilla: columnas opcionales pobladas generan las colecciones; persona repetida con
      distinto (guardia/persona cubierta) NO es duplicado.
- [ ] Invariante RLS: como usuario autenticado, un org solo ve/edita sus coberturas y guardias
      (policy `org_scoped`).
- [ ] Dashboard muestra card on-call cuando el seed tiene guardias; desaparece al borrarlas.
- [ ] En People > Coverage & on-call: crear, editar y borrar cobertura/guardia persisten (recarga
      de la org las conserva).
