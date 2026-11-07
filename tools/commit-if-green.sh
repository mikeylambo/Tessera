#!/usr/bin/env bash
# Commit only when `npm run gates` exits 0 (CLAUDE.md gate rule). Usage: tools/commit-if-green.sh "message"
set -euo pipefail
log="$(mktemp)"
if ! npm run gates >"$log" 2>&1; then
  echo "GATES FAILED — not committing"; grep -E "FAIL|failure|error" "$log" | head -20; exit 1
fi
grep -E "Test Files|Tests |all browser gates" "$log"
git add -A
git commit -q -m "$1"
git push -q origin "$(git branch --show-current)"
git log --oneline -1
