import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { targetSchema } from "./models.js";
import { launchHeadless, storageFile } from "./auth.js";
import { target } from "./runner.js";
import type { Browser, Page } from "@playwright/test";
const server = new McpServer({ name: "sfqa-browser", version: "0.2.0" });
let browser: Browser | undefined, page: Page | undefined;
const live = process.env.SFQA_MODE === "live",
  base = live ? process.env.SF_BASE_URL! : "http://127.0.0.1:8765";
const allowed = live
  ? (process.env.SF_ALLOWED_ORIGINS || "").split(",").map((x) => x.trim())
  : [new URL(base).origin];
async function active() {
  if (!page) {
    browser = await launchHeadless();
    const context = await browser.newContext(
      live ? { storageState: storageFile } : {},
    );
    await context.route("**/*", (r) =>
      r.request().isNavigationRequest() &&
      !allowed.includes(new URL(r.request().url()).origin)
        ? r.abort("blockedbyclient")
        : r.continue(),
    );
    page = await context.newPage();
  }
  return page;
}
const text = (value: string) => ({
  content: [{ type: "text" as const, text: value }],
});
server.registerTool(
  "browser_navigate",
  {
    description:
      "Navigate within the configured sandbox; use a relative application path.",
    inputSchema: { path: z.string() },
  },
  async ({ path }) => {
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
      throw Error("Relative paths only");
    const p = await active();
    const url = new URL(path, base);
    if (!allowed.includes(url.origin)) throw Error("Origin outside scope");
    await p.goto(url.href);
    return text(await p.locator("body").ariaSnapshot());
  },
);
server.registerTool(
  "browser_snapshot",
  { description: "Read current accessibility snapshot.", inputSchema: {} },
  async () => text(await (await active()).locator("body").ariaSnapshot()),
);
server.registerTool(
  "browser_click",
  {
    description:
      "Click a semantically identified observed control, then return its updated accessibility snapshot.",
    inputSchema: { target: targetSchema },
  },
  async ({ target: t }) => {
    const p = await active();
    await target(p, t).click();
    return text(await p.locator("body").ariaSnapshot());
  },
);
process.on("SIGTERM", () => {
  void browser?.close().finally(() => process.exit(0));
});
process.stdin.on("end", () => {
  void browser?.close();
});
await server.connect(new StdioServerTransport());
