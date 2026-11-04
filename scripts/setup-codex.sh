#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
npm ci
if [[ -n "${SFQA_BROWSER_EXECUTABLE:-}" ]]; then
  test -x "$SFQA_BROWSER_EXECUTABLE"
else
  npx playwright install --with-deps chromium
fi
npm run typecheck
npm test
