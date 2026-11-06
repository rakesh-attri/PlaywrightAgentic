import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";
import { storySchema } from "./models.js";
import { runPath, json } from "./files.js";
import { Knowledge } from "./knowledge.js";
import { executeSuite } from "./execution.js";
const server = new McpServer({ name: "playwright-agentic", version: "0.2.0" });
const mode = z.enum(["demo", "live"]).default("demo");
const response = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
});
server.registerTool(
  "create_test_plan",
  {
    description:
      "Create cases, plan, traceability and OKF knowledge. Does not execute live tests.",
    inputSchema: { story: storySchema, mode },
  },
  async ({ story, mode }) => {
    const { build } = await import("./workflow.js");
    const run = await build(story, mode, false, false);
    return response({
      runId: run.id,
      coverage: run.coverage,
      blocked: run.blocked,
    });
  },
);
server.registerTool(
  "run_suite",
  {
    description:
      "Run a suite headlessly. Live execution requires exact-plan approval and JWT auth.",
    inputSchema: { runId: z.string(), mode },
  },
  async ({ runId, mode }) => response(await executeSuite(runPath(runId), mode)),
);
server.registerTool(
  "search_knowledge",
  {
    description: "Retrieve approved source chunks; excludes generated drafts.",
    inputSchema: { question: z.string(), project: z.string(), mode },
  },
  async ({ question, project, mode }) =>
    response(await new Knowledge(mode).search(question, project)),
);
server.registerTool(
  "read_run_status",
  {
    description: "Read latest persisted run status.",
    inputSchema: { runId: z.string() },
  },
  async ({ runId }) =>
    response(json(path.join(runPath(runId), "summary.json"))),
);
await server.connect(new StdioServerTransport());
