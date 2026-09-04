# Escenario de simulación multi-persona + Cobertura por vacaciones + Guardia pasiva en ORA

## Context

ORA modela la resiliencia operacional desde personas cuyas capacidades habituales (`taskIds`,
`competencyIds`) definen la cobertura de cada tarea. Necesita evolucionar en dos ejes:

1. **Simulación multi-persona simultánea** (capacidad general de ORA, no solo vacaciones): hoy
   `simulateAbsence(db, personId, days)` modela una única persona ausente. Se requiere un modelo de
   **escenario** donde varias personas están indisponibles a la vez — vacaciones masivas, bajas
   simultáneas, pérdida simultánea de personas clave, combinación de tipos — y el resultado es el
   **estado conjunto** de la organización tras aplicar todas las indisponibilidades (nunca la suma
   de simulaciones individuales).
2. **Dos conceptos operacionales nuevos**, siempre separados del rol habitual de la persona:
   - **Cobertura temporal por ausencia planificada (vacaciones)**: persona B cubre tareas concretas
     de la persona A solo durante la ausencia de A, con categoría "Vacations". No altera el perfil
     ordinario de B ni la estructura org.
   - **Guardia pasiva (on-call)**: disponibilidad operacional permanente de una persona fuera del
     horario ordinario (H24 o turnos, esquema libre), que cubre un set de tareas. No reemplaza a
     nadie, **no** participa en simulaciones y **no** se agrega a `holdersOf`/`capablePeople` del
     análisis base.

Decisiones confirmadas con la propietaria:
- Entidades nuevas con **tablas/colecciones separadas** (patrón `org_scoped` existente).
- Cobertura por vacaciones = tareas concretas + competencias que mitigan en simulación.
- Guardia = tareas concretas + modalidad/período **texto libre** + competencias.
- Ambas se cargan desde la **planilla** (columnas opcionales) y se administran en **tabs nuevos
  dentro de People**.
- El **seed del demo** incluye ejemplos de ambas.
- Indicadores de guardia pasiva en el **dashboard principal**.
- Simulación: **tipo global en la UI + override por persona**; exposición temporal **por tarea**
  según las ausencias que la afectan.
- Si una persona figura como cobertura pero **también está ausente en el mismo escenario, no puede
  usarse como cobertura**.

## Invariantes (reglas conceptuales)

- `Person.taskIds/competencyIds` = rol habitual. No se tocan para guardias ni coberturas.
- Cobertura de vacaciones **solo** en ausencias `planned` con categoría `Vacation`, evaluada
  considerando **todas** las personas ausentes del escenario a la vez.
- Una persona ausente **no aporta** cobertura ni competencias a otra ausente en ese escenario.
- Las no seleccionadas permanecen disponibles según su perfil ordinario.
- La guardia pasiva nunca es mecanismo de cobertura de vacaciones ni entra en `holdersOf`/capaz
  del análisis base.
- El resultado de un escenario refleja el estado conjunto tras aplicar simultáneamente todas las
  indisponibilidades.

## Modelo de simulación (núcleo nuevo)

`src/lib/simulation.ts` evoluciona:

```ts
export type AbsenceKind = "temporary" | "planned" | "permanent";

export interface ScenarioAbsence {
  personId: string;
  kind: AbsenceKind;
  category?: string;   // planned: "Vacation", "Maternity / parental leave", "Training", …
  days?: number;       // temporary / planned (duración)
  startDate?: string;  // planned
  endDate?: string;    // planned
}

export function simulateScenario(db: Db, absences: ScenarioAbsence[]): ScenarioResult;
```

Cómo se construye el Db simulado (una sola copia para todo el escenario):
1. Todas las personas del escenario quedan `isActive: false`.
2. Se colectan las coberturas de vacaciones aplicables: cobertura `B → A` entra **solo** si la
   ausencia de A es `planned` + categoría `Vacation`, `B.isActive`, **B no está en el escenario**, y
   A está en el escenario.
3. En la copia simulada, a cada B aplicable se le **agregan** los `taskIds`/`competencyIds` de la
   cobertura (capacidad temporal, nunca en el db real).
4. Se corre el diff/impacto **conjunto** (misma lógica actual, generalizada).

`SimulationResult` se generaliza conservando la superficie de métricas que la UI usa hoy:
- `absences: ResolvedAbsence[]` (persona + kind + category + days) en lugar de `person` único.
- Campos agregados intactos: `affectedTaskIds`, `uncoveredTaskIds`, `reducedToSingleTaskIds`,
  `affectedFunctionIds`, `affectedProcessIds`, competencias, critical tasks/processes,
  `singleHolderCriticalCompetencyIds`, `taskChanges`, `summary`.
- Por tarea, se resuelve **qué ausencias la gobiernan** (ausentes que eran capaces de esa tarea
  antes del escenario) para la exposición: `governingAbsencesByTask: Record<taskId, ResolvedAbsence[]>`.
- Mitigación por cobertura: `vacationCoveredTaskIds`, `vacationCoveredCompetencyIds`,
  `appliedCoverages: { covererName: string; coveredName: string; taskNames: string[] }[]`.
- `busFactorAtRisk` se conserva como lista por persona ausente concentradora (puede haber varias).

Compatibilidad: `simulateAbsence(db, personId, days)` pasa a ser un wrapper que construye un
escenario de una persona `temporary` (los tests existentes se migran al nuevo API y a
`buildExposureReport` por escenario, pero el comportamiento esperado no cambia).

## Exposición temporal por tarea (`src/lib/exposure.ts`)

- `buildExposureReport(db, result)` ya no recibe `isPermanent` global: lo deriva por tarea desde
  `governingAbsencesByTask`.
- Por tarea afectada: si alguna ausencia que la gobierna es `permanent` → `sustained`; si no, el
  nivel se calcula con la duración máxima entre sus ausencias gobernantes (short/prolonged/sustained
  con los umbrales actuales de `exposure.ts`).
- Las tareas cubiertas por cobertura de vacaciones quedan sin impacto si la cobertura las sostiene.

## Modelo de datos persistente

### Colecciones nuevas en `Db` (`src/types/index.ts`)

```ts
export interface VacationCoverage {
  id: string;
  coveringPersonId: string;  // B: cubre
  coveredPersonId: string;   // A: dependencia original
  roleId?: string;           // rol de A que cubre (opcional)
  taskIds: string[];         // tareas concretas de A que B puede realizar
  competencyIds: string[];   // competencias habilitantes (mitigan en sim de vacaciones)
}

export interface OnCallAssignment {
  id: string;
  personId: string;
  modality: string;          // texto libre: "H24", "Shifts"…
  period: string;            // texto libre: "Night", "Weekend", "Semana 2"…
  taskIds: string[];         // función/capacidad cubierta = tareas
  competencyIds: string[];
}
```

- `Db` gana `vacationCoverages: VacationCoverage[]` y `onCallAssignments: OnCallAssignment[]`;
  `Entity` y `CollectionKey` se extienden.

### Migración SQL nueva

Patrón de `migration_20260829_233022000` (tablas `org_scoped`):
- `public.vacation_coverages`: `id text pk`, `organization_id` → orgs (cascade),
  `covering_person_id` → people, `covered_person_id` → people, `role_id` → roles (nullable),
  `task_ids text[]`, `competency_ids text[]`, `check (covering_person_id <> covered_person_id)`.
- `public.on_call_assignments`: `id text pk`, `organization_id` → orgs (cascade),
  `person_id` → people, `modality text`, `period text`, `task_ids text[]`, `competency_ids text[]`.
- RLS habilitada + policies `*_org_scoped` (`organization_id = any(user_org_ids())` + `with check`).
- Actualizar `public.bootstrap_demo_organization(p_data jsonb)` para insertar ambas (estilo
  `jsonb_to_recordset` existente), después de people.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/migrations/<nueva>` | Tablas + RLS + bootstrap |
| `src/types/index.ts` | Tipos nuevos + `Db`/`Entity`/`CollectionKey` |
| `src/store/OraContext.tsx` | `EMPTY_DB` con los dos arrays |
| `src/data/seed.ts` | Arrays + ejemplos + `remapSeedIds` |
| `src/integrations/ora/api.ts` | `TableName`, `COLLECTION_TABLE`, `payloadFor`, converters, `loadOrganization`, onda nueva en `insertChildren`, `CHILD_TABLES`, `ensureDemoOrganization` |
| `src/lib/simulation.ts` | Núcleo `simulateScenario` + wrapper `simulateAbsence` |
| `src/lib/exposure.ts` | Exposición por tarea desde el escenario |
| `src/components/entities/SimulationPanel.tsx` | Builder de escenario multi-persona |
| `src/pages/SimulationPage.tsx` | Ajuste de copys |
| `src/lib/oncall.ts` (nuevo) + `oncall.test.ts` | Métricas permanentes de guardia |
| `src/pages/Dashboard.tsx` | Card "On-call (guardia)" solo con datos |
| `src/pages/PeoplePage.tsx` | Tab "Coverage & on-call" |
| `src/components/entities/VacationCoveragePanel.tsx` (nuevo) + diálogo | CRUD coberturas |
| `src/components/entities/OnCallPanel.tsx` (nuevo) + diálogo | CRUD guardias |
| `src/lib/importer/types.ts` | `ImportField`/labels/`NormalizedRow`/summary |
| `src/lib/importer/mapping.ts` | keywords de sugerencia |
| `src/lib/importer/validate.ts` | campos opcionales + duplicados + resoluciones |
| `src/lib/importer/buildOrganization.ts` | Construcción de ambas colecciones |
| `src/lib/importer/downloadTemplate.ts` | Columnas opcionales + instrucciones |
| `public/PLANTILLA DE DATOS.xlsx` | Regenerar |
| `src/components/import/ValidationReport.tsx` | Contadores nuevos |
| `src/pages/ImportOrganizationPage.tsx` | Stats de confirmación |
| `src/components/import/ImportHelpCard.tsx` | Ayuda de campos opcionales |
| Tests | `simulation.test.ts`, `analysis.test.ts`, `exposure.test.ts`, nuevos de escenario/cobertura/on-call/import |

Nota: `src/integrations/supabase/types.ts` es generado — no se edita; el código nuevo usa el patrón
`as never` de `upsertRow`/`ensureDemoOrganization`. Reutilizar `MultiSelect`, `SearchableSelect`,
`Field`, `uid()`, patrones de `PersonFormDialog` y `downloadTemplate`.

## UI del escenario (SimulationPanel)

- Tipo global (Temporary / Planned / Permanent) con su control actual (días / fechas + categoría).
- Carga eficiente de muchas personas: `SearchableSelect` multi-add + chips con el **conjunto
  incluido, visible antes de ejecutar** (nombres, tipo, período de cada fila).
- Cada fila admite **override** del tipo global y sus campos (días / fechas+categoría).
- Categoría "Vacation" disponible en planned; al ejecutar un escenario con vacaciones, si existen
  coberturas aplicables se muestra banner "N coberturas aplicadas" + StatCards de mitigación
  (tareas/competencias cubiertas).
- Resultado: impactos agregados del escenario conjunto (taskChanges before→after, funciones,
  procesos, competencias, critical tasks), lista de ausentes con su tipo, y exposición por tarea.

## Planilla (columnas opcionales; vacías = sin datos, sin errores)

Formato "una fila = una persona", multivalores `;`:
- **Guardia** (fila = persona en guardia): `Guardia pasiva (Sí/No)` · `Modalidad guardia` ·
  `Turno/Período guardia` · `Tareas de guardia` · `Competencias de guardia`.
- **Cobertura** (fila = B que cubre): `Cubre ausencias de (Legajo o nombre de A)` ·
  `Rol que cubre (opcional)` · `Tareas que cubre` · `Competencias de cobertura`.

Validación: fila repetida no es duplicado si difiere en (área, rol, guardia, persona cubierta);
warnings no bloqueantes para tareas de cobertura ajenas a A / modalidad vacía con tareas de guardia
/ referencias inexistentes.

## Seed del demo

Ejemplos en Meridian Group:
- Coberturas: Jorge cubre `t_validate`/`t_quote` (+ `c_pricing`) de Diana; Ana cubre
  `t_backup`/`t_restore` de Bruno.
- Guardias: Carlos (`Shifts`/`Night`, `t_triage`), Ana (`H24`/`H24`, `t_patch`/`t_triage`) para
  poblar tab y dashboard.

## Implementation checklist

- [ ] Migración crea `vacation_coverages` y `on_call_assignments` con FK/arrays/RLS `org_scoped` y
      actualiza `bootstrap_demo_organization`.
- [ ] `types/index.ts`: `VacationCoverage`, `OnCallAssignment`, `Db`, `Entity`, `CollectionKey`.
- [ ] `OraContext.tsx` `EMPTY_DB` incluye ambos arrays.
- [ ] `api.ts`: tablas en `COLLECTION_TABLE`, `payloadFor`, converters, `loadOrganization`,
      onda de inserción post tasks/people, `CHILD_TABLES` primero, `ensureDemoOrganization`.
- [ ] `seed.ts`: arrays poblados + `remapSeedIds` remapea sus ids.
- [ ] `simulation.ts`: `simulateScenario` multi-ausencia simultánea (reglas de exclusión de
      cobertura y de ausentes como coverers), `SimulationResult` generalizado, wrapper
      `simulateAbsence` de compatibilidad.
- [ ] `exposure.ts`: exposición por tarea según `governingAbsencesByTask` (permanent → sustained;
      resto por duración máxima); `buildExposureReport` sin flag global.
- [ ] `SimulationPanel`: builder con tipo global + override por fila + carga multi-persona + vista
      previa del conjunto + activación de cobertura solo en planned/Vacation.
- [ ] UI People: tab "Coverage & on-call" + diálogos CRUD.
- [ ] `oncall.ts` + card en Dashboard solo con datos + test.
- [ ] Importador: campos opcionales de ambas + duplicados extendidos + warnings + contadores +
      plantilla regenerada + ayuda.
- [ ] Tests nuevos (escenario multi, exclusión de coverers ausentes, mitigación, on-call, import
      con columnas vacías/pobladas) y migración de tests existentes al nuevo API.

## Verification checklist

- [ ] `pnpm run build` en verde (tsc + vite) y suite `vitest` en verde.
- [ ] Positivo multi: escenario de 30 vacaciones simultáneas calcula el estado conjunto; una
      cobertura cuyo coverer también está ausente **no** se aplica.
- [ ] Positivo: ausencia única planned + Vacation con cobertura muestra tareas/competencias
      cubiertas; temporary/planned no-vacación/permanent idénticos a antes.
- [ ] Default: org sin guardias ni coberturas importa sin errores ni advertencias; persona repetida
      con distinta (guardia/persona cubierta) no es duplicado.
- [ ] RLS: un usuario autenticado solo ve/edita coberturas y guardias de sus organizaciones.
- [ ] Dashboard: card on-call visible con seed y ausente al borrar guardias.
- [ ] People > Coverage & on-call: crear/editar/borrar persiste tras recargar la org.
- [ ] Exposición por tarea: escenario mixto (29 vacaciones 15d + 1 permanent) marca sustained solo
      las tareas gobernadas por la ausencia permanente.
