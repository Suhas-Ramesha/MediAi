import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["shared/mediai/**/*.test.ts", "server/**/*.test.ts"],
    environment: "node",
  },
});
