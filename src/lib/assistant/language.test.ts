import { describe, expect, it } from "vitest";
import { detectLanguage, historyButtonLanguage } from "./language";

describe("detectLanguage — the reply follows the language of the user's question", () => {
  it("detects Spanish (accented characters + Spanish stopwords)", () => {
    expect(
      detectLanguage("¿Dónde puedo consultar qué personas tienen las competencias necesarias para cubrir a los ausentes?"),
    ).toBe("es");
    expect(detectLanguage("Hola, ¿cómo estás?")).toBe("es");
  });

  it("detects English", () => {
    expect(detectLanguage("Where can I see which people have the competencies needed to cover the absent ones?")).toBe("en");
    expect(detectLanguage("Hello, how are you?")).toBe("en");
  });

  it("returns null when the signal is ambiguous or absent (caller falls back to platform)", () => {
    expect(detectLanguage("")).toBeNull();
    expect(detectLanguage("12345")).toBeNull();
    expect(detectLanguage("...")).toBeNull();
  });
});

describe("historyButtonLanguage — buttons stay coherent with the current platform language", () => {
  it("keeps the reply language when generated under the current platform language", () => {
    // Platform English + question in Spanish → reply/button in Spanish.
    expect(historyButtonLanguage({ platformLanguage: "en", messageLanguage: "es", createdUnderLanguage: "en" })).toBe("es");
    // Platform Spanish + question in English → reply/button in English.
    expect(historyButtonLanguage({ platformLanguage: "es", messageLanguage: "en", createdUnderLanguage: "es" })).toBe("en");
    // Same languages.
    expect(historyButtonLanguage({ platformLanguage: "en", messageLanguage: "en", createdUnderLanguage: "en" })).toBe("en");
    expect(historyButtonLanguage({ platformLanguage: "es", messageLanguage: "es", createdUnderLanguage: "es" })).toBe("es");
  });

  it("re-localizes history generated under a previous platform language", () => {
    // Reply generated in English, then platform switched to Spanish.
    expect(historyButtonLanguage({ platformLanguage: "es", messageLanguage: "en", createdUnderLanguage: "en" })).toBe("es");
    // Reply generated in Spanish, then platform switched to English.
    expect(historyButtonLanguage({ platformLanguage: "en", messageLanguage: "es", createdUnderLanguage: "es" })).toBe("en");
  });

  it("falls back to the platform language when the message has no language info", () => {
    expect(historyButtonLanguage({ platformLanguage: "en" })).toBe("en");
    expect(historyButtonLanguage({ platformLanguage: "es", messageLanguage: "es" })).toBe("es");
  });
});
