import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = process.cwd(),
  dir = path.join(root, ".codex"),
  file = path.join(dir, "config.toml");
fs.mkdirSync(dir, { recursive: true });
if (fs.existsSync(file))
  throw Error(
    "Existing Codex configuration preserved. Merge settings manually.",
  );
fs.writeFileSync(
  file,
  `[mcp_servers.salesforce_qa]\ncommand = ${JSON.stringify(process.execPath)}\nargs = ["--import", ${JSON.stringify(pathToFileURL(path.join(root, "node_modules/tsx/dist/loader.mjs")).href)}, ${JSON.stringify(path.join(root, "src/tool-server.ts"))}]\nstartup_timeout_sec = 30\ntool_timeout_sec = 1200\nenabled_tools = ["create_test_plan", "search_knowledge", "run_suite", "read_run_status"]\n\n[mcp_servers.salesforce_qa.env]\nSFQA_ROOT = ${JSON.stringify(root)}\nDOTENV_CONFIG_PATH = ${JSON.stringify(path.join(root, ".env"))}\n`,
);
console.log(
  "Generated ignored project MCP configuration. Open trusted project and inspect /mcp.",
);
