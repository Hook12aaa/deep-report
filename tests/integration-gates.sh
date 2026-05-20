#!/usr/bin/env bash
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
SKILL_DIR="$ROOT/skills/deep-report"
FIXTURES="$HERE/fixtures"
WORK="$(mktemp -d /tmp/deep-report-gates.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

pass=0
fail=0
fail_messages=()

emit_pass() {
  pass=$((pass + 1))
  printf "  PASS  %s\n" "$1"
}
emit_fail() {
  fail=$((fail + 1))
  fail_messages+=("$1")
  printf "  FAIL  %s\n" "$1"
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    printf "  SKIP  integration-gates: '%s' not on PATH\n" "$1"
    exit 0
  }
}

require node
require dot

if [[ ! -d "$SKILL_DIR/node_modules/puppeteer" ]]; then
  printf "  SKIP  integration-gates: puppeteer not installed in %s/node_modules (run 'npm install' there)\n" "$SKILL_DIR"
  exit 0
fi

build_pdf() {
  local fixture="$1"
  local outdir="$2"
  mkdir -p "$outdir"
  (cd "$SKILL_DIR" && node scripts/build-pdf.js \
    --draft "$fixture" \
    --out "$outdir/report.pdf" \
    --html "$outdir/report.html" >/dev/null 2>&1)
}

verify_pdf() {
  local outdir="$1"
  (cd "$SKILL_DIR" && node scripts/verify-pdf.js \
    --html "$outdir/report.html" \
    --pdf "$outdir/report.pdf" 2>/dev/null)
}

#--------------------------------------------------------------------------------
printf "\n=== Fixture A: sparse content trips no-blank-page ===\n"
A_OUT="$WORK/sparse"
build_pdf "$FIXTURES/sparse.md" "$A_OUT"
A_REPORT="$(verify_pdf "$A_OUT" || true)"
A_VERDICT="$(printf '%s' "$A_REPORT" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("verdict",""))' 2>/dev/null || echo "?")"
A_FAILED_CHECK="$(printf '%s' "$A_REPORT" | python3 -c '
import json,sys
d=json.load(sys.stdin)
for c in d.get("checks",[]):
    if not c.get("pass", True) and not c.get("skipped"):
        print(c["name"]); break
' 2>/dev/null || true)"

if [[ "$A_VERDICT" == "fail" ]]; then
  emit_pass "sparse.md produces verdict=fail"
else
  emit_fail "sparse.md verdict was '$A_VERDICT', expected 'fail'"
fi
if [[ "$A_FAILED_CHECK" == "no-blank-page" ]]; then
  emit_pass "the failing check is no-blank-page"
else
  emit_fail "expected no-blank-page failure, got '$A_FAILED_CHECK'"
fi

#--------------------------------------------------------------------------------
printf "\n=== Fixture B: --- separators are sanitised away ===\n"
B_OUT="$WORK/dashes"
build_pdf "$FIXTURES/dashes-salted.md" "$B_OUT"

if [[ -f "$B_OUT/report.sanitiser.json" ]]; then
  emit_pass "sanitiser report emitted alongside PDF"
else
  emit_fail "sanitiser report missing at $B_OUT/report.sanitiser.json"
fi

B_STRIPPED="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["strip-hr-line"]["occurrences"])' "$B_OUT/report.sanitiser.json" 2>/dev/null || echo "?")"
if [[ "$B_STRIPPED" =~ ^[1-9][0-9]*$ ]]; then
  emit_pass "sanitiser report shows strip-hr-line occurrences=$B_STRIPPED (>0)"
else
  emit_fail "sanitiser strip-hr-line should be >0, got '$B_STRIPPED'"
fi

B_HR_IN_HTML="$(grep -o '<hr' "$B_OUT/report.html" 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$B_HR_IN_HTML" == "0" ]]; then
  emit_pass "rendered HTML contains zero <hr> tags"
else
  emit_fail "rendered HTML still contains $B_HR_IN_HTML <hr> tag(s)"
fi

B_VERDICT="$(verify_pdf "$B_OUT" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("verdict",""))' 2>/dev/null || echo "?")"
if [[ "$B_VERDICT" == "pass" ]]; then
  emit_pass "sanitised draft verifies clean (verdict=pass)"
else
  emit_fail "sanitised draft verdict was '$B_VERDICT', expected 'pass'"
fi

#--------------------------------------------------------------------------------
printf "\n=== Fixture C: raw <hr> adjacent to headings is stripped ===\n"
C_OUT="$WORK/hr-tags"
build_pdf "$FIXTURES/hr-tags-salted.md" "$C_OUT"

C_HR_IN_HTML="$(grep -o '<hr' "$C_OUT/report.html" 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$C_HR_IN_HTML" == "0" ]]; then
  emit_pass "rendered HTML has no <hr> tags after sanitisation"
else
  emit_fail "rendered HTML still has $C_HR_IN_HTML <hr> tag(s) after sanitisation"
fi

C_VERDICT="$(verify_pdf "$C_OUT" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("verdict",""))' 2>/dev/null || echo "?")"
if [[ "$C_VERDICT" == "pass" ]]; then
  emit_pass "hr-stripped draft verifies clean"
else
  emit_fail "hr-stripped verdict was '$C_VERDICT', expected 'pass'"
fi

#--------------------------------------------------------------------------------
printf "\n=== Fixture D: multi-h1 input applies class=\"chapter\" to non-first h1 ===\n"
D_OUT="$WORK/multi-h1"
build_pdf "$FIXTURES/multi-h1.md" "$D_OUT"

D_FIRST_H1='<h1>First chapter</h1>'
D_SECOND_H1='<h1 class="chapter">Second chapter</h1>'
D_THIRD_H1='<h1 class="chapter">Third chapter</h1>'

if grep -qF "$D_FIRST_H1" "$D_OUT/report.html"; then
  emit_pass "first h1 has no chapter class"
else
  emit_fail "first h1 missing or has unexpected class"
fi
if grep -qF "$D_SECOND_H1" "$D_OUT/report.html"; then
  emit_pass "second h1 has class=\"chapter\""
else
  emit_fail "second h1 missing chapter class"
fi
if grep -qF "$D_THIRD_H1" "$D_OUT/report.html"; then
  emit_pass "third h1 has class=\"chapter\""
else
  emit_fail "third h1 missing chapter class"
fi

#--------------------------------------------------------------------------------
printf "\n=== Fixture E: passing prose spec renders and measures clean ===\n"
E_OUT="$WORK/prose-pass"
mkdir -p "$E_OUT/specs"
cp "$FIXTURES/prose-spec-pass.json" "$E_OUT/specs/intro.spec.json"
cat > "$E_OUT/draft.md" <<'EOF'
# Prose pass

{{prose:intro}}
EOF
build_pdf_with_prose() {
  local draft="$1" specs="$2" outdir="$3"
  mkdir -p "$outdir"
  (cd "$SKILL_DIR" && node scripts/build-pdf.js --draft "$draft" --prose-specs "$specs" --out "$outdir/report.pdf" --html "$outdir/report.html" >/dev/null 2>&1)
}
build_pdf_with_prose "$E_OUT/draft.md" "$E_OUT/specs" "$E_OUT"
if [[ -f "$E_OUT/report.html" && -f "$E_OUT/report.pdf" ]]; then
  emit_pass "prose-pass fixture renders both HTML and PDF"
else
  emit_fail "prose-pass fixture missing rendered artefacts"
fi

#--------------------------------------------------------------------------------
printf "\n=== Fixture F: hedge-heavy spec fails the gate ===\n"
F_OUT="$WORK/prose-hedge"
mkdir -p "$F_OUT/specs"
cp "$FIXTURES/prose-spec-hedge-heavy.json" "$F_OUT/specs/intro.spec.json"
cat > "$F_OUT/draft.md" <<'EOF'
# Prose hedge

{{prose:intro}}
EOF
mkdir -p "$F_OUT"
if (cd "$SKILL_DIR" && node scripts/build-pdf.js --draft "$F_OUT/draft.md" --prose-specs "$F_OUT/specs" --out "$F_OUT/report.pdf" --html "$F_OUT/report.html" >/dev/null 2>&1); then
  emit_fail "hedge-heavy spec should have failed the gate, but build succeeded"
else
  emit_pass "hedge-heavy spec fails the build (gate fires)"
fi

#--------------------------------------------------------------------------------
printf "\n=== Fixture G: monotone-sentence spec fails the stdev floor ===\n"
G_OUT="$WORK/prose-monotone"
mkdir -p "$G_OUT/specs"
cp "$FIXTURES/prose-spec-monotone.json" "$G_OUT/specs/intro.spec.json"
cat > "$G_OUT/draft.md" <<'EOF'
# Prose monotone

{{prose:intro}}
EOF
if (cd "$SKILL_DIR" && node scripts/build-pdf.js --draft "$G_OUT/draft.md" --prose-specs "$G_OUT/specs" --out "$G_OUT/report.pdf" --html "$G_OUT/report.html" >/dev/null 2>&1); then
  emit_fail "monotone spec should have failed the gate, but build succeeded"
else
  emit_pass "monotone spec fails the build (stdev floor fires)"
fi

#--------------------------------------------------------------------------------
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
printf "\nALL GATES FIRE AS EXPECTED\n"
exit 0
