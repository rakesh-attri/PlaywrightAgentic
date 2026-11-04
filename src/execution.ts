import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { root, json, write } from "./files.js";
import { coverage, storySchema, planSchema, type Mode } from "./models.js";
import { digest, generate, report } from "./documents.js";
import { ensureAuthentication } from "./auth.js";
export async function executeSuite(dir: string, mode: Mode) {
  const story = storySchema.parse(json(path.join(dir, "story.json"))),
    plan = planSchema.parse(json(path.join(dir, "plan.json")));
  if (!coverage(story, plan).complete)
    throw Error("Incomplete plan blocks execution");
  const previous = fs.existsSync(path.join(dir, "summary.json"))
    ? json(path.join(dir, "summary.json"))
    : {};
  if (previous.mode && previous.mode !== mode)
    throw Error("Cannot switch execution mode");
  if (
    fs.existsSync(path.join(dir, "evaluation.json")) &&
    json(path.join(dir, "evaluation.json")).passed === false
  )
    throw Error("Failed evaluation blocks execution");
  if (mode === "live") {
    if (
      !fs.existsSync(path.join(dir, "approval.json")) ||
      json(path.join(dir, "approval.json")).digest !== digest(dir)
    )
      throw Error("Review exact plan then run approve RUN_ID");
    await ensureAuthentication();
  }
  generate(dir);
  const env = {
    ...process.env,
    SFQA_ROOT: root,
    SFQA_MODE: mode,
    SFQA_RUN_DIR: dir,
    SFQA_RUN_ID: path.basename(dir),
  };
  const result = await new Promise<{ exitCode: number; log: string }>(
    (resolve, reject) => {
      const proc = spawn(
        process.execPath,
        [
          path.join(root, "node_modules/@playwright/test/cli.js"),
          "test",
          path.basename(dir) + ".spec.ts",
        ],
        { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] },
      );
      let log = "";
      const timer = setTimeout(() => {
        proc.kill();
        reject(Error("Browser suite exceeded 15-minute budget"));
      }, 900000);
      proc.stdout.on("data", (b) => (log += b.toString()));
      proc.stderr.on("data", (b) => (log += b.toString()));
      proc.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      proc.on("close", (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? 1, log });
      });
    },
  );
  fs.writeFileSync(path.join(dir, "execution.log"), result.log);
  const execution = {
    passed: result.exitCode === 0,
    exitCode: result.exitCode,
    jsonReport: path.join(dir, "playwright.json"),
    headless: true,
  };
  report(dir, { ...previous, mode, execution });
  return execution;
}
