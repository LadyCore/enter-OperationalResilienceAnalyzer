# ORA · Chatbot contextual + H-012 (Castellano ↔ English)

## Context

ORA pide un asistente integrado (no un chatbot genérico) que ayude con: (A) la
carga de datos y el Excel oficial, (B) la navegación interna, y (C) la
interpretación de resultados reales — siempre fundamentado en el código, las
reglas y los datos reales de ORA, sin inventar campos, rutas, reglas ni
resultados. Además, H-012 exige interfaz y respuestas del asistente en el idioma
global de la app (Castellano ↔ English).

Hallazgos de exploración (verificados en el código):
- **i18n**: infraestructura i18next ya existe (`src/i18n/config.ts`, manifest
  `i18n.config.json` con `en` + `zh-CN` placeholder, switcher
  `src/components/language-switcher.tsx` SIN montar). Toda la UI de ORA hoy es
  texto en inglés hardcodeado (≈116 archivos .tsx, ~192 literales visibles
  estimados); solo `NotFound.tsx` usa `t()`. NO hay idioma `es` ni selector real.
- **Import/Excel**: plantilla oficial `src/lib/importer/downloadTemplate.ts`
  (sheet `Organizacion` con 22 columnas + sheet `Instrucciones` con glosario);
  campos/mapeo `src/lib/importer/types.ts`; reglas y mensajes reales en
  `src/lib/importer/validate.ts` (Sí/No, criticidad, `;` como separador,
  resolución de Responsable/Cubre-ausencias por Legajo→nombre, filas
  excluidas/duplicados/ambiguos, bloqueo por referencias faltantes).
- **Dominio/análisis**: `src/types/index.ts`, `src/lib/analysis.ts`
  (dependencia none/high/limited/adequate, criticidad declarada vs derivada,
  dashboard metrics, risk flags y concentraciones), `src/lib/exposure.ts`
  (none/short/prolonged/sustained; 3/14 días), `src/lib/oncall.ts` (H24,
  buildOnCallMetrics), `src/lib/simulation.ts` (ausencias). Estado real por org
  en `src/store/OraContext.tsx` (`db`, `user`, `isOwner`, org activa).
- **Navegación**: rutas en `src/router.tsx`, menú real en
  `src/components/layout/AppShell.tsx`, labels de módulo en
  `src/lib/feedback/context.ts` (`ROUTE_MODULES`).
- **AI**: modelo elegido por el usuario = **Gemini 3.6 Flash**
  (`google/gemini-3.6-flash`, protocolo `google_gemini_generate_content`,
  streaming SSE). Secret `AI_API_TOKEN_8e29993771ea`, base
  `https://api.enter.pro/code/api/ai/v1beta/models/{model}:streamGenerateContent`,
  `X-Enter-Project-ID: 8e29993771ea4c7c9cb4c36d6d00f9bf`, `X-Session-ID` sticky.

Decisiones de producto confirmadas: alcance de idioma = **toda la interfaz ORA**
en `en`+`es` + chatbot bilingüe; montar el switcher global real; chatbot
disponible en el área autenticada con contexto de pantalla + datos reales de la
org activa calculados con el motor real de ORA; modelo Gemini 3.6 Flash.

## Arquitectura elegida

### 1) Internacionalización real (en/es) — vía el skill `enter_i18n`
- Manifest `i18n.config.json`: idiomas `en` (fallback) y `es` (label
  "Español", detect `["es"]`, dir `ltr`). Retirar `zh-CN` (scaffold placeholder
  no solicitado; flujo de retire del skill).
- `public/locales/en.json` = fuente estructural con las cadenas REALES de ORA
  (convertidas desde los literales actuales); `public/locales/es.json` =
  espejo traducido. Se preservan claves `notFound.*` ya usadas por NotFound.
- Convertir toda la UI (páginas, AppShell/layout, auth, entities, import,
  access, feedback, common) a `const { t } = useTranslation()` con claves
  estáticas. Incluye visible text, placeholders, aria-labels y mensajes de
  toast/error. Se localizan también `ui/*` en lo visible (sr-only de
  Dialog/Sheet/etc.).
- Montar `LanguageSwitcher` una vez en `AppShell` (zona usuario / header) y en
  `LoginPage` (arriba-derecha).
- Cerrar con
  `check-i18n.mjs` y `scan-i18n.mjs` (mandatorio, es el "last command").

### 2) Backend function `supabase/functions/ora-assistant/index.ts`
- `Deno.serve` + CORS + `verify_jwt` por defecto (`true`): solo sesiones
  autenticadas (el widget vive en el área autenticada). Sin SQL crudo.
- Body: `{ messages, language, screen, screenContext }` donde `screen` y
  `screenContext` provienen del cliente (contexto real, ver §3).
- Reenvía a Gemini (`google/gemini-3.6-flash`) con `contents` mapeando
  role `user`/`model`, `systemInstruction` construida SERVIDOR-SIDE con un
  "hechos de ORA" embebido (ver §3) + reglas de conducta:
  - responder SOLO con los hechos provistos o conocimiento general que no
    contradiga ORA;
  - nunca inventar campos/reglas/rutas/resultados; si no hay información
    suficiente → responder explícitamente que ORA no dispone de ese dato;
  - consultas fuera de alcance → redirigir a lo que ORA sí puede asistir;
  - responder SIEMPRE en `language`; consultar/explicar/orientar, nunca
    modificar;
  - para navegación: usar únicamente la lista de secciones provista y, si el
    usuario pregunta "dónde está X", cerrar con `⟶ Go to <label exacto>`.
- Errores: reenviar el SSE de Gemini con `{error:{code,message,status}}`
  (parseo en Level 0/1); fallback de mensajes por estado (401/402/403/429/…).
- Streaming SSE (passthrough de `response.body`), headers CORS + no-cache.

### 3) Contexto real (fuentes de verdad)
- **Knowledge pack** compilado en tiempo de construcción a partir de código
  real (sin duplicar strings a mano): exportar/centralizar las fuentes y
  construir en el cliente el objeto `screenContext` con:
  - Excel oficial: columnas reales + glosario de `downloadTemplate.ts`
    (exportar constantes) y labels de `importer/types.ts`.
  - Reglas de validación reales: literal exportado desde `validate.ts`
    (bool/criticidad aceptados, separador `;`, resolución manager/coverage,
    qué bloquea, mensajes de error conocidos).
  - Navegación: allowlist derivada de `AppShell` nav + `ROUTE_MODULES`
    (label → ruta) que el servidor incluye y el cliente valida.
  - Análisis: conceptos reales (dependency levels, derived vs declared
    criticality, exposure, on-call, risk categories) en texto corto.
- **Contexto de pantalla** (por request): ruta actual (useLocation), label de
  módulo real, nombre de la org activa, e información REAL de la pantalla
  calculada con los motores existentes sobre `OraContext.db`:
  - Dashboard: `computeDashboardMetrics(db)` + top risk flags
    (`detectRiskFlags(db)`).
  - Analysis/Simulation/People/etc.: métricas/reglas relevantes de la pantalla
    (sin enviar filas íntegras; solo agregados + top-N acotados).
- La navegación directa usa SOLO rutas existentes: el cliente detecta
  `⟶ Go to <label>` y muestra un chip "Ir a <sección>" que llama `navigate(ruta)`
  resolviendo label→path desde el allowlist real; si no hay match exacto, no se
  ofrece navegación.

### 4) Frontend chatbot
- Dependencia nueva: `@microsoft/fetch-event-source`.
- `src/components/assistant/AssistantFab.tsx` + `AssistantPanel.tsx` montados en
  `AppLayout` o `AppShell` (zona autenticada). Launcher tipo FAB consistente con
  el diseño (tokens sidebar/background); panel tipo Sheet/Drawer responsive con
  scroll interno, loading, error y botón "Nueva conversación".
- Hook `useAssistantChat` (SSE, niveles 0-3 de detección de error, abort,
  `X-Session-ID` estable por conversación, reset genera nuevo session id).
- Constructor de contexto `src/lib/assistant/context.ts` (screen + screenContext
  + language via `i18n.resolvedLanguage`).
- Estados de conversación en memoria durante la sesión (sin persistir).
- i18n de TODAS las cadenas del widget (placeholders, botones, estados,
  bienvenida) en `en`/`es`.

## Archivos críticos
- `i18n.config.json`, `public/locales/{en,es}.json`, `src/i18n/util.ts`
  (si check-i18n detecta normalizeLanguage legacy: aplicar carve-out del skill).
- Switcher montado: `src/components/layout/AppShell.tsx`,
  `src/components/auth/LoginPage.tsx`.
- Conversión a `t()`: páginas en `src/pages/*`, `src/components/{layout,auth,
  entities,import,access,feedback,common}/*` + literales visibles de `ui/*`.
- Backend: `supabase/functions/ora-assistant/index.ts`.
- Frontend chatbot: `src/components/assistant/*`,
  `src/lib/assistant/context.ts`, `src/hooks/useAssistantChat.ts`.
- Fuentes de verdad exportadas: `src/lib/importer/downloadTemplate.ts`,
  `src/lib/importer/validate.ts` (exports mínimos para el knowledge pack).

## Implementation checklist
- [ ] Añadir dependencia `@microsoft/fetch-event-source` y confirmar i18n activo
      (si `i18n_enable` está disponible, invocarlo; si ya está activo, seguirlo).
- [ ] Manifest i18n: `en`+`es`, retirar `zh-CN`, mantener fallback `en`.
- [ ] `public/locales/en.json` con claves reales de ORA; `es.json` espejo
      traducido; claves `notFound.*` conservadas.
- [ ] Convertir a `t()` con claves estáticas: `src/pages/*`, `src/components/
      layout/AppShell.tsx`, auth/*, entities/*, import/*, access/*, feedback/*,
      common/* y literales visibles de `ui/*`.
- [ ] Montar `LanguageSwitcher` en `AppShell` y en `LoginPage`.
- [ ] Correr `check-i18n.mjs` y `scan-i18n.mjs` (como últimos comandos) y dejar
      `reports/i18n/summary.json` generado.
- [ ] Exportar fuentes reales del import (constantes de template + literales de
      validación) para el knowledge pack.
- [ ] `supabase/functions/ora-assistant/index.ts` (Gemini streaming, CORS,
      systemInstruction con hechos ORA, idioma, navegación con allowlist,
      manejo de errores SSE).
- [ ] `src/lib/assistant/context.ts` (screen + screenContext con métricas reales
      de Dashboard/riesgos/org activa).
- [ ] `src/hooks/useAssistantChat.ts` (SSE, 4 niveles de error, abort, session
      sticky).
- [ ] `src/components/assistant/{AssistantFab,AssistantPanel}.tsx` con i18n es/en
      y chip de navegación validado contra rutas reales.
- [ ] Montar el chatbot en el área autenticada sin romper FeedbackFab/AppShell.
- [ ] `pnpm lint`, `tsc --noEmit`, `pnpm test` y `pnpm build` en verde.

## Verification checklist
- [ ] Carga: preguntas 1-7 de datos/Excel → respuestas coinciden con reglas
      reales (columnas, campos, formatos Sí/No y criticidad, `;`, errores).
- [ ] Navegación: preguntas 8-12 → la sección indicada existe (allowlist) y el
      chip navega a la ruta real; ruta inexistente → "no existe en ORA".
- [ ] Interpretación: preguntas 13-16 → explica métricas/riesgos reales del org
      activa; NO inventa resultados.
- [ ] Fuera de alcance / dato desconocido → respuesta explícita de falta de
      información / redirección.
- [ ] Integración 17-23: abrir/cerrar sin bloquear; loading; error (simular
      fallo); responsive (mobile_390 y desktop_1280).
- [ ] Idiomas 24-27: switcher real en AppShell/Login; con `es` todo ORA y el
      chatbot en castellano; con `en` en inglés; volver a `es` sin residuos.
- [ ] No aparecen textos ORA en inglés dentro de la UI en `es` (excepto términos
      propios justificados: "guardia", nombres de columnas de plantilla en es).
- [ ] Verificación técnica: `check-i18n.mjs`, `scan-i18n.mjs`, lint, tsc, tests
      (113+), build.
- [ ] Prueba funcional real: enviar un mensaje real vía el panel (org demo) y
      comprobar stream/errores; verificar logs de la función para el modelo
      elegido.

## Notas de implementación
- Al final se entrega el resumen técnico solicitado: Implementado / Fuentes de
  contexto / Integración / Internacionalización / Limitaciones / Pruebas /
  Riesgos. Limitación conocida: contexto de pantalla profundo (p. ej. un
  escenario de simulación en curso) se limita a lo calculable/exportable desde
  el estado actual de `OraContext`; no se instrumentan estados locales por
  página salvo que el tiempo lo permita (se declara como pendiente/limitación).
