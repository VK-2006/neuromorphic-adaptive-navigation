#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
rm_git_or_local(){
  local p="$1"
  if [[ -d .git ]]; then git rm -f --ignore-unmatch -- "$p" >/dev/null 2>&1 || true; fi
  rm -rf -- "$p"
}
for p in \
  docs/PHASE2_QA_REPORT.md docs/UI_WORLDCLASS_V5_IMPLEMENTATION_REPORT.md \
  docs/ui-cinematic-v4.md docs/ui-premium-transformation.md docs/ui-senior-v4.md \
  tests/cinematic_ui_contracts.py tests/senior_ui_contracts.py; do rm_git_or_local "$p"; done
find . -maxdepth 1 -type f \( -name 'UPDATE_*.md' -o -name 'TEST_RESULTS_*.md' \) -print0 | while IFS= read -r -d '' f; do rm_git_or_local "${f#./}"; done
find . -type f \( -name '*.backup' -o -name '*.before-*' -o -name '*before-zip-update*' \) -print0 | while IFS= read -r -d '' f; do rm_git_or_local "${f#./}"; done
find qa-screens -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) -print0 2>/dev/null | while IFS= read -r -d '' f; do rm_git_or_local "$f"; done
printf '%s\n' 'CLEANUP_FOR_GIT PASS — legacy reports/backups/generated QA images removed.'
printf '%s\n' 'Preserved: .git, backend/.env, backend/node_modules, backend/package-lock.json, ai-service/.env and ai-service/.venv.'
