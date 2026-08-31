import { defineConfig } from "vitest/config";

/** Shared Vitest base for Node-environment packages. */
export const nodeTestConfig = defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});

export default nodeTestConfig;
