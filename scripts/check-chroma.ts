import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { root, json, write } from "../src/files.js";
import { Knowledge } from "../src/knowledge.js";
import { withServer, resultText } from "../src/mcp-client.js";

// Bounded integration check: actual native Chroma, persistence across restart,
// CRUD/filter regression tests, then MCP-driven browser/report smoke test.
const port = process.env.SFQA_CHECK_CHROMA_PORT || "8019";
const project = "persistence-" + crypto.randomUUID();
const folder = path.join(root, ".state/chroma-integration");
fs.mkdirSync(folder, { recursive: true });
const log = fs.openSync(path.join(folder, "server.log"), "a");
Object.assign(process.env, {
  CHROMA_HOST: "127.0.0.1",
  CHROMA_PORT: port,
  CHROMA_SSL: "false",
  SFQA_VECTOR_BACKEND: "chroma",
  SFQA_CHROMA_TEST: "1",
});
delete process.env.CHROMA_API_KEY;
process.env.CHROMA_TENANT = "default_tenant";
process.env.CHROMA_DATABASE = "default_database";
async function start() {
  const server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/chromadb/dist/cli.mjs"),
      "run",
      "--host",
      "127.0.0.1",
      "--path",
      path.join(folder, "db"),
      "--port",
      port,
    ],
    {
      cwd: root,
      stdio: ["ignore", log, log],
      env: { ...process.env, RUST_LOG: "error" },
    },
  );
  let spawnError: Error | undefined;
  server.on("error", (e) => (spawnError = e));
  for (let i = 0; i < 80; i++) {
    if (spawnError) throw spawnError;
    if (server.exitCode !== null)
      throw Error(
        "Native Chroma exited; inspect .state/chroma-integration/server.log",
      );
    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/v2/heartbeat`,
        { signal: AbortSignal.timeout(500) },
      );
      if (response.ok) return server;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  server.kill("SIGKILL");
  throw Error("Chroma startup timeout: inspect its local server log");
}
async function stop(server: ChildProcess) {
  if (server.exitCode !== null) return;
  await new Promise<void>((r) => {
    server.once("close", () => r());
    server.kill("SIGKILL");
  });
}
async function command(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const c = spawn(process.execPath, args, {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    c.once("error", reject);
    c.once("close", (code) =>
      code === 0 ? resolve() : reject(Error("Check failed: " + args.join(" "))),
    );
  });
}
let server: ChildProcess | undefined;
try {
  server = await start();
  const kb = new Knowledge("demo");
  await kb.ingest(
    "canary",
    "Persistent Chroma account knowledge",
    project,
    "approved",
  );
  await stop(server);
  server = await start();
  const hits = await kb.search("account knowledge", project);
  if (hits[0]?.text !== "Persistent Chroma account knowledge")
    throw Error(
      "Chroma did not persist indexed text/vector metadata across restart",
    );
  await kb.remove("canary", project);
  console.log("Actual Chroma persistence after restart: passed");
  await command([
    path.join(root, "node_modules/vitest/vitest.mjs"),
    "run",
    "unit",
  ]);
  await command([
    "--import",
    "tsx",
    "src/cli.ts",
    "build",
    "examples/account-story.json",
    "--mode",
    "demo",
    "--execute",
    "--chroma",
  ]);
  await command(["--import", "tsx", "scripts/check-reports.ts"]);
  const id = fs
    .readdirSync(path.join(root, "artifacts"))
    .filter((id) =>
      fs.existsSync(path.join(root, "artifacts", id, "playwright.json")),
    )
    .sort()
    .at(-1)!;
  const dir = path.join(root, "artifacts", id);
  const drafts = await (
    await kb.collection()
  ).get({ where: { $and: [{ project: "DEMO-101" }, { status: "draft" }] } });
  if (
    !drafts.metadatas.some(
      (m) => m?.source === "draft:" + id + ":test-cases.md",
    )
  )
    throw Error("Generated case documents were not indexed as draft");
  // Reset the persisted summary, then run directly through MCP without the graph
  // reporter. This catches stale read_run_status responses after direct calls.
  write(path.join(dir, "summary.json"), {
    ...json<Record<string, unknown>>(path.join(dir, "summary.json")),
    execution: { status: "not_run" },
  });
  await withServer("tool-server.ts", {}, async (client) => {
    const names = (await client.listTools()).tools.map((t) => t.name);
    for (const name of [
      "create_test_plan",
      "search_knowledge",
      "run_suite",
      "read_run_status",
    ])
      if (!names.includes(name)) throw Error("Missing MCP tool " + name);
    const run = await client.callTool(
      { name: "run_suite", arguments: { runId: id, mode: "demo" } },
      undefined,
      { timeout: 900000 },
    );
    if (run.isError || !JSON.parse(resultText(run)).passed)
      throw Error("Direct MCP execution failed");
    const result = await client.callTool({
      name: "read_run_status",
      arguments: { runId: id },
    });
    if (
      result.isError ||
      JSON.parse(resultText(result)).execution.passed !== true
    )
      throw Error("Direct MCP status was stale");
  });
  console.log("Draft document indexing and direct MCP status: passed");
} finally {
  if (server) await stop(server);
  fs.closeSync(log);
}
