import { describe, expect, it } from "vitest";
import { existingOrFirst } from "./selection";

describe("existingOrFirst", () => {
  it("keeps a selection that remains in the registry", () => {
    expect(existingOrFirst("alw_2", ["alw_1", "alw_2"])).toBe("alw_2");
  });

  it("falls back after reset or cascade deletion removes the selection", () => {
    expect(existingOrFirst("alw_deleted", ["alw_surviving"])).toBe("alw_surviving");
    expect(existingOrFirst("alw_deleted", [])).toBe("");
  });
});
