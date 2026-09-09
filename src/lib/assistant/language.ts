/** Languages the ORA assistant supports (mirrors the i18n locale set). */
export type AssistantLang = "en" | "es";

const SPANISH_CHARS = /[áéíóúüñ¿¡]/i;

const SPANISH_WORDS =
  /\b(el|la|los|las|un|una|unos|unas|y|o|de|del|al|en|por|para|con|sin|es|son|está|estan|hay|dónde|donde|cómo|como|qué|que|cuál|cual|cuáles|cuales|cuando|cuándo|quien|quién|puedo|puedes|puede|pueden|tengo|tienes|tiene|tienen|necesito|necesita|quiero|quiere|me|te|se|su|sus|mi|mis|tu|tus|consultar|ver|mostrar|buscar|personas|persona|competencias|competencia|tareas|tarea|procesos|proceso|funciones|función|ausentes|ausencia|cobertura|dependencia|criticidad|licencia|simulación|simulacion|importar|planificadas)\b/gi;

const ENGLISH_WORDS =
  /\b(the|a|an|and|or|of|to|for|with|without|is|are|am|was|were|there|where|how|what|which|who|when|can|could|do|does|did|i|you|he|she|we|they|my|your|his|her|their|need|want|have|has|see|show|view|find|people|person|absent|absence|coverage|depend|criticality|license|simulation|import|planned|staff)\b/gi;

/**
 * Heuristic language detection for the user's question. Spanish-specific
 * characters (á, é, í, ó, ú, ñ, ¿, ¡) strongly bias toward Spanish; otherwise
 * the count of common Spanish vs English stopwords decides. Returns null when
 * the signal is ambiguous or absent — the caller falls back to the platform
 * language.
 */
export function detectLanguage(text: string): AssistantLang | null {
  if (!text.trim()) return null;
  let es = 0;
  let en = 0;
  const m = text.match(SPANISH_WORDS);
  if (m) es += m.length;
  const e = text.match(ENGLISH_WORDS);
  if (e) en += e.length;
  if (SPANISH_CHARS.test(text)) es += 3;
  if (es > en) return "es";
  if (en > es) return "en";
  return null;
}

/**
 * Language used to render a message's contextual navigation buttons.
 *
 * A message generated under the CURRENT platform language keeps its own reply
 * language (the detected question language) — e.g. platform English + question
 * in Spanish → the reply and its button stay Spanish. A message generated under
 * a PREVIOUS platform language re-localizes to the current one, so the visible
 * history stays coherent with the platform switch.
 */
export function historyButtonLanguage(opts: {
  platformLanguage: AssistantLang;
  messageLanguage?: AssistantLang;
  createdUnderLanguage?: AssistantLang;
}): AssistantLang {
  if (!opts.messageLanguage || !opts.createdUnderLanguage) return opts.platformLanguage;
  return opts.platformLanguage === opts.createdUnderLanguage
    ? opts.messageLanguage
    : opts.platformLanguage;
}
