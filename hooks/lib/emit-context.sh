#!/usr/bin/env bash
set -euo pipefail

emit_context() {
  local content="$1"
  local payload
  payload="$(jq -nc --arg c "$content" '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $c
    }
  }')"
  printf '%s\n' "$payload"
}
