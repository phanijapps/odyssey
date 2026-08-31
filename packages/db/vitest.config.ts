import { mergeConfig } from "vitest/config";
import nodeTestConfig from "../../tooling/vitest-config/node";

export default mergeConfig(nodeTestConfig, {
  test: { setupFiles: ["./tests/setup.ts"] },
});
