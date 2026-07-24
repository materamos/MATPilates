import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      include: ["server/src/**/*.ts", "shared/**/*.ts"],
    },
  },
});
