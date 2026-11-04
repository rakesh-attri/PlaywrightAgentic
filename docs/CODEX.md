# Run this repository using Codex

Use Codex to inspect/change source, call this repository's MCP tools and run the CLI. The framework itself is ordinary Node.js/TypeScript and can also run from PowerShell, Bash or GitHub Actions.

## 1. Open the repository

Use `rakesh-attri/PlaywrightAgentic`, selecting the `codex/typescript-salesforce-framework` branch until it is merged. Open/clone the repository in your Codex environment, or extract the delivered ZIP into a local folder and open that folder in the Codex CLI/IDE.

Start with this task:

> Read AGENTS.md, README.md and memory/FRAMEWORK_KNOWLEDGE.md. Install locked Node dependencies and Chromium, run typecheck and unit checks, then run npm run demo and npm run check:reports. Report actual pass/fail and the generated report paths. Use headless mode for every browser. Do not assume this validates Salesforce authentication or live AI quality.

For Linux/Codex setup:

```bash
bash scripts/setup-codex.sh
npm run demo
npm run check:reports
```

For Windows, use Node.js 22+ and the README's `npm ci` / `npx playwright install chromium` commands. No Docker or Python is needed. `SFQA_BROWSER_EXECUTABLE` can point to an already installed compatible Chromium binary when the environment supplies one; prefer the browser downloaded for pinned Playwright in a normal environment. Do not set `PWDEBUG` or enable headed/UI modes.

The demo does not require network access after packages/browser are installed. Live mode requires network access to your Salesforce domains, model/embedding provider and Chroma server/Cloud. Configure those in the execution environment's supported secret/variable settings. Do not put secrets into prompts or a public repository. An environment may expose setup-only secrets differently from agent/runtime secrets; verify availability at the phase that invokes the framework rather than assuming it.

## 2. Connect the local framework MCP server

```bash
npm run codex:configure
```

This creates ignored project `.codex/config.toml` containing absolute Node/loader/server paths and the four enabled framework tools. It refuses to overwrite an existing file; merge the printed settings manually if your project already has configuration. The generated file contains paths, not API credentials; secrets are read from the process environment or root `.env`.

For Codex CLI/IDE, open the project as trusted according to Codex's normal project trust flow, reload the session and inspect `/mcp`. Project-level MCP configuration is loaded only for trusted projects. Tool availability in other Codex/Work cloud surfaces depends on that environment's supported MCP configuration. If local stdio MCP is not exposed there, Codex can still invoke the same CLI through its terminal.

The server process is `node --import <tsx-loader> <absolute-src/tool-server.ts>`, not the `tsx` CLI. It communicates only through MCP stdio; diagnostic output goes to stderr. No HTTP MCP endpoint or inbound port is needed for this connection.

Tools:

| Tool | Input | Result |
|---|---|---|
| `create_test_plan` | `story` object, `mode` = demo/live | Run ID, draft plan/docs, coverage and blocked status |
| `search_knowledge` | `question`, `project`, `mode` | Approved source excerpts and IDs |
| `run_suite` | `runId`, `mode` | Actual browser exit code and persisted status; live exact-plan approval required |
| `read_run_status` | `runId` | Latest saved summary, including direct MCP execution results |

`create_test_plan` does not run live tests or invoke the optional judge. Use `npm run sfqa -- evaluate RUN_ID` if you want DeepEval scoring for an MCP-created plan, review that output and then approve the exact plan. The graph invokes its own bounded browser MCP service for observations.

## 3. Generate and run a real Salesforce story

Complete [AUTHENTICATION.md](AUTHENTICATION.md), prepare an approved source story and configure semantic RAG/model credentials. Then ask Codex:

> Read the framework knowledge base. Build a live test plan for stories/SF-101.json with evaluation enabled. Inspect the plan, retrieved sources, observed UI controls, criteria mappings and judge reasons. Identify missing business expectations and unsupported interactions. Return the exact run ID and reviewable files. Do not claim the criteria mapping alone proves test adequacy.

Equivalent command:

```bash
npm run sfqa -- build stories/SF-101.json --mode live --evaluate
```

After the plan is reviewed, approve and run it:

```bash
npm run sfqa -- approve RUN_ID
npm run sfqa -- run RUN_ID --mode live
```

If you have already explicitly authorized the reviewed plan in the same Codex session, Codex should carry out those commands without asking again. The framework still requires its concrete approval digest before live execution. Authentication is generated automatically, headlessly, with JWT/UI Bridge. No manual storageState capture is part of the workflow.

## 4. Investigate failures and record lessons

Ask Codex:

> Read this run's execution.log and failed-test evidence. Classify product behavior, data/auth issues and locator failures. Preserve all expected outcomes. Propose only evidence-supported action-locator changes through the healer. Fix verified framework defects, run the relevant regression checks and append a concise evidence-backed lesson to memory/FRAMEWORK_KNOWLEDGE.md. Leave unverified incidents untrusted.

```bash
npm run sfqa -- heal RUN_ID --mode live
npm run sfqa -- apply-heal RUN_ID
# Review changes, rerun evaluation if needed, then:
npm run sfqa -- approve RUN_ID
npm run sfqa -- run RUN_ID --mode live
```

The healer does not automatically turn a failed run green. Applying a repair removes approval; unchanged failed assertions continue to fail if the application is wrong. Adding an unrelated wait/skip or weakening an expected value is prohibited by the contract.

## 5. GitHub Actions

The source workflow `.github/workflows/qa.yml` provides:

- PR/push checks: locked install, Chromium dependencies, typecheck, unit checks, four headless fixture tests, HTML/JSON/JUnit report validation.
- Separate Linux real-Chroma job: persistent native server restart, CRUD/filter checks and four headless MCP-driven fixture tests.
- Manual `live` mode: run a committed reviewed bundle using JWT environment secrets, with no manually captured browser session.

Export a reviewed bundle locally:

```bash
npm run sfqa -- export-review RUN_ID
```

Inspect `reviewed/RUN_ID/{story.json,plan.json,approval.json}` for test data and commit those files. In GitHub, create the environment `salesforce-qa`, configure `SF_JWT_PRIVATE_KEY`, `SF_CLIENT_ID`, `SF_USERNAME` secrets and the `SF_*` variables used by the workflow. Optional GitHub environment reviewers/branch restrictions are controlled by your repository administrator. From Actions, dispatch `Salesforce agentic QA` with `mode=live` and the committed bundle directory. This executes an already reviewed plan and does not regenerate it using an LLM during CI.

Live plan generation/RAG evaluation may also be run in an appropriately configured private job later; the provided live job does not need model or Chroma access. Live reports remain on the job runner rather than being uploaded automatically. The provided offline jobs upload demo artifacts only, excluding `.auth`, `.env`, private keys and databases.

GitHub access was granted after the initial HTTP 403. Source is published on the review branch `codex/typescript-salesforce-framework` with a pull request to `main`. Select that branch for Codex work until the PR is merged. The ZIP includes `.github/workflows` and `AGENTS.md`; drag-and-drop interfaces may hide dot-directories, so prefer Git or an editor.

## Optional upstream Playwright agents

The pinned Playwright version supports `npx playwright init-agents --loop=codex` (also available as `npm run agents:init`). This generates upstream planner/generator/healer coding-agent definitions. Those are separate from this framework's LangGraph runtime roles and can generate a different workflow. They are optional and are not required for the tested path. Review their generated files/configuration before adopting them, and preserve this repository's headless, JWT, fixed-runner and memory rules. Do not assume upstream generated instructions enforce this project's constraints automatically.

## Official Codex references

- [Model Context Protocol configuration](https://learn.chatgpt.com/docs/extend/mcp)
- [Codex cloud environment setup](https://learn.chatgpt.com/docs/environments/cloud-environment)

Configuration capabilities vary by the Codex surface. Use the terminal commands when a surface does not expose project-local MCP servers.
