import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    env: {
      // Fake, obviously-invalid keys so modules that require configuration
      // (env.ts, the SDK factory) initialize under test.
      NEXT_PUBLIC_BT_API_KEY: "key_test_us_pub_fake_for_unit_tests",
    },
  },
});
