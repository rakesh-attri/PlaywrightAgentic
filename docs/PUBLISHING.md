# Source publication and review

Repository: [rakesh-attri/PlaywrightAgentic](https://github.com/rakesh-attri/PlaywrightAgentic).

The original upload attempt returned HTTP 403. After repository access was granted, write access was verified with a bootstrap README commit on `main`. The complete TypeScript framework is published on `codex/typescript-salesforce-framework` for review, with a pull request against `main`. No credentials, browser storageState, database contents or runtime reports belong in the source branch.

Clone and select the framework branch until it is merged:

```bash
git clone https://github.com/rakesh-attri/PlaywrightAgentic.git
cd PlaywrightAgentic
git switch codex/typescript-salesforce-framework
npm ci
npx playwright install chromium
npm run typecheck
npm test
npm run demo
```

See the PR checks and Actions tab for actual hosted CI status. The workflow runs offline demo and real Chroma integration checks; neither requires Salesforce/model credentials. The `live` job is manual and needs a reviewed bundle and the `salesforce-qa` environment configuration. See [CODEX.md](CODEX.md) and [AUTHENTICATION.md](AUTHENTICATION.md).

Future changes should use review branches and PRs. Do not force-push or overwrite unrelated existing source. Preserve existing files when updating the framework. The repository is public: keep `.env`, keys, `.auth`, databases, customer data and private business stories out of commits. The supplied `.gitignore` excludes runtime state and credentials.

A downloaded source ZIP can also be used locally. Extract it, open a terminal inside its `PlaywrightAgentic` folder and start with `npm ci`. Its sibling `demo-report` folder is sample evidence and should not be copied into the source repository.
