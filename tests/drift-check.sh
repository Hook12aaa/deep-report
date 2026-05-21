#!/usr/bin/env bash
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

pass=0
fail=0
fail_messages=()

assert_grep() {
  local description="$1"
  local pattern="$2"
  local file="$3"
  if grep -qE "$pattern" "$file" 2>/dev/null; then
    pass=$((pass + 1))
    printf "  PASS  %s\n" "$description"
  else
    fail=$((fail + 1))
    fail_messages+=("$description -- pattern '$pattern' not found in $file")
    printf "  FAIL  %s\n" "$description"
  fi
}

assert_grep_count() {
  local description="$1"
  local pattern="$2"
  local file="$3"
  local expected="$4"
  local actual
  actual="$(grep -cE "$pattern" "$file" 2>/dev/null || echo 0)"
  if [[ "$actual" == "$expected" ]]; then
    pass=$((pass + 1))
    printf "  PASS  %s (count=%s)\n" "$description" "$actual"
  else
    fail=$((fail + 1))
    fail_messages+=("$description -- expected count=$expected, got $actual")
    printf "  FAIL  %s (expected count=%s, got %s)\n" "$description" "$expected" "$actual"
  fi
}

assert_file_exists() {
  local description="$1"
  local file="$2"
  if [[ -f "$file" ]]; then
    pass=$((pass + 1))
    printf "  PASS  %s\n" "$description"
  else
    fail=$((fail + 1))
    fail_messages+=("$description -- file missing: $file")
    printf "  FAIL  %s\n" "$description"
  fi
}

printf "\n=== Layer 0 — v0.2 prose-spec architecture markers ===\n"
PROSE_AGENT="$ROOT/skills/deep-report/agents/prose-spec-author.md"
PROSE_SCHEMA="$ROOT/skills/deep-report/schemas/prose-section-spec.schema.json"
RENDER_PROSE="$ROOT/skills/deep-report/scripts/render-prose.js"
MEASURE_PROSE="$ROOT/skills/deep-report/scripts/measure-prose.js"
HEDGE_DENYLIST="$ROOT/skills/deep-report/assets/hedge-words.txt"
PROSE_METRICS_DOC="$ROOT/skills/deep-report/references/prose-metrics.md"
assert_file_exists "prose-spec-author.md exists" "$PROSE_AGENT"
assert_file_exists "prose-section-spec.schema.json exists" "$PROSE_SCHEMA"
assert_file_exists "render-prose.js exists" "$RENDER_PROSE"
assert_file_exists "measure-prose.js exists" "$MEASURE_PROSE"
assert_file_exists "hedge denylist asset exists" "$HEDGE_DENYLIST"
assert_file_exists "prose-metrics reference exists" "$PROSE_METRICS_DOC"
assert_grep "schema has paragraph_block" 'paragraph_block' "$PROSE_SCHEMA"
assert_grep "schema has why_it_matters_block" 'why_it_matters_block' "$PROSE_SCHEMA"
assert_grep "schema has bullets_block" 'bullets_block' "$PROSE_SCHEMA"
assert_grep "schema has callout_block" 'callout_block' "$PROSE_SCHEMA"
assert_grep "renderSection exported" 'export function renderSection' "$RENDER_PROSE"
assert_grep "measureProse exported" 'export async function measureProse' "$MEASURE_PROSE"
assert_grep "loadHedgeDenylist exported" 'export async function loadHedgeDenylist' "$MEASURE_PROSE"
assert_grep "SKILL.md step 6 dispatches prose-spec author" 'prose-spec-author' "$ROOT/skills/deep-report/SKILL.md"
assert_grep "SKILL.md mentions RENDER_FAILED verdict" 'RENDER_FAILED' "$ROOT/skills/deep-report/SKILL.md"
assert_grep "plugin.json version is 0.2.0" '"version": "0.2.0"' "$ROOT/.claude-plugin/plugin.json"

printf "\n=== Layer 2 — sanitiser markers ===\n"
BUILD="$ROOT/skills/deep-report/scripts/build-pdf.js"
assert_grep "chapter-class auto-apply"     'class="chapter"' "$BUILD"
assert_grep "sanitiseMarkdown removed" '^$' "$ROOT/skills/deep-report/scripts/build-pdf.js" 2>/dev/null || true
if ! grep -q "sanitiseMarkdown" "$ROOT/skills/deep-report/scripts/build-pdf.js"; then
  pass=$((pass + 1))
  printf "  PASS  sanitiseMarkdown removed from build-pdf.js (vestigial in v0.2)\n"
else
  fail=$((fail + 1))
  fail_messages+=("sanitiseMarkdown still present in build-pdf.js — should be removed in v0.2")
  printf "  FAIL  sanitiseMarkdown still present in build-pdf.js\n"
fi

printf "\n=== Layer 3 — CSS scope markers ===\n"
CSS="$ROOT/skills/deep-report/assets/print.css"
assert_grep "h1.chapter forces page break"  'h1\.chapter.*page-break-before: always' "$CSS"
assert_grep "h1:first-of-type protected"    'h1:first-of-type.*page-break-before: avoid' "$CSS"
assert_grep "h1 has break-after: avoid"     '^h1 \{.*break-after: avoid' "$CSS"
assert_grep "heading-adjacent margin reset" 'h1 \+ p, h2 \+ p, h3 \+ p, h4 \+ p' "$CSS"

printf "\n=== Layer 4 — measurement gate markers ===\n"
VERIFY="$ROOT/skills/deep-report/scripts/verify-pdf.js"
assert_grep "checkOrphanHeading exported"  'export function checkOrphanHeading' "$VERIFY"
assert_grep "checkBlankPage exported"      'export function checkBlankPage'     "$VERIFY"
assert_grep "no-orphan-heading check name" '"no-orphan-heading"'                "$VERIFY"
assert_grep "no-blank-page check name"     '"no-blank-page"'                    "$VERIFY"
assert_grep "headings captured in measureHtmlPage" 'h1, h2, h3, h4'             "$VERIFY"
assert_grep "allTextRects captured"        'allTextRects'                       "$VERIFY"
assert_grep "contentHeightPx exposed"      'contentHeightPx'                    "$VERIFY"

printf "\n=== SKILL.md wiring markers ===\n"
SKILL="$ROOT/skills/deep-report/SKILL.md"
assert_grep "step 8 names build-pdf.js"     'scripts/build-pdf.js'        "$SKILL"
assert_grep "step 8 names verify-pdf.js"    'scripts/verify-pdf.js'       "$SKILL"

printf "\n=== Release markers ===\n"
PLUGIN_JSON="$ROOT/.claude-plugin/plugin.json"
CHANGELOG="$ROOT/CHANGELOG.md"
assert_grep "CHANGELOG has 0.1.1 entry"    '^## 0\.1\.1' "$CHANGELOG"
assert_grep "CHANGELOG mentions sanitiser" 'sanitiseMarkdown'  "$CHANGELOG"
assert_grep "CHANGELOG mentions new gate checks" 'no-orphan-heading'  "$CHANGELOG"

printf "\n=== Verifier output drift (run against existing smoke artefacts if present) ===\n"
SMOKE_REPORT="/tmp/smoke-sanit/out/report.sanitiser.json"
if [[ -f "$SMOKE_REPORT" ]]; then
  assert_grep "live sanitiser report has strip-hr-line"     '"strip-hr-line"'     "$SMOKE_REPORT"
  assert_grep "live sanitiser report has strip-hr-tag"      '"strip-hr-tag"'      "$SMOKE_REPORT"
  assert_grep "live sanitiser report has heading-normalise" '"heading-normalise"' "$SMOKE_REPORT"
  assert_grep "live sanitiser report has blank-collapse"    '"blank-collapse"'    "$SMOKE_REPORT"
else
  printf "  SKIP  smoke artefacts not present at %s — run build-pdf.js first to validate live output\n" "$SMOKE_REPORT"
fi

printf "\n=== Summary ===\n"
printf "  passed: %d\n" "$pass"
printf "  failed: %d\n" "$fail"
if [[ "$fail" -gt 0 ]]; then
  printf "\nFailures:\n"
  for m in "${fail_messages[@]}"; do
    printf "  - %s\n" "$m"
  done
  exit 1
fi
printf "\nALL DRIFT MARKERS PRESENT\n"
exit 0
