import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runtime tenant guard", () => {
  it("enables test affordances only for the exact test value", async () => {
    vi.stubEnv("BT_TENANT_TYPE", "test");
    await expect(GET().json()).resolves.toMatchObject({ tenantType: "test" });
  });

  it.each(["", "production", "prodution"])(
    "fails closed to production for %j",
    async (value) => {
      vi.stubEnv("BT_TENANT_TYPE", value);
      await expect(GET().json()).resolves.toMatchObject({ tenantType: "production" });
    },
  );
});
