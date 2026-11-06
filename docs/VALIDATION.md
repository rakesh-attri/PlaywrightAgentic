# Validation record — 2026-11-04

The validation environment used Node.js 24.22.1 on Linux, pinned `@playwright/test` 1.64.1, Chroma npm client/CLI 3.5.0 and native DeepEval TypeScript SDK 0.9.9. Dependencies were reinstalled with `npm ci` before the final checks. The framework source is JavaScript/TypeScript only.

## Completed checks

| Check | Evidence / result |
|---|---|
| TypeScript strict checks | `npm run typecheck` |
| Model-independent regression suite | 31 checks with actual Chroma integration enabled; 30 plus one explicitly optional Chroma check when using standalone `npm test` without a server |
| Authentication contracts | RS256 signature verification, 120-second JWT claims, mocked token→UI Bridge exchange, unsupported origin, failure handling, HTTPS configuration and PWDEBUG rejection |
| Requirements and healer | Explicit assertion requirement, duplicate/unknown criterion IDs, relative navigation only, no arbitrary action execution, exact-plan approval digest, repairs preserve assertions/inputs/scenarios |
| Local vector index | Stored vectors plus original text/hash metadata, project/draft filtering, source replacement and deletion |
| Actual Chroma | Native server heartbeat, canary indexed before stop, retrieved after server restart, actual vector query/CRUD and draft/project filtering |
| DeepEval SDK | Actual ExactMatchMetric scores matching/different outputs; real FaithfulnessMetric, AnswerRelevancyMetric and GEval plumbing with labeled fixture judge responses |
| LangGraph | All workflow roles traversed; event/checkpoint records and documents written |
| Browser/execution MCP | stdio server connection/tool calls; accessibility observations from actual Chromium; real suite exit status persisted |
| Browser tests | Four Account-fixture tests passed, zero skipped/flaky/unexpected; all browsers headless |
| Reports | Playwright HTML/JSON/JUnit and reportingLabs HTML files exist; index links to evidence |
| Codex configuration | `npm run codex:configure` generated project MCP TOML with absolute Node/loader paths and four enabled tools |

`npm run check:chroma` is the reproducible combined integration command. It starts/stops its own isolated native Chroma instance and executes the real browser path. It also verifies generated documentation is indexed as draft and that a **direct** `run_suite` MCP call updates `read_run_status` without relying on the outer graph reporter. That direct call repeats the same four fixture tests; it does not represent four additional business scenarios.

## Environment-specific browser installation

This runtime's standard Playwright browser CDN download returned invalid ZIP content. Validation used its available compatible Chromium binary through the documented `SFQA_BROWSER_EXECUTABLE` override. A normal workstation/CI should use `npx playwright install chromium` or `npx playwright install --with-deps chromium`. The GitHub workflow specifies that installation. Consult its actual Actions run for the result on the hosted runner; local browser evidence alone does not establish hosted-browser compatibility.

The first native Chroma startup used the default hostname and did not provide a reachable IPv4 heartbeat in this runtime. Explicit `--host 127.0.0.1` fixed that; the integration script waits for readiness before running checks. This is recorded in framework memory.

## Dependency compatibility findings

DeepEval 0.9.24, 0.9.23 and 0.9.17 imported and typechecked but failed when a metric called a missing telemetry export. The verified 0.9.9 release is pinned instead. Its undeclared `@sentry/node` telemetry import is supplied explicitly. No metric implementation is replaced or mocked; only the clearly labeled unit judge's responses are fixtures. Upgrade this dependency only after the runtime metric regressions pass.

DeepEval's exact LangChain core peer dependency is respected. A compatible LangGraph checkpoint package is overridden explicitly to prevent a newer transitive release from requiring a conflicting core version. `npm ls @langchain/core --depth=3` showed one compatible core version. Playwright remains pinned to the latest stable release verified from npm's `latest` dist-tag on the validation date; prerelease `next`/`beta` tags were not used.

## Not verified live

- No Salesforce connected/external app, certificate, user credentials or sandbox endpoints were supplied. Real JWT grant, UI Bridge authorization, storageState reuse and application tests are **not verified against your org**.
- No paid model/embedding credentials were supplied. Live LLM planning/tool selection/healing, semantic embedding quality and real judge scores are **not verified**. The demo uses deterministic reviewed cases and lexical vectors, including in the actual Chroma check.
- No full OKF validator/catalog service was executed. Generated concepts follow the minimal required `type` plus Markdown/frontmatter/link shape; optional advanced catalog/attestation/freshness features are not implemented.
- Initial GitHub upload returned HTTP 403. After repository access was granted, a bootstrap commit succeeded and the prepared source was published on a review branch. CI results are reported separately from the local checks above; consult the PR checks for their actual status.
- Upstream optional `playwright init-agents --loop=codex` support was checked in the CLI help; its generated agent workflow was not adopted or tested.

These distinctions are deliberate: mapped design coverage, fixture execution, actual database persistence and real model/org behavior are separate evidence categories.
