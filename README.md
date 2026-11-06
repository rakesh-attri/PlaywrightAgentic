# PlaywrightAgentic — Salesforce agentic QA in TypeScript

Turn a Salesforce story and explicit acceptance criteria into a reviewed test plan, executable Playwright tests, traceability documents and reports. LangGraph coordinates the roles; MCP exposes bounded tools; Chroma stores embedding vectors **with their original chunks and source metadata**. Every browser runs headless.

Playwright is pinned to **1.64.1**, the npm `latest` stable release verified on 2026-11-04. All application, orchestration, authentication, retrieval, MCP and evaluation code is JavaScript/TypeScript. Node.js 22+ is required; Node.js 24 LTS is recommended. This project requires no Python or Docker.

The native DeepEval TypeScript SDK is pinned to **0.9.9** after runtime incompatibilities were found in newer releases; see [VALIDATION.md](docs/VALIDATION.md). The source is published to `codex/typescript-salesforce-framework` for review. Until it is merged, check out that branch using the commands below. See [PUBLISHING.md](docs/PUBLISHING.md) for the publication workflow.

## Start with the runnable demo

```bash
git clone https://github.com/rakesh-attri/PlaywrightAgentic.git
cd PlaywrightAgentic
git switch codex/typescript-salesforce-framework
npm ci
npx playwright install chromium
npm run typecheck
npm test
npm run demo
npm run check:reports
```

If using the downloaded ZIP, extract it and open a terminal in the extracted `PlaywrightAgentic` folder; start at `npm ci`. Linux CI/Codex can use `bash scripts/setup-codex.sh` to install browser system dependencies too.

The demo explores a **local Account training fixture** through the browser MCP server, creates four predefined reviewed scenarios and executes them through the framework MCP server. No Salesforce login, model credential or paid call is required. It checks create, required name, cancel and Industry selection. These are fixture requirements, **not claims about your Salesforce org's validation rules**.

The default demo uses an explicitly labeled local JSON vector index with deterministic lexical hash vectors. It does not demonstrate semantic LLM generation. For an actual Chroma server plus persistence/restart, CRUD/filter checks and the same browser/MCP flow:

```bash
npm run check:chroma
```

This command starts an isolated native Chroma server on `127.0.0.1:8019`, uses `.state/chroma-integration/db`, stops/restarts it to verify persistence, runs integration checks, runs the four browser tests and verifies reports. The native binary bundled by Chroma 3.5.0 supports Linux/macOS and Windows ARM64; **Windows x64 users should connect to Chroma Cloud or a remote Chroma server**. The normal demo still works on Windows x64. See [RAG.md](docs/RAG.md).

## Configure Salesforce and semantic RAG

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell). Configure the Salesforce app, certificate and preauthorized user using [AUTHENTICATION.md](docs/AUTHENTICATION.md), then fill in the environment variables. Never commit `.env`, private keys or `.auth/salesforce.json`.

Use Chroma Cloud or a persistent server. On a supported local host, in a separate terminal:

```bash
npm run chroma
```

For Cloud, configure `CHROMA_API_KEY`, `CHROMA_TENANT` and `CHROMA_DATABASE`. For a remote server use `CHROMA_HOST`, `CHROMA_PORT`, `CHROMA_SSL`, tenant and database. This starter's server client does not implement custom reverse-proxy authentication; use Chroma Cloud or extend the client for your deployment's authentication before exposing a server.

Set `OPENAI_API_KEY`, `SFQA_MODEL` to a model available to your API account, and `SFQA_EMBED_MODEL` (default `text-embedding-3-small`). The optional `SFQA_API_BASE` changes the LangChain chat/embedding endpoint; the DeepEval judge uses its own supported model configuration and defaults to the OpenAI API. A ChatGPT/Codex subscription does not configure these framework API credentials.

```bash
npm run auth
npm run sfqa -- build stories/SF-101.json --mode live --evaluate
```

`build` records a run ID. Inspect that run's `test-plan.md`, `test-cases.md`, `coverage.json`, `ui-observation.md`, `retrieval.json`, `plan.json` and `evaluation.json` under `artifacts/RUN_ID/`. Resolve missing criteria or unsupported interactions. The live planner may need a narrower starting page or additional approved knowledge; it does not guarantee that every Salesforce component can be automated from an arbitrary story.

After reviewing the exact story/plan:

```bash
npm run sfqa -- approve RUN_ID
npm run sfqa -- run RUN_ID --mode live
```

Live execution checks a digest of those exact files. A changed story/plan invalidates its approval. This protects your sandbox from running a newly generated plan without review. `build --mode live --execute` will consequently stop if the plan has not yet been approved; use the two-stage flow above.

## Input story

Create a JSON file such as `stories/SF-101.json`:

```json
{
  "id": "SF-101",
  "title": "Create an Account",
  "description": "As a sales user, I can create an Account in our QA sandbox.",
  "acceptanceCriteria": [
    { "id": "AC1", "text": "Saving an Account with a unique name creates a record showing that name." },
    { "id": "AC2", "text": "Saving without a name displays the agreed required-name validation message." }
  ]
}
```

Replace vague requirements such as “agreed message” with your actual approved expected text before execution. A live Markdown story can also be extracted into the schema by the configured model. JSON avoids that extra interpretation. Attach relevant object names, record types, personas, prerequisites and cleanup requirements. Keep real credentials/customer records out of stories.

## Agents and tools

| Role | Responsibility |
|---|---|
| Orchestrator | Bounded LangGraph workflow, stage events, diagnostic checkpoints and error reporting |
| Analyst | Validate/extract explicit story criteria |
| Knowledge curator / retriever | Version, chunk, embed, store and retrieve approved evidence |
| Explorer | Observe configured application controls through headless browser MCP |
| Planner | Produce structured scenarios grounded in story, evidence and observed controls |
| Reviewer | Validate criteria references, duplicate IDs, assertions and missing-information gates |
| Documenter | Plan, cases, data prerequisites, traceability and OKF documents |
| Generator | Generate TypeScript Playwright wrappers over the validated action runner |
| Evaluator | Optional DeepEval faithfulness, relevancy and requirement-assertion adequacy checks |
| Executor | Run the actual suite through MCP and persist its real exit status |
| Healer | Propose constrained action-locator repairs without changing assertions |
| Learning recorder / reporter | Record incidents, read reviewed lessons and publish local reports |

These are workflow roles: deterministic stages are ordinary functions; planning/exploration/healing use the configured LLM in live mode. They are not fourteen independent models. The graph writes diagnostic checkpoints, **not a durable crash-resume queue**.

Framework MCP tools: `create_test_plan`, `search_knowledge`, `run_suite`, `read_run_status`. Browser MCP tools: `browser_navigate`, `browser_snapshot`, `browser_click`. Both are local stdio TypeScript MCP servers. Browser tools use the same pinned Playwright version, storageState and headless launcher as the runner. See [ARCHITECTURE.md](docs/ARCHITECTURE.md) and [CODEX.md](docs/CODEX.md).

## Reports

Every completed run writes `artifacts/RUN_ID/index.html`, with links to the available evidence:

- Playwright HTML, JSON and JUnit results.
- [reportingLabs](https://reportinglabs.dev/) HTML/JSON report, implemented using [`reporting-labs`](https://github.com/naveenautomationlabs/reporting-labs).
- Test plan, test cases, test-data prerequisites, criteria-to-case CSV and OKF Markdown concepts.
- Retrieval excerpts/source hashes, agent events, DeepEval status and healing proposal/status.
- Screenshots and traces only for failed test execution; authentication itself is never traced.

Model scores, mapped design coverage and actual browser pass/fail are reported separately. `not_run` is not a passing AI score. Live reports/traces can contain sandbox data; publish only reviewed artifacts. Reporter history currently lives per run, not a consolidated cross-run trend database.

## Learning from mistakes

Read [memory/FRAMEWORK_KNOWLEDGE.md](memory/FRAMEWORK_KNOWLEDGE.md) before framework work. `AGENTS.md` instructs coding agents to do this. The runtime reads it before planning and healing and indexes it as engineering context. Run history and unverified incidents are recorded automatically in ignored JSONL files.

Promote a verified lesson after a reproduced failure, fix and regression check:

```bash
npm run sfqa -- memory-record --issue "Short issue title" --lesson "Verified prevention rule" --evidence "Run ID and observed result" --regression unit/core.test.ts
```

Review and commit that Markdown update with its actual test evidence. This is persistent retrieval/instruction memory; it is not model fine-tuning. Automatic raw incidents are not silently promoted into trusted business requirements.

## Healing and CI

Failures stay failures. `heal RUN_ID --mode live` writes a proposed plan. `apply-heal RUN_ID` accepts only action-locator changes validated against the original plan, removes approval and requires review/reapproval. Assertion targets, expectations, inputs, navigation, scenario order and criterion mappings cannot change through this path.

GitHub Actions runs type checks, unit checks, the offline browser demo, real Chroma integration and report verification on pushes/PRs. A manually dispatched `live` job runs only an already reviewed bundle from `reviewed/`, with a fresh JWT-generated storageState and GitHub environment secrets. See [CODEX.md](docs/CODEX.md) for commands and the CI configuration.

## Scope and extension points

Supported actions are explicit navigation, fill, click, native select, check, key press and web-first visibility/text/value/count/URL assertions. Exact semantic locators and optional iframe selectors are supported. Complex Lightning widgets may need extra observed clicks or a reviewed runner/schema extension. API data seeding/cleanup, multi-persona permission matrices, SOQL backend assertions, file transfer, visual/a11y audits and payment-provider harnesses are extension work, not claimed as completed features.

Use sandbox test data; add cleanup before large recurring runs. Start with one real story and inspect the evidence before increasing scope. n8n can trigger the CLI/CI and route notifications externally; it is not embedded here. Google Colab is not needed. See [VALIDATION.md](docs/VALIDATION.md) for what has actually been exercised.
