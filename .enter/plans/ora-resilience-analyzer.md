# ORA — Organizational Resilience Analyzer

## Context

Build **ORA**, a functional business prototype that analyzes **operational dependency and organizational resilience**: it makes hidden concentration of capability (tasks, knowledge, competencies) in too few roles/people visible and measurable. It must **not** evaluate employees, rank personal value, or make HR decisions — analysis is about **capability coverage**, never individual worth. AI is explicitly **out of scope** for v1; all analysis is deterministic and transparent.

User decisions:
- **Storage**: Frontend-only. Typed store + **localStorage** persistence with a fictional **seed dataset**; includes a "Reset demo data" action. No backend, no auth.
- **Sample org**: a generic mid-sized organization with **administrative, IT, operations and support** processes.

The app replaces the starter `Index.tsx` landing page. The existing stack (Vite + React 19 + TS + Tailwind + shadcn + React Router + lucide-react) is reused as-is.

---

## Architecture

- **State**: one React Context + `useReducer` store (`OraProvider`) holding all collections; auto-persists to `localStorage` (`ora-data-v1`); hydrates from seed on first load. `resetToSeed()` action restores it.
- **Derived logic**: pure functions in `src/lib/analysis.ts` and `src/lib/simulation.ts` that take the dataset and return metrics, risk flags, dependency rows, and absence-simulation results. No black-box scoring — every result carries human-readable reasons.
- **Routing** (`src/router.tsx`): single shell layout (`AppShell`) with sidebar navigation around 8 pages.
- **Language**: English, plain strings (not routed through i18next — multi-language not requested).

### Data model (`src/types/index.ts`)

```ts
type Criticality = "critical" | "important" | "standard";

interface Organization { id; name; description }
interface Process        { id; name; description; criticality; organizationId }
interface OrgFunction    { id; name; description; processId; criticality }
interface Task {
  id; name; description; functionId; criticality;
  isDocumented: boolean;
  systemName?: string;            // optional system/resource link
  requiredCompetencyIds: string[];
}
interface Role        { id; name; description; competencyIds: string[] } // role ↔ competencies
interface Person      { id; name; roleId; isActive: boolean; competencyIds: string[]; taskIds: string[] } // person ↔ competencies, person ↔ tasks (capable of)
interface Competency  { id; name; description }
interface Db { organization: Organization; processes; functions; tasks; roles; people; competencies }
```

All `*Id` references are `string` ids. Small `uid()` helper for new entities.

---

## Analysis engine (transparent rules — `src/lib/analysis.ts`)

**Per-task dependency level** (people-coverage only; documentation is a separate flag):

| Capable active people | Level |
|---|---|
| 0 | **No coverage** (red) |
| 1 | **High** (orange/red) |
| 2 | **Limited** (amber) |
| 3+ | **Adequate** (green) |

`taskDependency(db, taskId)` returns `{ level, capableCount, rolesCount, reasons: string[] }`. `reasons` explains **why** (e.g. "Only 1 person can perform this task", "Required competency 'Server Administration' has a single holder", "Task is undocumented", "Only 1 role covers this task").

**Risk flags** (deterministic, categorized, each with title + explanation + linked entities):
1. **Single-person coverage** — critical tasks with exactly 1 capable active person.
2. **No coverage** — tasks with 0 capable active people.
3. **Competency concentration** — a competency required by ≥1 **critical** task with only 1 active holder.
4. **Task/person concentration (bus factor)** — an active person capable of ≥3 **critical** tasks.
5. **Documentation gaps** — critical tasks with `isDocumented === false`.
6. **Role concentration** — a critical task whose capable people all share a single role.

**Dashboard metrics** (`computeDashboardMetrics`): process count, critical processes, task count, critical tasks, single-person tasks, no-coverage tasks, documentation-gap tasks, concentrated competencies, plus coverage ratios (tasks with ≥2 capable people / total; same among critical only).

---

## Scenario simulation (`src/lib/simulation.ts`)

`simulateAbsence(db, personId, days)` produces a simulated dataset with that person `isActive=false`, re-runs analysis, and diffs:
- **Affected tasks** (tasks the person can perform) with before/after: capable count + level change.
- **Tasks without coverage** (capable count → 0) and **tasks reduced to single-person** (→ 1).
- **Affected functions** and **affected processes** (parent hierarchy of affected tasks).
- **Uncovered competencies** — competencies the person holds that now have 0 active holders (critical ones flagged).
- Summary counts + "days" displayed; wording stays capability-focused (never "person is indispensable").

---

## Pages & routes (all under `AppShell`)

| Route | Page | Content |
|---|---|---|
| `/` | Dashboard | Org card + stat cards + risk-flag summary + top risks; edit-org dialog |
| `/organization` | Organization | View/edit org profile, description, principles ("what ORA analyzes vs. not") |
| `/processes` | Process structure | Process → Function → Task tree; CRUD for all three levels |
| `/tasks` | Task registry | Table: task, criticality, required competencies, capable people, roles, doc status, dependency level; task CRUD + detail row showing reasons |
| `/competencies` | Competencies | List with holder count + concentration flag; CRUD; link to tasks requiring it |
| `/people` | People | List: role, active status, competency count, critical-task count, bus-factor flag; CRUD incl. competency & task capability multi-select |
| `/analysis` | Coverage analysis | Full dependency table (all tasks) with explanations + all risk-flag sections |
| `/simulation` | Absence simulation | Person + days picker; result panels (affected tasks/functions/processes, uncovered tasks, uncovered competencies, before/after table) |

**CRUD UX**: shadcn `Dialog` forms per entity (`OrganizationFormDialog`, `ProcessFormDialog`, `FunctionFormDialog`, `TaskFormDialog`, `RoleFormDialog`, `PersonFormDialog`, `CompetencyFormDialog`); deletes via `AlertDialog` confirm; multi-selects (task↔competencies, person↔competencies, person↔tasks) via a reusable **`MultiSelect`** built from Popover + Command (cmdk installed) + Checkbox. A `ConfirmDialog`-style delete guards destructive actions.

---

## Design system

Aesthetic: **operational-risk console** — precise, editorial, technical. Risk semantics are the visual language (green/amber/red signals); no generic gradients, no purple.

- **Typography** (Google Fonts added to `index.html`): `Archivo` (display/headings) + `IBM Plex Sans` (body) + `IBM Plex Mono` (metrics/numbers).
- **Tokens** (`src/index.css`, `tailwind.config.ts`): extend with semantic risk colors:
  `--risk-low` (emerald), `--risk-medium` (amber), `--risk-high` (orange), `--risk-critical` (red); subtle `--primary` deep-navy in light / light-on-dark in `.dark`; hairline borders; refined stat-card shadows.
- **Components**: `StatCard` (mono metric, delta caption), `CriticalityBadge`, `DependencyBadge`, `RiskFlag` card, `EmptyState`, `AppShell` sidebar with lucide icons, small brand mark "ORA". Reuse existing `Card`, `Badge`, `Button`, `Dialog`, `AlertDialog`, `Table`, `Tabs`, `Select`, `Switch`, `Popover`, `Command` from `src/components/ui/*`.
- Light theme by default (dark-mode-safe tokens defined); no theme toggle (not requested).

---

## Seed dataset (`src/data/seed.ts`)

**Org**: "Meridian Group" — mid-sized services company (operations, IT, finance, support).

**Processes → Functions → Tasks** (critical = ★):
1. **Customer Order Management** (★) → Order Intake: *Validate customer order* (★, doc), *Quote custom pricing* (★, **undoc**) · Billing: *Generate invoices* (★, doc), *Process credit notes* (imp, undoc)
2. **IT Infrastructure Operations** (★) → Production Systems: *Perform database backups* (★, doc), *Patch production servers* (★, **undoc**) · Incident Response: *Triage major incidents* (★, undoc), *Restore from backup* (★, doc)
3. **Payroll & HR Administration** (imp) → Payroll: *Run monthly payroll* (★, doc), *Process statutory filings* (★, **undoc**) · Employee Admin: *Onboard new hires* (imp, doc), *Maintain personnel records* (std, doc)
4. **Procurement & Supplier Management** (imp) → Purchasing: *Raise purchase orders* (imp, doc), *Approve supplier contracts* (★, **undoc**)
5. **Facilities & Support** (std) → Office Operations: *Manage office supplies* (std, doc), *Handle reception* (std, doc)

**Competencies** (13): Customer Order Processing; Pricing & Quoting; Invoicing & Billing; Database Administration; Server Administration; Disaster Recovery; Incident Management; Network Operations; Payroll Processing; Payroll Compliance; HR Onboarding; Procurement; Contract & Compliance Review.

**Roles** (9): Operations Manager; Order Specialist; Billing Analyst; IT Systems Administrator; IT Support Engineer; Database Administrator; HR & Payroll Specialist; HR Administrator; Procurement Officer; Compliance Officer; Facilities Coordinator; Receptionist.

**People** (12, seeded to create clear demo findings): **Ana** (IT Systems Admin — sole holder of *Server Administration* & *Disaster Recovery*; only capable person for *Patch production servers*), **Bruno** (DBA — backups/restore), **Carlos** (IT Support — incident triage), **Diana** (Order Specialist — sole holder of *Pricing & Quoting*; only person for *Quote custom pricing*), **Elena** (Billing), **Franco** (HR & Payroll — sole holder *Payroll Compliance*; only person for *Statutory filings*), **Gabriela** (HR Admin), **Hugo** (Procurement), **Ines** (Compliance — sole holder *Contract & Compliance Review*; only person for *Approve supplier contracts*), **Jorge** (Ops Manager — capable of many critical tasks across processes = bus-factor flag), **Katia** (Facilities), **Luis** (Reception). One person inactive (demonstrates active-status filtering).

Expected demo results: ≥5 single-person critical tasks, ≥4 concentrated competencies, 1 bus-factor person, several critical documentation gaps, multiple role-concentration flags.

---

## Files to create / modify

**Create**
- `src/types/index.ts` — entity types
- `src/lib/id.ts` — `uid()`
- `src/lib/analysis.ts` — metrics, dependency, risk flags
- `src/lib/simulation.ts` — absence simulation
- `src/data/seed.ts` — seed dataset
- `src/store/OraContext.tsx` — provider, reducer, localStorage persistence, `useOra`
- `src/components/layout/AppShell.tsx` — sidebar + outlet
- `src/components/common/` — `StatCard`, `CriticalityBadge`, `DependencyBadge`, `RiskFlag`, `EmptyState`, `MultiSelect`
- `src/components/entities/` — form dialogs (Organization, Process, Function, Task, Role, Person, Competency), `ProcessTree`, `TaskDependencyTable`, `SimulationPanel`, `RiskFlagsSection`
- `src/pages/` — `Dashboard`, `Organization`, `Processes`, `Tasks`, `Competencies`, `People`, `Analysis`, `Simulation`

**Modify**
- `src/router.tsx` — add 8 routes wrapped in `AppShell`
- `src/pages/Index.tsx` → replaced by `Dashboard` (or router points `/` to Dashboard)
- `src/index.css` — typography, risk tokens, font-family, subtle textures
- `tailwind.config.ts` — map new tokens to colors
- `index.html` — title "ORA — Organizational Resilience Analyzer", favicon, Google Fonts links

Reuse existing: `Card`, `Badge`, `Button`, `Dialog`, `AlertDialog`, `Table`, `Tabs`, `Select`, `Switch`, `Input`, `Textarea`, `Label`, `Popover`, `Command`, `Checkbox`, `Separator`, `ScrollArea` from `src/components/ui/*`.

---

## Implementation checklist

- [ ] `src/types/index.ts` defines all entities + `Db` (relationships via id arrays)
- [ ] `src/lib/id.ts` exports `uid()`
- [ ] `src/data/seed.ts` seeds Meridian Group with 5 processes / 8 functions / 16 tasks / 13 competencies / 12 roles / 12 people (1 inactive) matching the plan's expected findings
- [ ] `src/lib/analysis.ts` exports `taskDependency`, `computeDashboardMetrics`, `detectRiskFlags`, `competencyConcentration`, `personConcentration` — all returning reasons, no black-box score
- [ ] `src/lib/simulation.ts` exports `simulateAbsence` returning affected/uncovered tasks, affected functions/processes, uncovered competencies, before/after level changes
- [ ] `src/store/OraContext.tsx` provides `useOra` with CRUD actions per collection + `resetToSeed`, persisted to `localStorage` `ora-data-v1`, hydrating from seed
- [ ] `AppShell` renders sidebar nav + outlet; all 8 routes wired in `router.tsx`
- [ ] Dashboard shows stat cards + risk-flag summary + edit-org dialog
- [ ] Processes page renders Process→Function→Task tree with CRUD at all levels
- [ ] Tasks page table shows criticality, competencies, capable people, roles, doc status, dependency level + reasons
- [ ] Competencies page shows holder counts + concentration flags + CRUD
- [ ] People page shows role/active/competency/critical-task count/bus-factor + CRUD with MultiSelects
- [ ] Analysis page shows full dependency table + all risk-flag sections with explanations
- [ ] Simulation page runs absence scenario with before/after results
- [ ] `MultiSelect` reusable (Popover+Command+Checkbox) used for all many-to-many links
- [ ] Delete actions guarded by confirm dialog
- [ ] Design tokens (risk colors, fonts) applied in `index.css` / `tailwind.config.ts`; no emoji, all icons via lucide-react

## Verification checklist

- [ ] `pnpm exec tsc --noEmit` and `pnpm lint` pass; `pnpm run build` succeeds
- [ ] Fresh load shows seed data; dashboard counts match seed (e.g. ≥5 single-person critical tasks, ≥4 concentrated competencies, 1 bus-factor person, doc gaps present)
- [ ] Dependency reasons are accurate for a sampled task (e.g. *Patch production servers* = High, single capable person, undocumented)
- [ ] CRUD: create process → add function → add task → appears in tree, dashboard, and analysis; edit persists after reload; delete removes references cleanly
- [ ] Multi-selects save/restore correctly (task↔competencies, person↔competencies, person↔tasks)
- [ ] Simulating **Ana** (60 days): *Patch production servers* becomes "No coverage", Server Administration/Disaster Recovery flagged as uncovered, affected processes include IT Infrastructure Operations
- [ ] Simulating a non-critical low-load person (e.g. Luis) shows minimal/no impact — negative case
- [ ] Inactive person is excluded from capability counts everywhere
- [ ] "Reset demo data" restores seed after edits
- [ ] Responsive: sidebar collapses gracefully on `mobile_390`; verify dashboard at `mobile_390` and `desktop_1280`
