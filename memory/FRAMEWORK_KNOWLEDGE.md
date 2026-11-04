# Framework knowledge base

This is reviewed engineering memory. Agents read it before planning, generating or healing. It does not define Salesforce business expectations and it does not modify a model's weights. Record a lesson only after reproducing the issue, fixing its cause and linking a regression check. Runtime incidents are unverified until reviewed; never index them as approved facts.

## 2026-11-04 — Keep requirements independent from observations

- Lesson: UI behavior identifies controls; acceptance criteria establish expected outcomes. A model mapping AC1 onto a case is not evidence that the assertion verifies AC1.
- Evidence: Framework review distinguishes schema checks, semantic DeepEval checks and actual browser execution.
- Regression: unit/core.test.ts (assertion presence, criterion references and healer invariants).

## 2026-11-04 — List items may have no accessible name

- Lesson: Do not assume a list item's text is its accessible name. The initial fixture tests using getByRole('listitem', {name: rowText}) failed. Use observed accessible names or exact text locators when appropriate.
- Evidence: Earlier fixture run failed to locate rows; exact-text checks passed while preserving expected values.
- Regression: examples/account-story.json and four headless demo scenarios.

## 2026-11-04 — Reporter folder and filename are separate

- Lesson: reportingLabs outputFolder holds the directory; outputFile is a filename such as index.html. Passing an absolute path as outputFile produced an invalid joined path.
- Evidence: Corrected reporter configuration generated the actual HTML and JSON report.
- Regression: unit/core.test.ts and demo report-existence checks in CI.

## 2026-11-04 — JWT API tokens and browser sessions are different

- Lesson: Do not inject a JWT bearer access token into cookies and assume Salesforce UI authentication. Use the supported Single Access UI Bridge on My Domain/Experience site with suitable scope, then verify an authenticated marker and capture storageState.
- Evidence: Salesforce JWT and UI Bridge documentation linked in docs/AUTHENTICATION.md.
- Regression: unit/auth.test.ts (claims, signing, token/bridge sequence, failure handling).

## 2026-11-04 — Demo vectors are not semantic embeddings

- Lesson: A lexical hash vector exercises persistence/search but does not establish semantic retrieval quality. Live mode uses embedding-model vectors stored in Chroma with their text and source metadata. Keep incompatible embedding spaces in separate collections.
- Evidence: Explicit demo/live provider separation in src/knowledge.ts.
- Regression: unit/knowledge.test.ts; optional real Chroma smoke test.

## 2026-11-04 — Persist the result of direct MCP runs

- Lesson: run_suite must update summary.json before read_run_status returns. Otherwise an outer coding agent sees stale not_run status after a successful execution.
- Evidence: Status persistence is implemented inside executeSuite rather than relying only on the graph reporter.
- Regression: scripts/check-reports.ts checks actual saved execution state.

## How agents add a verified lesson

Use `npm run sfqa -- memory-record --issue "..." --lesson "..." --evidence "..." --regression unit/core.test.ts`, inspect the diff and include the real regression result in the PR. Avoid duplicates and remove obsolete advice only with replacement evidence. Never record keys, tokens, session URLs, passwords, customer data or raw private traces. Do not silently promote runtime logs to this file.

## 2026-11-04 — Execute SDK code when checking dependency compatibility

- Lesson: Type checking an SDK import is insufficient. DeepEval 0.9.24, 0.9.23 and 0.9.17 imported but their metric startup called a missing telemetry export (`inComponentScope`). Pin the verified native TypeScript SDK release 0.9.9, retain the explicit @sentry/node dependency required by its telemetry import, and test actual metrics before upgrading. Keep DeepEval's LangChain peer version compatible and pin the compatible LangGraph checkpoint dependency.
- Evidence: ExactMatchMetric failed with a runtime TypeError on the newer releases; the real metric scored matching/different fixture output correctly on 0.9.9. No library metric code was patched.
- Regression: unit/evaluation.test.ts exercises actual SDK metric execution. Fixture judges test wiring, not real model quality.

## 2026-11-04 — Avoid unnecessary Unix sockets in constrained runtimes

- Lesson: Use `node --import tsx` for framework CLI/MCP child processes. The tsx CLI attempted an IPC Unix socket that this execution environment disallows. The custom browser MCP server uses the same pinned Playwright launcher without a separate browser binding server.
- Evidence: Earlier tsx CLI startup failed with EPERM; the node import-loader path completed the full MCP-driven demo.
- Regression: npm run demo and npm run check:chroma exercise both child MCP servers and the browser runner.

## 2026-11-04 — Bind the local Chroma check to explicit IPv4

- Lesson: Start the native Chroma CLI with `--host 127.0.0.1` and connect the client to the same host. Its default localhost startup in this runtime created SQLite files but did not provide a reachable IPv4 heartbeat; an explicit host made the server reachable. Do not treat a startup banner as proof of readiness.
- Evidence: scripts/check-chroma.ts waits for an actual heartbeat, stores a canary, restarts the native server and retrieves the canary before running CRUD/browser checks.
- Regression: scripts/check-chroma.ts; unit/knowledge.test.ts actual server path.
