import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { parseFeedbackScreenshots } from "@/lib/feedback/admin";

const shot = () => "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

describe("parseFeedbackScreenshots — recovery of attached captures", () => {
  it("recovers screenshots persisted inside context.screenshots", () => {
    const shots = [shot(), shot()];
    const out = parseFeedbackScreenshots({ screenshots: shots } as never);
    expect(out).toEqual(shots);
  });

  it("returns the list for 1 and 3 captures", () => {
    expect(parseFeedbackScreenshots({ screenshots: [shot()] } as never)).toHaveLength(1);
    expect(parseFeedbackScreenshots({ screenshots: [shot(), shot(), shot()] } as never)).toHaveLength(3);
  });

  it("returns empty for reports without screenshots or with malformed data", () => {
    expect(parseFeedbackScreenshots({} as never)).toEqual([]);
    expect(parseFeedbackScreenshots(null as never)).toEqual([]);
    expect(parseFeedbackScreenshots({ screenshots: "not-an-array" } as never)).toEqual([]);
    expect(parseFeedbackScreenshots({ screenshots: ["", 42] } as never)).toEqual([]);
  });
});
