import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { workspaceRoot } from "./paths";

// Each run owns fresh stores; no reset can touch a developer's learning data.
const directory = mkdtempSync(join(tmpdir(), "odyssey-atlas-"));

export default defineConfig({
  testDir: ".",
  testMatch: "practice-atlas.spec.ts",
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:19431",
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
          args: ["--no-sandbox"],
        }
      : undefined,
  },
  webServer: [
    {
      command: "node playwright/atlas-provider.mjs",
      cwd: join(workspaceRoot(), "webapp"),
      url: "http://127.0.0.1:19432/health",
      reuseExistingServer: false,
    },
    {
      command: "pnpm exec next start --hostname 127.0.0.1 --port 19431",
      cwd: join(workspaceRoot(), "webapp"),
      url: "http://localhost:19431",
      reuseExistingServer: false,
      env: {
        NODE_OPTIONS: `--import ${join(workspaceRoot(), "webapp/playwright/atlas-fetch.mjs")}`,
        ODYSSEY_DB_PATH: join(directory, "learning.db"),
        ODYSSEY_CURRICULUM_DB_PATH: join(directory, "curriculum.db"),
        ODYSSEY_SEED_CATALOG: "1",
        ODYSSEY_APP_ORIGIN: "http://localhost:19431",
        ODYSSEY_ENABLE_PRODUCTION_PARENT_BOOTSTRAP: "1",
        ODYSSEY_PARENT_BOOTSTRAP_USERNAME: "atlas-parent",
        ODYSSEY_PARENT_BOOTSTRAP_PASSWORD: "atlas-parent-password",
        ODYSSEY_ENABLE_PRODUCTION_ADMIN_BOOTSTRAP: "0",
        OLLAMA_INTEGRATION: "1",
        PI_PROVIDER: "ollama",
        PI_MODEL: "atlas-fixture",
        PI_API_KEY: "fixture",
        OLLAMA_OPENAI_URL: "http://127.0.0.1:11434/v1",
      },
    },
  ],
});
