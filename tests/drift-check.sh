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

printf "\n=== Layer 1 — synthesizer subagent markers ===\n"
SYNTH="$ROOT/skills/deep-report/agents/synthesizer.md"
assert_file_exists "synthesizer.md exists" "$SYNTH"
assert_grep "HARD-GATE: no standalone --- lines" 'Do NOT emit a `---` standalone line' "$SYNTH"
assert_grep "HARD-GATE: no raw <hr> HTML"       'Do NOT emit raw `<hr>` HTML'         "$SYNTH"
assert_grep "HARD-GATE: heading-level collision" 'Never use the same heading level for both a Part and a Section' "$SYNTH"
assert_grep "HARD-GATE: no claims absent from ledger" 'Do NOT introduce facts not present in' "$SYNTH"
assert_grep "Heading contract: title is single #" 'Report title' "$SYNTH"
assert_grep "Refusal token: needs-research"     'REFUSE:needs-research'               "$SYNTH"
assert_grep "Refusal token: voice-anchor-unfit" 'REFUSE:voice-anchor-unfit'           "$SYNTH"
assert_grep "Refusal token: depth-mode-mismatch" 'REFUSE:depth-mode-mismatch'          "$SYNTH"

printf "\n=== Layer 2 — sanitiser markers ===\n"
BUILD="$ROOT/skills/deep-report/scripts/build-pdf.js"
assert_grep "sanitiseMarkdown exported"   'export function sanitiseMarkdown' "$BUILD"
assert_grep "sanitiseWithReport exported" 'export function sanitiseWithReport' "$BUILD"
assert_grep "countOccurrences helper"     'function countOccurrences'        "$BUILD"
assert_grep "rule 1: strip --- regex"       '\^\\s\*-\{3,\}\\s\*\$' "$BUILD"
assert_grep "rule 2a: <hr> before heading"  'hr.*\+.*<h\[1-6\]' "$BUILD"
assert_grep "rule 2b: <hr> after heading"   'h\[1-6\]>.*<hr' "$BUILD"
assert_grep "rule 3: heading normalisation" 'headingMatches' "$BUILD"
assert_grep "rule 4: blank-line collapse"   'replace\(/\\n\{3,\}/g' "$BUILD"
assert_grep "chapter-class auto-apply"     'class="chapter"' "$BUILD"
assert_grep "sanitiser report key strip-hr-line"     '"strip-hr-line"'     "$BUILD"
assert_grep "sanitiser report key strip-hr-tag"      '"strip-hr-tag"'      "$BUILD"
assert_grep "sanitiser report key heading-normalise" '"heading-normalise"' "$BUILD"
assert_grep "sanitiser report key blank-collapse"    '"blank-collapse"'    "$BUILD"

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
assert_grep "step 6 dispatches synthesizer subagent" 'Dispatch the .synthesizer. subagent' "$SKILL"
assert_grep "step 6 lists four-level heading hierarchy" 'title .#., Part .##., Section .###., Sub-section .####' "$SKILL"
assert_grep "step 8 names build-pdf.js"     'scripts/build-pdf.js'        "$SKILL"
assert_grep "step 8 names verify-pdf.js"    'scripts/verify-pdf.js'       "$SKILL"

printf "\n=== Release markers ===\n"
PLUGIN_JSON="$ROOT/.claude-plugin/plugin.json"
CHANGELOG="$ROOT/CHANGELOG.md"
assert_grep "plugin.json version is 0.1.1" '"version": "0.1.1"' "$PLUGIN_JSON"
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
