import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./src/test/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    env: {
      ODYSSEY_DB_PATH: ":memory:",
      // Enables generic fixture accounts only for the Vitest process.
      ODYSSEY_TEST_FIXTURE_ACCOUNTS: "1",
    },
  },
});
