import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import reportingLabs from "./reporting-labs.config.js";
if (
  process.argv.some(
    (a) =>
      a === "--headed" ||
      a === "--debug" ||
      a === "--ui" ||
      a.startsWith("--headed="),
  ) ||
  (process.env.PWDEBUG && process.env.PWDEBUG !== "0")
)
  throw Error(
    "Headed/debug/UI browser modes are disabled. This framework always runs headless.",
  );
const dir = process.env.SFQA_RUN_DIR || path.resolve("artifacts/manual");
const live = process.env.SFQA_MODE === "live";
export default defineConfig({
  testDir: "./generated",
  workers: 1,
  retries: 0,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  timeout: 60000,
  expect: { timeout: 10000 },
  outputDir: path.join(dir, "test-results"),
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: path.join(dir, "playwright-html"), open: "never" },
    ],
    ["json", { outputFile: path.join(dir, "playwright.json") }],
    ["junit", { outputFile: path.join(dir, "junit.xml") }],
    ["reporting-labs", reportingLabs],
  ],
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
    storageState: live ? path.resolve(".auth/salesforce.json") : undefined,
    launchOptions: process.env.SFQA_BROWSER_EXECUTABLE
      ? { executablePath: process.env.SFQA_BROWSER_EXECUTABLE }
      : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: live
    ? undefined
    : {
        command: "node examples/demo-server.cjs",
        url: "http://127.0.0.1:8765",
        reuseExistingServer: true,
      },
});
