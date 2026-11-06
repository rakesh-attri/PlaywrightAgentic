import fs from "node:fs";
import path from "node:path";
import { root, json } from "../src/files.js";
const runs = fs
  .readdirSync(path.join(root, "artifacts"))
  .filter((id) =>
    fs.existsSync(path.join(root, "artifacts", id, "playwright.json")),
  )
  .sort();
const id = process.argv[2] || runs.at(-1);
if (!id) throw Error("No browser run found");
const dir = path.join(root, "artifacts", id),
  report = json(path.join(dir, "playwright.json")),
  status = json(path.join(dir, "summary.json"));
if (
  report.stats.unexpected ||
  report.stats.skipped ||
  report.stats.expected !== 4 ||
  status.execution.passed !== true
)
  throw Error(
    "Expected 4 actual passed tests, zero skipped, persisted successful status",
  );
for (const file of [
  "playwright-html/index.html",
  "reporting-labs/index.html",
  "junit.xml",
])
  if (!fs.existsSync(path.join(dir, file)))
    throw Error("Missing report " + file);
console.log(
  JSON.stringify(
    {
      runId: id,
      stats: report.stats,
      headless: status.execution.headless,
      reportsVerified: true,
    },
    null,
    2,
  ),
);
