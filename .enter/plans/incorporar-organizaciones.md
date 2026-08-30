# Reactivar el análisis de criticidad de ORA (crítica derivada)

## Context

Hoy la criticidad es un campo estático por tarea (`Task.criticality`) que solo se
rellena si el archivo de importación mapea la columna `Criticidad`. Cuando ese valor
no llega, todas las tareas quedan en `standard` y toda la capa que depende de la
criticidad se apaga: `Processes: 0 critical`, `Tasks: 0 critical`, bus factor 0,
competencias concentradas 0, gaps de documentación 0, cobertura crítica 0%.

El usuario confirmó el modelo deseado: **puntaje combinado** — herencia estructural
(proceso/función) + un factor adicional de cobertura/dependencia, manteniendo la
distinción crítica ≠ cobertura (una tarea no es crítica solo por tener 1 persona
capaz). La criticidad debe ser **resultado del análisis de ORA**, reproducible y
explicable, sin introducir columnas nuevas en la importación. El caso de prueba
obligatorio se materializa como **fixture automatizado + test unitario (vitest)**.

## Modelo de criticidad derivada (núcleo)

Nuevas funciones puras en `src/lib/analysis.ts` (reusando `capablePeople`,
`capableRoles`, `holdersOf`, `taskDependency` existentes):

- `criticalityRank(c)`: `standard=1, important=2, critical=3`; `rankToCriticality(r)`.
- `deriveTaskCriticality(db, task): { level: Criticality; reasons: string[] }`:
  1. `structural = max(rank(process.criticality), rank(funct.criticality), rank(task.criticality))`
     (función padre vía `task.functionId`; proceso padre vía `fn.processId`; si falta, rank 1).
  2. `coverageFactor = +1` cuando `capablePeople(db, task.id).length <= 1` (sin cobertura o
     persona única), si no `+0`.
  3. `score = min(structural + coverageFactor, 3)` → nivel final.
  4. `reasons`: qué señal(s) aportaron ("Pertenece al proceso crítico X", "Pertenece a la
     función crítica Y", "Declarada crítica en el registro", "Su cobertura depende de una
     sola persona (Z)" / "Nadie activo puede realizarla").
- `criticalTasks(db): Task[]` — tareas con nivel derivado `critical`.
- `deriveProcessCriticality(db, process): Criticality` — `max(declarada, rank derivado de
  sus tareas)`; un proceso que contiene tareas críticas es esencial. Alimenta
  `metrics.criticalProcesses` y "procesos críticos afectados" en ausencias.
- Reemplazar **todas** las ocurrencias de `t.criticality === "critical"` del análisis,
  simulación y páginas por el nivel derivado.

Invariantes del modelo (se verifican con test):
- Una tarea `standard` con persona única queda `important`, **nunca** crítica solo por
  cobertura (requisito 1).
- Una tarea en proceso/función `important` con 0 o 1 persona capaz queda **crítica**
  (2 + 1 = 3): "tareas cuya ausencia genera dependencia operacional relevante".
- La dimensión cobertura/dependencia (`taskDependency`: 0=none, 1=high, 2=limited,
  3+=adequate) permanece intacta y es la que muestra el badge de dependencia.

## Cambios por requisito

1. **Criticidad ≠ cobertura** — cumplido por el modelo de puntaje (arriba). Badge de
   criticidad y badge de dependencia siguen siendo columnas/indicadores separados.
2. **Criterios reproducibles** — el modelo es una fórmula fija con razones visibles;
   sin nombres mágicos de personas. La columna `Criticidad` existente es solo una señal
   `declared`; no se agrega ninguna columna de importación.
3. **Bus factor** — `computePersonConcentration(db, threshold=3)` ahora calcula sobre
   tareas críticas **derivadas** y añade `exclusiveCriticalTasks` (tareas críticas donde
   esta persona es la única capaz) y `level: "high" | "medium"` (high si
   `exclusiveCriticalTasks >= 1` o `count >= 5`; si no medium). Copy según principio 10.
4. **Concentración de competencias** — `computeCompetencyConcentration`: competencias
   requeridas por tareas críticas derivadas con `holderCount <= 2`; `level` (1 holder →
   high, 2 → medium). `metrics.concentratedCompetencies` cuenta `holderCount <= 2`.
5. **Role concentration** — lógica existente (tarea crítica con ≥1 capaz y exactamente 1
   rol capaz) ahora sobre criticidad derivada; copy aclara "cubierta por un único rol".
6. **Documentation gaps** — crítica + sin documentar (derivada). Lógica existente.
7. **Critical task coverage** — fórmula existente (`>=2 capaces / total críticas`). Cuando
   `criticalTasks === 0`, el card muestra 0% **y** la nota explícita "No critical tasks
   detected" para diferenciarlo de "críticas con cobertura nula".
8. **Ausencia** — `simulateAbsence` extiende el resultado con:
   `affectedCriticalTaskIds`, `uncoveredCriticalTaskIds` (críticas 1→0),
   `reducedToSingleCriticalTaskIds` (críticas 2+→1), `affectedCriticalProcessIds`,
   `singleHolderCriticalCompetencyIds` (competencias críticas que quedan con 1 solo
   holder), `busFactorAtRisk` y `criticalTasksLosingBackup`; más sus campos en `summary`.
   `SimulationPanel` muestra un bloque "Critical impact" y distingue claramente
   "No coverage (1 → 0)" de "Now single-person (2+ → 1)".
9. **Caso de prueba** — fixture deliberado + test (abajo).
10. **Principio** — copy reescrito en flags, tarjetas y badges: se habla de "capacidad /
    tarea con dependencia operacional elevada por concentrarse en pocas personas", nunca
    "esta persona es crítica". Ejemplos: título de flag
    `Capability for N critical tasks is concentrated in one person (X)`; título de
    single-person `Task "X" has single-person coverage`.

## Archivos a modificar

- `src/lib/analysis.ts` — núcleo: `deriveTaskCriticality`, `criticalTasks`,
  `deriveProcessCriticality`, `computePersonConcentration` (+level/exclusive),
  `computeCompetencyConcentration` (+level, ≤2), `computeDashboardMetrics` (derivadas,
  `criticalProcesses` derivado), `detectRiskFlags` (derivadas + copy).
- `src/lib/simulation.ts` — resultado extendido (requisito 8).
- `src/components/entities/SimulationPanel.tsx` — bloque "Critical impact", badges 1→0/2→1.
- `src/components/entities/TaskDependencyTable.tsx` — mostrar `deriveTaskCriticality`
  (badge y razones en la fila expandida, junto a las razones de dependencia).
- `src/pages/Dashboard.tsx` — nota "No critical tasks detected" en el card de cobertura crítica.
- `src/pages/AnalysisPage.tsx` — misma nota + card corto de metodología de criticidad.
- `src/pages/PeoplePage.tsx` — conteo de tareas críticas y badge bus factor con criticidad derivada.
- `src/pages/CompetenciesPage.tsx` — `requiredByCritical` con derivada; badge concentrado ≤2.
- `package.json` — añadir `vitest` (devDependency) y script `"test": "vitest run"`.
- `src/lib/analysis.test.ts` — nuevo: fixture + assertions (requisito 9).

No se toca la persistencia (`api.ts`/tipos de tabla), la importación ni el modelo de datos;
el campo `task.criticality` se conserva como señal `declared` (editable en formularios).

## Fixture del test (requisito 9)

Db deliberada (ids `uid`-libres, fijos) con:
- Procesos: `p_core` (critical, declarado) y `p_support` (standard).
- Funciones: `f_payroll` (critical), `f_backup` (important), `f_office` (standard).
- Tareas críticas derivadas: `t_payrun` (2 capaces), `t_taxtax` (2 capaces, **sin
  documentar**), `t_inc` (3 capaces), `t_restore` (3 capaces), `t_bak` (important +
  1 solo capaz → crítica por puntaje) y estándares: `t_supplies`, `t_rec`.
- Personas: `p1` (4 críticas → bus factor high), `p4` (3 críticas → bus factor),
  `p2` (solo capaz de `t_bak` → caso 1→0), `p3`, `p5`.
- Competencias: `c_tax` (1 solo holder, requerida por `t_taxtax` → high), `c_dr`,
  `c_payroll` (2 holders → medium), `c_facilities` (solo tareas estándar → no aplica).

## Implementation checklist

- [ ] `src/lib/analysis.ts`: `criticalityRank`, `rankToCriticality`, `deriveTaskCriticality`, `criticalTasks`, `deriveProcessCriticality`.
- [ ] `src/lib/analysis.ts`: `taskDependency` usa criticidad derivada en sus razones.
- [ ] `src/lib/analysis.ts`: `computePersonConcentration` con `level` y `exclusiveCriticalTasks`; `computeCompetencyConcentration` con `level` y filtro `holderCount <= 2`.
- [ ] `src/lib/analysis.ts`: `computeDashboardMetrics` calcula todos los indicadores con criticidad derivada (`criticalProcesses`, `criticalTasks`, `singlePersonTasks`, `docGapTasks`, `concentratedCompetencies`, `criticalCoverageRatio`, `busFactorPeople`, `roleConcentratedTasks`).
- [ ] `src/lib/analysis.ts`: `detectRiskFlags` con derivadas y copy según principio 10 (nunca "persona crítica").
- [ ] `src/lib/simulation.ts`: campos críticos nuevos + `summary` (requisito 8).
- [ ] `src/components/entities/SimulationPanel.tsx`: bloque "Critical impact" con 1→0 vs 2→1 y bus-factor.
- [ ] `src/components/entities/TaskDependencyTable.tsx`: badge y razones con `deriveTaskCriticality`.
- [ ] `src/pages/Dashboard.tsx` y `src/pages/AnalysisPage.tsx`: nota "No critical tasks detected" cuando `criticalTasks === 0`.
- [ ] `src/pages/PeoplePage.tsx` y `src/pages/CompetenciesPage.tsx`: criticidad derivada.
- [ ] `package.json`: añadir `vitest` y script `test`.
- [ ] `src/lib/analysis.test.ts`: fixture + assertions de requisito 9.

## Verification checklist

- [ ] `pnpm test` pasa: `criticalTasks > 0`, `busFactorPeople >= 1` (p1 con 4 críticas), `concentratedCompetencies >= 1` (`c_tax` 1 holder), `docGapTasks >= 1` (`t_taxtax`), `roleConcentratedTasks >= 1` (`t_bak` 1 rol), `singlePersonTasks >= 1` (`t_bak`), `criticalCoverageRatio` entre 0 y 1 (5 críticas, 4 con ≥2 capaces = 80%).
- [ ] `pnpm test` verifica el caso de ausencia: `p2` deja `t_bak` **1→0** (`uncoveredCriticalTaskIds`); `p1` deja `t_payrun`/`t_taxtax` **2→1** (`reducedToSingleCriticalTaskIds`) — ambos casos distinguidos.
- [ ] `pnpm run check` (lint + `tsc --noEmit`) pasa.
- [ ] `pnpm run build` pasa.
- [ ] Manual: demo Meridian y org importada con el Excel `ORA_prueba_carga_500` muestran indicadores ≠ 0; card de cobertura crítica muestra la nota cuando no hay críticas; el detalle de tareas explica la criticidad derivada.
