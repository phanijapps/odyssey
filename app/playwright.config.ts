import { defineConfig } from "@playwright/test";
import { join } from "node:path";

const databasePath = join(process.cwd(), ".playwright-parent.db");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
          args: ["--no-sandbox"],
        }
      : undefined,
  },
  webServer: {
    command: "pnpm exec next dev --port 3000",
    port: 3000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      NODE_ENV: "development",
      ODYSSEY_DB_PATH: databasePath,
      ODYSSEY_ENABLE_LOCAL_PARENT_BOOTSTRAP: "1",
      ODYSSEY_PARENT_BOOTSTRAP_USERNAME: "e2e-parent",
      ODYSSEY_PARENT_BOOTSTRAP_PASSWORD: "e2e-parent-password",
    },
  },
});
