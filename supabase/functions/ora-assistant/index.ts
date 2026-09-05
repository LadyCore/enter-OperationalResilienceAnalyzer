import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * ORA knowledge pack for the contextual assistant.
 *
 * This file is the single source of truth for what the model is allowed to know
 * about ORA. It is curated from the real product sources listed below and must
 * be kept in sync when those sources change:
 *
 *  - Template columns & glossary: `src/lib/importer/downloadTemplate.ts`
 *  - Import fields & mapping:      `src/lib/importer/types.ts`
 *  - Validation rules & messages:  `src/lib/importer/validate.ts`
 *  - Analysis engine:              `src/lib/analysis.ts`
 *  - Temporal exposure:            `src/lib/exposure.ts`
 *  - On-call (guardia pasiva):     `src/lib/oncall.ts`
 *  - Simulations:                  `src/lib/simulation.ts`
 *  - Navigation:                   `src/router.tsx`, `src/components/layout/AppShell.tsx`
 *  - Entities & data model:        `src/types/index.ts`
 *
 * The facts are deliberately descriptive text (the model cannot execute code).
 * Values/rules below reproduce the real behaviour of those modules.
 */

export interface NavigationDestination {
  /** Real application route. */
  path: string;
  /** English label — the model may ONLY use the label of the requested language. */
  en: string;
  es: string;
  /** Short purpose, so the model can decide where a question belongs. */
  purposeEn: string;
  purposeEs: string;
}

/** Real navigable destinations (routes actually registered in src/router.tsx). */
export const NAVIGATION: NavigationDestination[] = [
  {
    path: "/",
    en: "Dashboard",
    es: "Panel",
    purposeEn: "Operational resilience overview: metrics, coverage ratios and risk highlights.",
    purposeEs: "Visión general de resiliencia operativa: métricas, ratios de cobertura y señales de riesgo.",
  },
  {
    path: "/processes",
    en: "Processes",
    es: "Procesos",
    purposeEn: "Structure of the organization as processes, functions and tasks.",
    purposeEs: "Estructura de la organización como procesos, funciones y tareas.",
  },
  {
    path: "/tasks",
    en: "Tasks",
    es: "Tareas",
    purposeEn: "Task registry with criticality, competencies, capable people and dependency.",
    purposeEs: "Registro de tareas con criticidad, competencias, personas capaces y dependencia.",
  },
  {
    path: "/competencies",
    en: "Competencies",
    es: "Competencias",
    purposeEn: "Competency registry and who holds each one.",
    purposeEs: "Registro de competencias y quién las posee.",
  },
  {
    path: "/people",
    en: "People",
    es: "Personas",
    purposeEn: "People and roles, plus vacation coverage and passive on-call (guardia).",
    purposeEs: "Personas y roles, más cobertura de vacaciones y guardia pasiva.",
  },
  {
    path: "/analysis",
    en: "Analysis",
    es: "Análisis",
    purposeEn: "Risk flags and task-level dependency; where results and conclusions live.",
    purposeEs: "Señales de riesgo y dependencia a nivel de tarea; ahí viven los resultados y las conclusiones.",
  },
  {
    path: "/simulation",
    en: "Simulation",
    es: "Simulación",
    purposeEn: "Absence scenarios: people unavailable at the same time.",
    purposeEs: "Escenarios de ausencias: personas no disponibles al mismo tiempo.",
  },
  {
    path: "/import",
    en: "Import",
    es: "Importar",
    purposeEn: "Import an organization from the official Excel/CSV template.",
    purposeEs: "Importar una organización desde la plantilla oficial Excel/CSV.",
  },
  {
    path: "/organization",
    en: "Organization",
    es: "Organización",
    purposeEn: "Manage organizations and the profile of the active one.",
    purposeEs: "Gestionar organizaciones y el perfil de la activa.",
  },
  {
    path: "/access",
    en: "Access & licensing",
    es: "Acceso y licencias",
    purposeEn: "Owner-only: users, DEMOs and licenses.",
    purposeEs: "Solo propietario: usuarios, DEMOs y licencias.",
  },
  {
    path: "/feedback",
    en: "Feedback",
    es: "Comentarios",
    purposeEn: "Owner-only: feedback reports sent from the app.",
    purposeEs: "Solo propietario: informes de comentarios enviados desde la app.",
  },
];

export function navigationList(language: "en" | "es"): string {
  return NAVIGATION.map(
    (d) => `- ${d[language]}: ${language === "en" ? d.purposeEn : d.purposeEs}`,
  ).join("\n");
}

/** Official template columns, in real order (sheet "Organizacion"). */
const TEMPLATE_COLUMNS: { column: string; meaningEn: string; meaningEs: string; required: string; example: string }[] = [
  {
    column: "Empleado",
    meaningEn: "Person name. One row = one person. Mandatory.",
    meaningEs: "Nombre de la persona. Una fila = una persona. Obligatorio.",
    required: "Sí",
    example: "Ana García",
  },
  {
    column: "Legajo",
    meaningEn: "Unique person identifier, when the organization uses one. Recommended for manager references.",
    meaningEs: "Identificador único de la persona, si la organización lo usa. Recomendado para referencias de responsables.",
    required: "Recomendado",
    example: "EMP-0001",
  },
  {
    column: "Sector",
    meaningEn: "Area or department; reused and normalized.",
    meaningEs: "Área o departamento; se reutiliza y normaliza.",
    required: "No",
    example: "Tecnología",
  },
  {
    column: "Responsable",
    meaningEn: "Manager name — only when the person has a manager. If provided, it must exist in the file.",
    meaningEs: "Nombre del responsable, solo si la persona tiene uno. Si se informa, debe existir en el archivo.",
    required: "No",
    example: "Ana García",
  },
  {
    column: "Manager ID",
    meaningEn: "Manager identifier (Legajo). Optional: leave empty when there is no applicable manager. If provided, it must match a person in the file.",
    meaningEs: "Identificador del responsable (Legajo). Opcional: déjalo vacío cuando no hay un responsable aplicable. Si se informa, debe coincidir con una persona del archivo.",
    required: "No",
    example: "EMP-0001",
  },
  {
    column: "Rol",
    meaningEn: "Role / job title.",
    meaningEs: "Puesto o rol del puesto.",
    required: "No",
    example: "Jefe de Área",
  },
  {
    column: "Role ID",
    meaningEn: "Role identifier.",
    meaningEs: "Identificador del rol.",
    required: "No",
    example: "ROL-001",
  },
  {
    column: "Proceso",
    meaningEn: "Process the task belongs to; reused.",
    meaningEs: "Proceso al que pertenece la tarea; se reutiliza.",
    required: "No",
    example: "Gestión Tecnológica",
  },
  {
    column: "Función",
    meaningEn: "Function inside the process.",
    meaningEs: "Función dentro del proceso.",
    required: "No",
    example: "Controlar operaciones",
  },
  {
    column: "Tareas",
    meaningEn: "Person's tasks. Several values separated by ';'.",
    meaningEs: "Tareas de la persona. Varios valores separados por ';'.",
    required: "No",
    example: "Planificación operativa; Soporte interno",
  },
  {
    column: "Competencias",
    meaningEn: "Person's competencies. Several values separated by ';'.",
    meaningEs: "Competencias de la persona. Varios valores separados por ';'.",
    required: "No",
    example: "Análisis; Comunicación",
  },
  {
    column: "Documentada",
    meaningEn: "Whether the task is documented. Accepted values: yes/no (see valid values).",
    meaningEs: "¿La tarea está documentada? Valores admitidos: sí/no (ver valores válidos).",
    required: "No",
    example: "Sí",
  },
  {
    column: "Activo",
    meaningEn: "Whether the person is active. Accepted values: yes/no (see valid values).",
    meaningEs: "¿La persona está activa? Valores admitidos: sí/no (ver valores válidos).",
    required: "No",
    example: "Sí",
  },
  {
    column: "Guardia pasiva",
    meaningEn: "Whether the person has passive on-call. Empty = no on-call. Optional columns follow.",
    meaningEs: "¿La persona está en guardia pasiva (on-call)? Vacío = sin guardia. Siguen campos opcionales.",
    required: "No",
    example: "Sí",
  },
  {
    column: "Modalidad guardia",
    meaningEn: "Coverage scheme, free text: H24, shifts or another scheme.",
    meaningEs: "Esquema de cobertura, texto libre: H24, turnos u otro propio.",
    required: "No",
    example: "H24",
  },
  {
    column: "Turno/Período guardia",
    meaningEn: "Shift or period, free text (no fixed structure imposed).",
    meaningEs: "Turno o período, texto libre (no se impone una estructura fija).",
    required: "No",
    example: "Noche",
  },
  {
    column: "Tareas de guardia",
    meaningEn: "Functions/capabilities covered on call (existing tasks, ';').",
    meaningEs: "Funciones/capacidades cubiertas en guardia (tareas existentes, ';').",
    required: "No",
    example: "Controlar operaciones",
  },
  {
    column: "Competencias de guardia",
    meaningEn: "Competencies that enable the on-call (';').",
    meaningEs: "Competencias que habilitan la guardia (';').",
    required: "No",
    example: "Análisis",
  },
  {
    column: "Cubre ausencias de",
    meaningEn: "The person of this row covers vacations of the referenced person (Legajo or name).",
    meaningEs: "La persona de esta fila cubre vacaciones de la persona referida (Legajo o nombre).",
    required: "No",
    example: "EMP-0001",
  },
  {
    column: "Rol que cubre",
    meaningEn: "Role/position covered during the absence (optional).",
    meaningEs: "Rol/puesto cubierto durante la ausencia (opcional).",
    required: "No",
    example: "Jefe de Área",
  },
  {
    column: "Tareas que cubre",
    meaningEn: "Concrete tasks performed during the absence (';').",
    meaningEs: "Tareas concretas que puede realizar durante la ausencia (';').",
    required: "No",
    example: "Planificación operativa",
  },
  {
    column: "Competencias de cobertura",
    meaningEn: "Competencies that enable that coverage (';').",
    meaningEs: "Competencias que habilitan esa cobertura (';').",
    required: "No",
    example: "Comunicación",
  },
];

function templateTable(): string {
  const head = "Column | Meaning | Required | Example";
  const sep = "---|---|---|---";
  const rows = TEMPLATE_COLUMNS.map(
    (c) => `${c.column} | ${c.meaningEn} | ${c.required} | ${c.example}`,
  );
  return ["Official template sheet 'Organizacion' (one row per person):", head, sep, ...rows].join("\n");
}

/**
 * Real import/validation rules reproduced from `src/lib/importer/validate.ts`.
 * Do not edit these to "improve" them — mirror the parser.
 */
const IMPORT_RULES = `
IMPORT RULES (source of truth: ORA's importer):
- One row per person. A person may span several rows (one per sector/role) — that is NOT a duplicate.
- Real duplicates: the same person repeats the exact same area + role + optional on-call/coverage signature. ORA flags them as "possible duplicate".
- Multi-value cells (tasks, competencies, on-call tasks/competencies, covered tasks/competencies) separate values with ';'.
- A row without a person name is excluded with a warning (and counts as incomplete).
- "Documentada" and "Activo" (and guardia "Sí/No") accept, case-insensitively and ignoring accents: yes: "si","sí","yes","true","1","activo","active","alta","documentada","documentado","documented"; no: "no","false","0","inactivo","inactive","baja".
- Criticality accepts, case-insensitively and ignoring accents: critical: "critical","critico","crítico","alta","alto","1","c"; important: "important","importante","media","2","i"; standard: "standard","normal","estandar","estándar","baja","bajo","3","s". Any other value is recorded as an unusable value and ignored.
- There is NO "Criticidad" column in the official template; if the source file has one it can be mapped. Without criticality data, ORA derives process criticality from operational weight.
- EMPTY vs REFERENCE: an EMPTY field is not, by itself, an import error. Leave a cell empty when there is no applicable data (e.g. a person with no manager, or role/on-call/coverage data that does not apply to the row). Empty cells never produce a blocking incidence.
- REFERENCE INTEGRITY: only when a name or Legajo IS provided as a reference to another person (Responsable / Manager ID, or "Cubre ausencias de") must that reference exist and resolve unambiguously inside the imported data. A reference that is missing, ambiguous or incongruent (e.g. writing "N/A" in a manager cell) CAN produce a blocking incidence — the empty cell would not have.
- Manager reference: "Manager ID" must reference an existing Legajo in the file; when only "Responsable" (name) is given, the name must match exactly one person. More than one match → blocking ambiguity; zero matches → blocking error. A person without a manager simply leaves these cells empty.
- Verified behaviour: a sheet whose manager/coverage references to a removed person (Legajo LEG-002) were deleted passed the column mapping and the validation with no blocking incidences for those references, even though many cells were left unmapped/empty.
- Vacation coverage: "Cubre ausencias de" references the person (A) whose vacation the row's person (B) covers. Resolution by Legajo first, then unique name. A person cannot cover their own absence (ignored with warning). It only applies to planned-absence simulations categorized as Vacation.
- On-call (guardia): columns optional. If a row has on-call tasks but no modality, ORA warns that H24/Shifts/own scheme should be filled.
- Ambiguous or missing manager/coverage references BLOCK the import until resolved. Warnings never block.
- Unmapped source columns are reported but never block.
`;

/** Analytical concepts reproduced from src/lib/analysis.ts, exposure.ts, simulation.ts, oncall.ts. */
const ANALYSIS_RULES = `
ORA ANALYSIS MODEL (how ORA reaches results):
- Entities: Organization > Process > Function > Task. Competencies are required by tasks and held by people. People may hold Roles and belong to Areas. Only ACTIVE people count toward coverage.
- Criticality is structural. Declared mode uses each entity's declared criticality; a task inherits the highest criticality of its task/function/process. Derived mode (imports without criticality data) derives process criticality from operational weight: weight = tasks + functions + people + 2*areas of the process; thresholds are >= 50% of the largest process → critical, >= 20% → important, else standard. Coverage/redundancy NEVER changes criticality.
- Dependency measures coverage per task by the number of ACTIVE capable people: 0 = no coverage, 1 = high dependency, 2 = limited coverage, 3+ = adequate coverage. Role spread, documentation and single-holder required competencies are reported as extra factors.
- Risk flags (Analysis page): single-person coverage, no coverage, competency concentration (1-2 holders of a competency required by critical tasks), person concentration (bus factor: >=3 critical tasks or exclusive critical tasks), documentation gaps on critical tasks, role concentration (single role covering a critical task).
- Exposure thresholds (simulations): short 1-3 days, prolonged 4-14 days, sustained >14 days or any permanent absence. Exposure is an interpretation, never a change to criticality/coverage.
- Simulations: selected people are unavailable SIMULTANEOUSLY; the whole organization is re-analyzed as one joint state (never the sum of individual cases). Vacation coverage (B covers A) only applies when A's absence is planned AND categorized as Vacation, and only when B is not absent. Passive on-call (guardia) is permanent availability outside ordinary hours and is NEVER used as vacation coverage nor in the base analysis.
- ORA never evaluates individual performance; it measures operational dependency and capability coverage.
`;

/** Assembled, static knowledge passed inside the system instruction. */
export function buildKnowledge(language: "en" | "es"): string {
  const lang = language === "es"
    ? "La interfaz y tus respuestas deben estar en castellano (es)."
    : "The UI and your answers must be in English (en).";
  return [
    lang,
    "ORA is an operational resilience analyzer. Facts below are ORA's real, product-level rules.",
    templateTable(),
    IMPORT_RULES,
    ANALYSIS_RULES,
    `NAVIGATION (valid destinations — you may ONLY reference these):\n${navigationList(language)}`,
  ].join("\n\n");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-id",
};

const AI_API_BASE = "https://api.enter.pro/code/api/ai/v1beta";
const AI_MODEL = "google/gemini-3.6-flash";
const ENTER_PROJECT_ID = "8e29993771ea4c7c9cb4c36d6d00f9bf";

const MAX_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_SCREEN_CONTEXT_LENGTH = 8000;

function sse(data: unknown, status = 200): Response {
  return new Response(`data: ${JSON.stringify(data)}\n\n`, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ChatMessage[] = [];
  for (const item of raw.slice(-MAX_MESSAGES)) {
    if (typeof item !== "object" || item === null) return null;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    if (content.trim().length === 0 || content.length > MAX_MESSAGE_LENGTH) continue;
    out.push({ role, content: content.trim() });
  }
  if (out.length === 0) return null;
  return out;
}

function systemInstruction(
  language: "en" | "es",
  screen: string,
  screenContext: string,
): string {
  const conduct =
    language === "es"
      ? "Actuas como el asistente integrado de ORA, el Analizador de Resiliencia Organizacional. Asistes en tres areas: (A) carga de datos y la plantilla Excel oficial, (B) navegacion dentro de ORA, y (C) interpretacion educativa de los resultados reales de ORA." +
        "\nREGLAS DE CONDUCTA (obligatorias):" +
        "\n1. Fundamenta tus respuestas en los hechos de ORA provistos abajo y en el contexto de pantalla entregado. El conocimiento general solo se usa cuando corresponde y nunca debe contradecir a ORA." +
        "\n2. NUNCA inventes campos, formatos, valores validos, reglas, rutas, funcionalidades, resultados, conclusiones ni datos de organizaciones. Si ORA no dispone de informacion suficiente, dilo explicitamente e indica como conseguirla." +
        "\n3. Distingue hechos de explicaciones. No presentes una inferencia propia como si fuera un resultado de ORA." +
        "\n4. Para interpretar resultados, usa UNICAMENTE los resultados y metricas que aparecen en el contexto de pantalla provisto. Nunca recalcules, modifiques ni reemplaces el motor analitico." +
        "\n5. Navegacion: solo existen los destinos de la lista NAVIGATION. Si el usuario pregunta donde esta algo, cierra tu respuesta con una linea final exacta con el formato: \"⟶ Go to <Etiqueta exacta>\" usando una etiqueta de la lista en castellano. No inventes rutas ni referencies destinos fuera de la lista." +
        "\n6. Consultas fuera del ambito de ORA: indica brevemente que estan fuera del alcance y redirige a lo que ORA si puede asistir. No te conviertas en un chatbot generalista." +
        "\n7. Responde SIEMPRE en castellano (es)."
      : "You are the integrated assistant of ORA, the Organizational Resilience Analyzer. You assist with three areas: (A) data loading and the official Excel template, (B) navigation inside ORA, and (C) educational interpretation of ORA's real results." +
        "\nCONDUCT RULES (mandatory):" +
        "\n1. Ground your answers in the ORA facts provided below and in the supplied screen context. General knowledge is used only where relevant and must never contradict ORA." +
        "\n2. NEVER invent fields, formats, valid values, rules, routes, features, results, conclusions or organization data. If ORA does not have enough information, say so explicitly and suggest how to get it." +
        "\n3. Distinguish facts from explanations. Never present your own inference as an ORA result." +
        "\n4. To interpret results, use ONLY the results and metrics present in the provided screen context. Never recompute, modify or replace the analytical engine." +
        "\n5. Navigation: only the destinations in the NAVIGATION list exist. If the user asks where something is, close your reply with a final exact line formatted as: \"⟶ Go to <Exact Label>\" using a label from the list in English. Never invent routes or reference destinations outside the list." +
        "\n6. Out-of-scope questions: briefly state they are outside ORA's scope and redirect to what ORA can assist with. Do not become a general-purpose chatbot." +
        "\n7. ALWAYS answer in English (en).";

  const screenSection =
    language === "es"
      ? "CONTEXTO DE PANTALLA ACTUAL" +
        "\n- Ruta actual: " + screen +
        "\n- Datos reales de la organizacion activa que ORA puso a tu disposicion (agregados, solo esta pantalla):" +
        "\n" + screenContext
      : "CURRENT SCREEN CONTEXT" +
        "\n- Current route: " + screen +
        "\n- Real data of the active organization that ORA made available (aggregates, this screen only):" +
        "\n" + screenContext;

  return [conduct, buildKnowledge(language), screenSection].join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_8e29993771ea");
    if (!AI_API_TOKEN) {
      console.error("ora-assistant: AI_API_TOKEN secret is not configured");
      return sse(
        { error: { code: 500, message: "AI service is not configured.", status: "INTERNAL" } },
        500,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !anonKey) {
      console.error("ora-assistant: missing SUPABASE_URL / SUPABASE_ANON_KEY env");
      return sse(
        { error: { code: 500, message: "Server configuration error.", status: "INTERNAL" } },
        500,
      );
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return sse(
        { error: { code: 401, message: "Authentication required.", status: "UNAUTHENTICATED" } },
        401,
      );
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return sse(
        { error: { code: 400, message: "Invalid request body.", status: "INVALID_ARGUMENT" } },
        400,
      );
    }

    const messages = sanitizeMessages(body.messages);
    if (!messages) {
      return sse(
        { error: { code: 400, message: "Missing or invalid messages.", status: "INVALID_ARGUMENT" } },
        400,
      );
    }

    const language: "en" | "es" =
      body.language === "es" || body.language === "en" ? (body.language as "en" | "es") : "en";

    const screen = typeof body.screen === "string" ? body.screen.slice(0, 200) : "/";
    const screenContext =
      typeof body.screenContext === "string"
        ? body.screenContext.slice(0, MAX_SCREEN_CONTEXT_LENGTH)
        : "";
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";

    if (organizationId) {
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", organizationId)
        .maybeSingle();
      if (orgError) {
        console.error("ora-assistant: org check failed", orgError);
        return sse(
          { error: { code: 500, message: "Could not verify organization access.", status: "INTERNAL" } },
          500,
        );
      }
      if (!org) {
        return sse(
          {
            error: {
              code: 403,
              message:
                language === "es"
                  ? "No tienes acceso a esa organizacion."
                  : "You do not have access to that organization.",
              status: "PERMISSION_DENIED",
            },
          },
          403,
        );
      }
    }

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const upstreamSessionID = req.headers.get("X-Session-ID")?.trim() || crypto.randomUUID();

    const upstream = await fetch(`${AI_API_BASE}/models/${AI_MODEL}:streamGenerateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": AI_API_TOKEN,
        "Content-Type": "application/json",
        "X-Session-ID": upstreamSessionID,
        "X-Enter-Project-ID": ENTER_PROJECT_ID,
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemInstruction(language, screen, screenContext) }] },
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      let errorMessage = "AI service error";
      let errorStatus = "api_error";
      const dataMatch = text.match(/data: (.+)/);
      if (dataMatch) {
        try {
          const errorData = JSON.parse(dataMatch[1]);
          errorMessage = errorData.error?.message || errorMessage;
          errorStatus = errorData.error?.status || errorStatus;
        } catch {
          /* keep defaults */
        }
      } else {
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error?.message || errorMessage;
          errorStatus = errorData.error?.status || errorStatus;
        } catch {
          /* keep defaults */
        }
      }
      return sse(
        { error: { code: upstream.status, message: errorMessage, status: errorStatus } },
        upstream.status,
      );
    }

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error("ora-assistant: unhandled error", detail, error);
    return sse(
      {
        error: {
          code: 500,
          message: "Internal assistant error.",
          status: "INTERNAL",
          detail,
        },
      },
      500,
    );
  }
});
