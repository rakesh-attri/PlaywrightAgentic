import { defineConfig } from "vitest/config";
process.env.DEEPEVAL_TELEMETRY_OPT_OUT = "YES";
export default defineConfig({
  test: { include: ["unit/**/*.test.ts"], fileParallelism: false },
});
