import { describe, expect, it } from "vitest";
import { validatePassword } from "@/lib/passwordPolicy";

describe("validatePassword (ORA password policy)", () => {
  it("accepts a valid password: exactly 8 chars with letter, number and special char", () => {
    expect(validatePassword("Ora8#x2k")).toBeNull();
    expect(validatePassword("Ab1!cdef")).toBeNull();
  });

  it("rejects empty passwords", () => {
    expect(validatePassword("")).toBe("passwordPolicy.empty");
  });

  it("rejects lengths other than exactly 8", () => {
    expect(validatePassword("Ora8#x2")).toBe("passwordPolicy.length");
    expect(validatePassword("Ora8#x2kq")).toBe("passwordPolicy.length");
  });

  it("rejects spaces", () => {
    expect(validatePassword("Ora 8#xk")).toBe("passwordPolicy.spaces");
  });

  it("rejects passwords without a letter", () => {
    expect(validatePassword("1234#567")).toBe("passwordPolicy.letter");
  });

  it("rejects passwords without a number", () => {
    expect(validatePassword("abcd#efg")).toBe("passwordPolicy.number");
  });

  it("rejects passwords without a special character", () => {
    expect(validatePassword("abcd1234")).toBe("passwordPolicy.special");
  });
});
