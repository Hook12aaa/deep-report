#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "${HERE}/.." && pwd)"

export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"

fail=0

run_test() {
  local test_path="$1"
  echo "[test] $(basename "$test_path")"
  if bash "$test_path"; then
    echo "  ok"
  else
    echo "  FAIL"
    fail=1
  fi
}

for t in "${HERE}/hooks/"*.sh; do
  [[ -f "$t" ]] && run_test "$t"
done

if [[ -f "${HERE}/drift-check.sh" ]]; then
  run_test "${HERE}/drift-check.sh"
fi

if (( fail )); then
  echo "tests failed"
  exit 1
fi
echo "all tests passed"
