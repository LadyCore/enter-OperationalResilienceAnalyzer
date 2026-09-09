import { describe, expect, it } from "vitest";
import { parseAssistantSegments } from "./navigation";

describe("parseAssistantSegments — buttons keep the chronological order of the reply", () => {
  it("renders the navigation target immediately after the text that generated it", () => {
    const content = `Si deseas consultar las dependencias y señales de riesgo base de la organización sin ausencias simuladas:

⟶ Go to Análisis

Y también puedes ver el detalle por persona.`;

    const segments = parseAssistantSegments(content);
    expect(segments.map((s) => s.kind)).toEqual(["text", "target", "text"]);

    const first = segments[0]!;
    expect(first.kind === "text" && first.text).toContain("Si deseas consultar");

    const target = segments[1]!;
    expect(target.kind === "target" && target.path).toBe("/analysis");

    const last = segments[2]!;
    expect(last.kind === "text" && last.text).toContain("Y también puedes ver");
  });

  it("keeps an unrecognized marker line as plain text", () => {
    const content = `Texto.

⟶ Go to Zona Secreta

Fin.`;
    const segments = parseAssistantSegments(content);
    expect(segments.map((s) => s.kind)).toEqual(["text"]);
    expect(segments[0]!.kind === "text" && segments[0].text).toContain("Zona Secreta");
  });

  it("collapses consecutive blank lines and trims edges", () => {
    const content = `Hola



Mundo

⟶ Go to Tareas
`;
    const segments = parseAssistantSegments(content);
    expect(segments.map((s) => s.kind)).toEqual(["text", "target"]);
    expect(segments[0]!.kind === "text" && segments[0].text).toBe("Hola\n\nMundo");
    expect(segments[1]!.kind === "target" && segments[1].path).toBe("/tasks");
  });
});
