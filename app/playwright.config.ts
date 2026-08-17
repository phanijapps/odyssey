import { defineConfig } from "@playwright/test";
import { join } from "node:path";

const databasePath = join(process.cwd(), ".playwright-parent.db");
const curriculumDatabasePath = join(process.cwd(), ".playwright-curriculum.db");

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  // A cold dev-server compile of the first route can consume most of the
  // default budget; journeys themselves are quick once warm.
  timeout: 60_000,
  // One shared dev server and database: spec files must not interleave
  // their journeys (direct test-process DB writes contend with the
  // server's session writes).
  workers: 1,
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
      ODYSSEY_CURRICULUM_DB_PATH: curriculumDatabasePath,
      // Keep the suite hermetic regardless of the developer's .env.local:
      // deterministic bank fallback, no cloud-model latency, no native store.
      OLLAMA_INTEGRATION: "0",
      ODYSSEY_ENGRAM_ARTIFACT: "disabled",
      // Disarm the native Engram loaders entirely (any blank ENGRAM_ value
      // makes getConfiguredEngramArtifact return null), so test answers can
      // never write signals into a developer-configured real store.
      ENGRAM_APPROVED_ROOT: "",
      ODYSSEY_ENABLE_LOCAL_PARENT_BOOTSTRAP: "1",
      ODYSSEY_PARENT_BOOTSTRAP_USERNAME: "e2e-parent",
      ODYSSEY_PARENT_BOOTSTRAP_PASSWORD: "e2e-parent-password",
    },
  },
});
