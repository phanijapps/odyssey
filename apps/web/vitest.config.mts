import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./test/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    // Browser journeys use Playwright's runner, never Vitest's module loader.
    include: [
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
      "components/**/*.test.tsx",
      "server/**/*.test.ts",
      "lib/**/*.test.ts",
    ],
    setupFiles: ["./test/sqlite-isolation.setup.ts"],
    env: {
      // Enables generic fixture accounts only for the Vitest process.
      ODYSSEY_TEST_FIXTURE_ACCOUNTS: "1",
    },
  },
});
