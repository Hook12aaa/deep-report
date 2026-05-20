#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:?CLAUDE_PLUGIN_ROOT must be set}"
HOOK="${PLUGIN_ROOT}/hooks/session-start"
BOOTSTRAP="${PLUGIN_ROOT}/skills/using-deep-report/SKILL.md"

[[ -x "$HOOK" ]] || { echo "session-start hook is not executable"; exit 1; }
[[ -f "$BOOTSTRAP" ]] || { echo "bootstrap SKILL.md missing"; exit 1; }

output="$("$HOOK")"
echo "$output" | jq -e '.hookSpecificOutput.hookEventName == "SessionStart"' >/dev/null \
  || { echo "hook did not emit SessionStart JSON"; exit 1; }

echo "$output" | jq -e '.hookSpecificOutput.additionalContext | length > 0' >/dev/null \
  || { echo "hook emitted empty additionalContext"; exit 1; }
