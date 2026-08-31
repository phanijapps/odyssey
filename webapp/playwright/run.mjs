import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

// Next rewrites this tracked generated reference when development mode starts.
// Restore the caller's exact version even when the browser suite fails.
const nextEnvPath = resolve("next-env.d.ts");
const originalNextEnv = existsSync(nextEnvPath)
  ? readFileSync(nextEnvPath, "utf8")
  : undefined;

try {
  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "playwright", "test"],
    { env: process.env, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (originalNextEnv !== undefined)
    writeFileSync(nextEnvPath, originalNextEnv);
}
