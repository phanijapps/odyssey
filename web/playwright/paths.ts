import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Resolves the monorepo root by walking up to the pnpm-workspace.yaml
 * marker — runtime state lives in <root>/data regardless of which package
 * runs the suite.
 */
export function workspaceRoot(): string {
  let directory = process.cwd();
  for (let hops = 0; hops < 8; hops += 1) {
    if (existsSync(join(directory, "pnpm-workspace.yaml"))) return directory;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return process.cwd();
}

const e2eDirectory = join(workspaceRoot(), "data", "e2e");

export const e2eLearningDatabasePath = join(
  e2eDirectory,
  ".playwright-parent.db",
);
export const e2eCurriculumDatabasePath = join(
  e2eDirectory,
  ".playwright-curriculum.db",
);
