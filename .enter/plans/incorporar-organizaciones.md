# ORA — Optimización de carga inicial y de creación de organizaciones

## Context / Síntoma

Al ingresar a ORA el usuario ve mucho tiempo el shell estático "ORA · Loading…" y al
final recién aparece la pantalla de activación de DEMO. Además, crear una organización
grande (p. ej. ~500 personas, ~476 tareas) tarda ~1 minuto.

Objetivo: reducir el tiempo real de las operaciones de arranque y de persistencia. No
cambiar el texto del loading ni el timeout. No tocar auth, email, redirects, reglas de
DEMO/eligibilidad, RLS ni lógica de negocio.

## Diagnóstico (causas reales encontradas)

### Causa 1 — Arranque: el workspace se carga antes de saber qué pantalla mostrar
`OraContext` (listener INITIAL_SESSION/SIGNED_IN) lanza en paralelo `loadWorkspace()` y
`refreshAccess()`. `loadWorkspace()` hace:
`listOrganizations` → si 0 orgs `ensureDemoOrganization` (**crea toda la org demo: 8
inserts**) → `listOrganizations` de nuevo → `loadOrganization` (**8 SELECTs de la org
completa**).
`AppGuard` muestra spinner hasta que `db` esté cargado (`isLoading || (user && !db)`), y
solo después decide la puerta de acceso.
**Consecuencia:** un usuario que va a ver la pantalla de activación DEMO (acceso `none`)
espera igual a que se cree y cargue toda la org demo + datos, que **no necesita en
absoluto**. El flujo correcto es: resolver `access` (1 RPC ligero) → si está bloqueado o
requiere activación mostrar esa pantalla **sin tocar las orgs**; solo si el acceso está
habilitado (owner / licencia / DEMO activa) cargar el workspace.

### Causa 2 — Creación de organización: ~480 updates secuenciales
En `insertChildren` (`src/integrations/ora/api.ts`), tras insertar `people`, se resuelve la
jerarquía con **un `UPDATE` por persona** en un `for…await`:
```
for (const p of db.people) { if (!p.managerId) continue; await supabase…update… }
```
Datos reales: BABEL tiene 500 personas / 480 con manager, MARCO ANTONIO 300/292. Eso son
~480 (o ~292) round-trips secuenciales ≈ el "minuto" observado. Se resuelve en **1 sola
petición**: `upsert` masivo de `{ id, manager_id }` (los manager ya existen como filas tras
el insert inicial, así que la FK no se viola) — y/o agrupando los 7 inserts de hijos en
oleadas paralelas respetando dependencias FK.

### Causa 3 — Duplicación en arranque para cuentas con acceso
`loadWorkspace` re-lista las orgs después de crear la demo (2º `listOrganizations`) y
`ensureDemoOrganization` ya devuelve el `Db` creado (podría usarse directo, evitando
re-listar y recargar). Además `OraContext` dispara el workspace sin esperar el resultado
del gate, trabajo que se desperdicia para usuarios bloqueados/sin acceso.

### Nota (no es la causa de datos)
Parte de la espera del shell estático "ORA · Loading…" puede deberse a descarga/parseo del
bundle y a la máquina del usuario (frío + antivirus), que no se arregla con texto. Lo que
sí se arregla en el flujo de datos: que React monte y llegue a la pantalla correcta sin
encadenar creación + carga de orgs antes de tiempo. No se toca index.html ni su hint.

## Optimizaciones propuestas (sin cambiar reglas de negocio)

1. **Resolver acceso primero, cargar workspace solo si hace falta.**
   En `OraContext`, al restaurar/iniciar sesión: primero `refreshAccess()` (1 RPC
   `get_my_access`). Un efecto vigila `[user, access]`:
   - acceso `none` / `demo_expired` / `subscription_expired` → no se carga ni crea nada; se
     renderiza activación/bloqueo.
   - acceso habilitado (`owner`, `perpetual_active`, `subscription_active`, `demo_active`,
     `demo_expiring`) y `db === null` → recién ahí `loadWorkspace(user.id)` (con guard de
     una sola ejecución por sesión mediante ref).
   - Tras activar el DEMO, `refreshAccess()` devuelve `demo_active` y el mismo efecto carga
     el workspace (crea la org demo si el usuario no tiene ninguna, como hoy).
   El flag `isLoading` pasa a significar "restaurando sesión/acceso"; se libera al resolver
   acceso (no al terminar de cargar orgs).

2. **`AppGuard` decide por estado de acceso, no por `db`.**
   - sesión restaurándose → spinner inicial;
   - sin usuario → `LoginPage`;
   - sin acceso aún → spinner "Checking access…" (o reintento si `accessFailed`);
   - acceso `none`/bloqueado → `AccessGate` (activación/bloqueo) **sin esperar `db`**;
   - acceso habilitado → esperar `db` ("Loading your organizations…") y renderizar
     `AppShell`.
   Reutiliza `gateState(access)` de `src/lib/access/status.ts`.

3. **Creación de organizaciones en lote** (`insertChildren`):
   - insertar los 7 conjuntos de hijos en oleadas paralelas respetando FK:
     W1 paralelo: `processes`, `areas`, `competencies`, `roles`
     W2 paralelo: `functions` (FK process) y `people` (FK role/area)
     W3: `tasks` (FK function/area)
   - resolver jerarquía con **1 `upsert` masivo** de `{ id, manager_id }` (con
     `onConflict: "id"`) en lugar del bucle por persona.
   Resultado: de ~8 peticiones secuenciales + ~480 updates a ~4 peticiones en total.
   Aplica también a `resetDemoOrganization` y `ensureDemoOrganization` (comparten
   `insertChildren`).

4. **Eliminar la doble lista en arranque**: en `loadWorkspace`, si
   `ensureDemoOrganization` devuelve un `Db`, usar ese objeto directamente (orgs = 1
   elemento, `db` = el creado) sin segundo `listOrganizations` ni `loadOrganization`.

## Archivos a modificar
- `src/store/OraContext.tsx` — arranque acceso-primero, efecto de carga del workspace
  condicionado al gate, guard por sesión, ajuste semántica de `isLoading`.
- `src/components/auth/AppGuard.tsx` — render por estado de acceso (activación/bloqueo sin
  esperar `db`; `AppShell` solo con acceso habilitado y `db` cargado).
- `src/integrations/ora/api.ts` — `insertChildren` por oleadas + `upsert` masivo de
  managers; `loadWorkspace` sin segunda lista (en OraContext); `ensureDemoOrganization`
  reutilizado.
- `src/pages/LoginPage.tsx` — copia menor: la org demo se crea tras activar el DEMO (no en
  el signup). Sin cambiar ningún flujo.

No se tocan: `index.html`, auth/email/redirect, tablas, RLS, funciones de acceso, reglas
DEMO (15 días / DNI-CUIT / 12 meses), ni la lógica de análisis/importación.

## Implementation checklist
- [ ] `OraContext`: el listener de sesión ya no llama `loadWorkspace` directo; solo
  `refreshAccess()` al restaurar/ingresar.
- [ ] `OraContext`: efecto que inicia `loadWorkspace(user.id)` únicamente cuando
  `access` está habilitado (`gateState(access) === "unlocked"`), `db === null` y no se
  ejecutó ya en esta sesión (ref `workspaceStartedRef`, reseteada en sign-out).
- [ ] `OraContext`: `isLoading` se libera al resolver el acceso (no al cargar orgs); sin
  sesión se libera como hoy.
- [ ] `OraContext`: `loadWorkspace` usa el `Db` devuelto por `ensureDemoOrganization`
  (orgs = [resumen], sin 2º `listOrganizations` ni `loadOrganization` de lo ya creado).
- [ ] `AppGuard`: reordenado — sesión → login → acceso (`none`/bloqueado renderizan
  `AccessGate` sin `db`; habilitado espera `db` y renderiza `AppShell`).
- [ ] `api.ts`: `insertChildren` en oleadas paralelas (processes/areas/competencies/roles →
  functions/people → tasks), manteniendo FK y lógica.
- [ ] `api.ts`: jerarquía de managers en un único `upsert` masivo `{ id, manager_id }`
  (`onConflict: "id"`), reemplazando el bucle por persona.
- [ ] `LoginPage`: ajuste de copia (org demo tras activar DEMO). Sin cambios de lógica.

## Verification checklist
- [ ] `pnpm run check` pasa (lint + `tsc --noEmit`).
- [ ] `pnpm test` pasa (suite actual intacta: análisis/simulación/access).
- [ ] `pnpm run build` pasa.
- [ ] Sin acceso (usuario `none`): el login llega directo a la pantalla de activación DEMO
  **sin** crear/cargar organizaciones (verificado por ausencia de peticiones a
  `organizations`/tablas antes del render de activación, p. ej. con `read_network_requests`).
- [ ] Usuario con DEMO activa / propietaria: carga el workspace y ve `AppShell` con datos
  (mismo comportamiento que hoy).
- [ ] Activar un DEMO desde la pantalla de activación crea la org demo y entra a la app
  (regresión: sigue funcionando).
- [ ] Crear una organización importada grande (fixture tipo BABEL: 500 personas, 480 con
  manager): termina con pocas peticiones y sin el bucle por persona; jerarquía correcta en
  BD (`manager_id` poblado).
- [ ] `resetDemoOrganization` sigue funcionando (comparte `insertChildren`).
- [ ] No cambió: login, redirección de email, reglas DEMO/DNI-CUIT/12 meses, RLS.
