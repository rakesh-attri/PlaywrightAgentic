# PlaywrightAgentic repository instructions

Read README.md, memory/FRAMEWORK_KNOWLEDGE.md and docs/CODEX.md before changing the framework. Record verified engineering lessons with evidence and a regression reference in memory/FRAMEWORK_KNOWLEDGE.md; unverified incidents remain runtime diagnostics. Do not treat memory as Salesforce business requirements or as model training.

All framework, authentication, retrieval, orchestration, MCP and evaluation source must be TypeScript/JavaScript. No Python framework or Python evaluation bridge. Playwright browser execution is always headless; do not add headed, debug, UI-runner or interactive login fallbacks. JWT plus UI Bridge must fail visibly if org policy requires stronger authentication. Keep credentials and storageState ignored.

Use npm ci; npm run typecheck; npm test; npm run demo. Linux/Codex setup is bash scripts/setup-codex.sh. npm run demo is an explicitly labeled local-index fixture smoke test. To test actual persistent Chroma, start npm run chroma on a supported host and use npm run demo:chroma. Use Chroma Cloud or a remote Chroma server on unsupported native platforms. Neither fixture smoke test proves Salesforce or semantic AI correctness.

Story criteria define expected outcomes. Generated documents are draft. Never fabricate test results, weaken assertions or skip failed tests to make the suite green. Extend the typed action schema and runner together. The healer can propose only non-assertion action-locator changes, followed by review and exact-plan reapproval. Complete the user's authorized fixes without adding new confirmation flows.

Test model-independent changes without paid API calls where possible. Report unrun live authentication/model/evaluation checks explicitly. Pin latest stable Playwright when updating and record its resolved npm version. Keep other versions mutually compatible, including DeepEval's LangChain peer requirement.

GitHub source publication is authorized to rakesh-attri/PlaywrightAgentic on a review branch. Do not force-push, alter repository visibility or include .env, keys, storageState, databases or runtime artifacts. Report external permission failures accurately.
