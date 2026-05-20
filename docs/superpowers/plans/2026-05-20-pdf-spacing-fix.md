# PDF spacing fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the excessive `<hr>` and blank-page-before-h1 defects from deep-report PDFs by adding a markdown sanitiser, scoped CSS rules, and two new measurement-gate checks.

**Architecture:** Three layers of defence (Layer 1 — the synthesizer subagent — was shipped separately at commit cb98af7). Layer 2 sanitises markdown before HTML conversion. Layer 3 scopes the chapter-break CSS rule. Layer 4 adds `no-orphan-heading` and `no-blank-page` to the verifier. Each layer catches what the previous missed; the verifier is the keystone.

**Tech Stack:** Node 20+, `puppeteer` (already a dep), `node --test` (built-in), Graphviz `dot` (already required at runtime).

**Spec:** `docs/superpowers/specs/2026-05-20-pdf-spacing-fix-design.md`.

---

## Task 1: Golden-input fixture

**Files:**
- Create: `skills/deep-report/tests/fixtures/research-draft-43-hrs.md`

- [ ] **Step 1: Write the fixture**

Create `skills/deep-report/tests/fixtures/research-draft-43-hrs.md` with the exact content:

```markdown
# Case studies — regional rail electrification

## Case study 1: Greater Anglia mainline

Greater Anglia electrified the Norwich–London corridor [source: nationalrail.co.uk].

---

## Case study 2: Great Northern Cambridge service

Great Northern operates the King's Cross to Cambridge route [source: gtr.co.uk].

---

## Case study 3: Northern via TransPennine
---
Operator boundaries shift mid-route.

---
---
---
```

The double-stack of `---` at the bottom and the bare `---` directly under a heading both reproduce real synthesizer output.

- [ ] **Step 2: Commit**

```bash
git add skills/deep-report/tests/fixtures/research-draft-43-hrs.md
git commit -m "test(fixtures): golden research-draft input with stacked --- separators"
```

---

## Task 2: sanitiser test scaffold

**Files:**
- Create: `skills/deep-report/scripts/sanitiser.test.js`

- [ ] **Step 1: Write the failing test scaffold**

Create `skills/deep-report/scripts/sanitiser.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { sanitiseMarkdown } from "./build-pdf.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, "../tests/fixtures/research-draft-43-hrs.md");

test("strips standalone --- lines", () => {
  const input = "Section one\n\n---\n\nSection two\n";
  const out = sanitiseMarkdown(input);
  assert.equal(out.includes("---"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd skills/deep-report
node --test scripts/sanitiser.test.js
```

Expected: FAIL with `SyntaxError: The requested module './build-pdf.js' does not provide an export named 'sanitiseMarkdown'`.

---

## Task 3: Implement sanitiseMarkdown — rule 1 (strip standalone `---`)

**Files:**
- Modify: `skills/deep-report/scripts/build-pdf.js` (add export before the existing `function parseArgs` block, around line 14)

- [ ] **Step 1: Add the sanitiser function**

Insert the following at the top of the file, immediately after the imports and the `SKILL_ROOT`/`PRINT_CSS_PATH` constants:

```js
export function sanitiseMarkdown(text) {
  let out = text;
  out = out.replace(/^\s*-{3,}\s*$/gm, "");
  return out;
}
```

- [ ] **Step 2: Run the test**

```bash
cd skills/deep-report
node --test scripts/sanitiser.test.js
```

Expected: PASS (1/1).

- [ ] **Step 3: Commit**

```bash
git add skills/deep-report/scripts/build-pdf.js skills/deep-report/scripts/sanitiser.test.js
git commit -m "feat(sanitiser): strip standalone --- lines (rule 1 of 4)"
```

---

## Task 4: Sanitiser rule 2 — strip `<hr>` adjacent to headings

**Files:**
- Modify: `skills/deep-report/scripts/build-pdf.js`
- Modify: `skills/deep-report/scripts/sanitiser.test.js`

- [ ] **Step 1: Add the failing test**

Append to `sanitiser.test.js`:

```js
test("strips <hr> adjacent to headings", () => {
  const a = "<hr>\n<h1>Title</h1>";
  const b = "<h1>Title</h1>\n<hr/>";
  const c = "<h2>Section</h2>  <hr />\n<p>body</p>";
  assert.equal(sanitiseMarkdown(a), "<h1>Title</h1>");
  assert.equal(sanitiseMarkdown(b), "<h1>Title</h1>");
  assert.equal(sanitiseMarkdown(c).includes("<hr"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test scripts/sanitiser.test.js
```

Expected: 1 PASS, 1 FAIL.

- [ ] **Step 3: Extend sanitiseMarkdown with rule 2**

Update the function body in `build-pdf.js`:

```js
export function sanitiseMarkdown(text) {
  let out = text;
  out = out.replace(/^\s*-{3,}\s*$/gm, "");
  out = out.replace(/<hr\s*\/?>\s*(<h[1-6])/gi, "$1");
  out = out.replace(/(<\/h[1-6]>)\s*<hr\s*\/?>/gi, "$1");
  return out;
}
```

- [ ] **Step 4: Run the tests**

```bash
node --test scripts/sanitiser.test.js
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add skills/deep-report/scripts/build-pdf.js skills/deep-report/scripts/sanitiser.test.js
git commit -m "feat(sanitiser): strip <hr> adjacent to headings (rule 2 of 4)"
```

---

## Task 5: Sanitiser rule 3 — normalise heading levels (auto-shift)

**Files:**
- Modify: `skills/deep-report/scripts/build-pdf.js`
- Modify: `skills/deep-report/scripts/sanitiser.test.js`

- [ ] **Step 1: Add the failing test**

Append to `sanitiser.test.js`:

```js
test("normalises heading levels by min offset", () => {
  const input = "## Title\n\n### Section\n\nbody\n\n#### Sub\n";
  const out = sanitiseMarkdown(input);
  assert.match(out, /^# Title$/m);
  assert.match(out, /^## Section$/m);
  assert.match(out, /^### Sub$/m);
});

test("leaves heading levels unchanged when min is already 1", () => {
  const input = "# Title\n\n## Part\n\n### Section\n";
  const out = sanitiseMarkdown(input);
  assert.equal(out, input);
});

test("no headings present is a no-op", () => {
  const input = "Just prose, no headings.\n";
  assert.equal(sanitiseMarkdown(input), input);
});
```

- [ ] **Step 2: Run test to verify the first two fail**

```bash
node --test scripts/sanitiser.test.js
```

Expected: 3 PASS (the no-op), 2 FAIL.

- [ ] **Step 3: Extend sanitiseMarkdown with rule 3**

Update the function body in `build-pdf.js`:

```js
export function sanitiseMarkdown(text) {
  let out = text;
  out = out.replace(/^\s*-{3,}\s*$/gm, "");
  out = out.replace(/<hr\s*\/?>\s*(<h[1-6])/gi, "$1");
  out = out.replace(/(<\/h[1-6]>)\s*<hr\s*\/?>/gi, "$1");

  const headingMatches = [...out.matchAll(/^(#{1,6})\s+/gm)];
  if (headingMatches.length > 0) {
    const minLevel = Math.min(...headingMatches.map((m) => m[1].length));
    const offset = minLevel - 1;
    if (offset > 0) {
      out = out.replace(/^(#{1,6})(\s+)/gm, (_, hashes, sp) => "#".repeat(hashes.length - offset) + sp);
    }
  }

  return out;
}
```

- [ ] **Step 4: Run the tests**

```bash
node --test scripts/sanitiser.test.js
```

Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add skills/deep-report/scripts/build-pdf.js skills/deep-report/scripts/sanitiser.test.js
git commit -m "feat(sanitiser): normalise heading levels by min offset (rule 3 of 4)"
```

---

## Task 6: Sanitiser rule 4 — collapse 3+ blank lines

**Files:**
- Modify: `skills/deep-report/scripts/build-pdf.js`
- Modify: `skills/deep-report/scripts/sanitiser.test.js`

- [ ] **Step 1: Add the failing test**

Append:

```js
test("collapses 3+ blank lines to 2", () => {
  const input = "para one\n\n\n\n\npara two\n";
  const out = sanitiseMarkdown(input);
  assert.equal(out, "para one\n\npara two\n");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test scripts/sanitiser.test.js
```

Expected: 5 PASS, 1 FAIL.

- [ ] **Step 3: Extend sanitiseMarkdown with rule 4**

Add as the final transformation before `return out`:

```js
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}
```

- [ ] **Step 4: Run the tests**

```bash
node --test scripts/sanitiser.test.js
```

Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add skills/deep-report/scripts/build-pdf.js skills/deep-report/scripts/sanitiser.test.js
git commit -m "feat(sanitiser): collapse 3+ blank lines to 2 (rule 4 of 4)"
```

---

## Task 7: Sanitiser idempotence test

**Files:**
- Modify: `skills/deep-report/scripts/sanitiser.test.js`

- [ ] **Step 1: Add the idempotence test**

Append:

```js
test("sanitiseMarkdown is idempotent on its own output", async () => {
  const fixture = await readFile(FIXTURE, "utf8");
  const once = sanitiseMarkdown(fixture);
  const twice = sanitiseMarkdown(once);
  assert.equal(once, twice, "second pass changed the output");
});

test("sanitiseMarkdown strips 43 --- from the worst-offender fixture", async () => {
  const fixture = await readFile(FIXTURE, "utf8");
  const out = sanitiseMarkdown(fixture);
  const remainingHrLines = (out.match(/^\s*-{3,}\s*$/gm) ?? []).length;
  assert.equal(remainingHrLines, 0);
});
```

- [ ] **Step 2: Run the tests**

```bash
node --test scripts/sanitiser.test.js
```

Expected: PASS (8/8).

- [ ] **Step 3: Commit**

```bash
git add skills/deep-report/scripts/sanitiser.test.js
git commit -m "test(sanitiser): idempotence + fixture coverage"
```

---

## Task 8: Wire sanitiseMarkdown into the build pipeline + sanitiser report

**Files:**
- Modify: `skills/deep-report/scripts/build-pdf.js`

- [ ] **Step 1: Add a sanitiser-report helper**

Above the `buildDocument` function in `build-pdf.js`, add:

```js
function countOccurrences(re, text) {
  return (text.match(re) ?? []).length;
}

export function sanitiseWithReport(text) {
  const before = text;
  const sanitised = sanitiseMarkdown(text);
  const headings = [...before.matchAll(/^(#{1,6})\s+/gm)];
  const minLevel = headings.length ? Math.min(...headings.map((m) => m[1].length)) : 1;
  const report = {
    "strip-hr-line":     { occurrences: countOccurrences(/^\s*-{3,}\s*$/gm, before) },
    "strip-hr-tag":      { occurrences: countOccurrences(/<hr\s*\/?>/gi, before) },
    "heading-normalise": { offset: Math.max(0, minLevel - 1) },
    "blank-collapse":    { occurrences: countOccurrences(/\n{3,}/g, before) },
  };
  return { sanitised, report };
}
```

- [ ] **Step 2: Wire sanitiseWithReport into `buildDocument`**

Locate `async function buildDocument(draftMd, renderedById, css)` and change its first line. Replace:

```js
async function buildDocument(draftMd, renderedById, css) {
  const body = substituteFigures(renderMarkdown(draftMd), renderedById);
```

with:

```js
async function buildDocument(draftMd, renderedById, css) {
  const { sanitised, report: sanitiserReport } = sanitiseWithReport(draftMd);
  const body = substituteFigures(renderMarkdown(sanitised), renderedById);
```

Then return both the html and the report by changing the function's `return` statement. The function currently returns only the HTML string. Change the signature to return `{ html, sanitiserReport }`:

```js
  return { html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>deep-report</title>
<style>
${css}
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`, sanitiserReport };
}
```

- [ ] **Step 3: Update the CLI block to consume the new return shape and write the sanitiser report**

In the CLI `if (invokedAsCli) { ... }` block, locate:

```js
  const fullHtml = await buildDocument(draftMd, renderedById, css);
```

Replace with:

```js
  const { html: fullHtml, sanitiserReport } = await buildDocument(draftMd, renderedById, css);
```

Then after the `await writeFile(htmlPath, fullHtml);` line, add:

```js
  const sanitiserReportPath = resolve(dirname(args.out), basename(args.out, extname(args.out)) + ".sanitiser.json");
  await writeFile(sanitiserReportPath, JSON.stringify(sanitiserReport, null, 2));
```

And extend the final stdout report object — change:

```js
  const report = {
    draft: args.draft,
    specs: args.specs ?? null,
    html: htmlPath,
    pdf: args.out,
    figures: [...renderedById.entries()].map(([id, r]) => ({ id, family: r.family, verdict: r.report.verdict })),
  };
```

to include the sanitiser report path:

```js
  const report = {
    draft: args.draft,
    specs: args.specs ?? null,
    html: htmlPath,
    pdf: args.out,
    sanitiserReport: sanitiserReportPath,
    figures: [...renderedById.entries()].map(([id, r]) => ({ id, family: r.family, verdict: r.report.verdict })),
  };
```

- [ ] **Step 4: Smoke-test the existing build pipeline still works**

```bash
cd skills/deep-report
mkdir -p /tmp/smoke-sanit/specs /tmp/smoke-sanit/out
cp /tmp/smoke/specs/*.json /tmp/smoke-sanit/specs/
cp /tmp/smoke/draft.md /tmp/smoke-sanit/draft.md
node scripts/build-pdf.js --draft /tmp/smoke-sanit/draft.md --specs /tmp/smoke-sanit/specs --out /tmp/smoke-sanit/out/report.pdf --html /tmp/smoke-sanit/out/report.html
ls /tmp/smoke-sanit/out/
```

Expected: `report.html`, `report.pdf`, and `report.sanitiser.json` all present.

- [ ] **Step 5: Inspect the sanitiser report**

```bash
cat /tmp/smoke-sanit/out/report.sanitiser.json
```

Expected: a JSON object with four keys (`strip-hr-line`, `strip-hr-tag`, `heading-normalise`, `blank-collapse`), each with the expected `occurrences` or `offset` field.

- [ ] **Step 6: Commit**

```bash
git add skills/deep-report/scripts/build-pdf.js
git commit -m "feat(build): wire sanitiseMarkdown into pipeline + emit sanitiser report"
```

---

## Task 9: Auto-apply `class="chapter"` to non-first h1s

**Files:**
- Modify: `skills/deep-report/scripts/build-pdf.js` (the `renderMarkdown` function, around the heading match)

- [ ] **Step 1: Locate the heading branch in renderMarkdown**

Find this block:

```js
    const heading = block.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`);
      continue;
    }
```

- [ ] **Step 2: Replace with the chapter-aware version**

```js
    const heading = block.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const isH1 = level === 1;
      const seenH1Before = out.some((html) => /^<h1\b/.test(html));
      const cls = isH1 && seenH1Before ? ' class="chapter"' : "";
      out.push(`<h${level}${cls}>${renderMarkdownInline(heading[2])}</h${level}>`);
      continue;
    }
```

- [ ] **Step 3: Add a quick smoke check inline (no test file)**

```bash
node --input-type=module -e "
import { sanitiseMarkdown } from './scripts/build-pdf.js';
console.log('sanitiser import ok');
"
```

Expected: `sanitiser import ok`. Then visually verify the smoke PDF (the one from Task 8) still renders without errors:

```bash
node scripts/build-pdf.js --draft /tmp/smoke-sanit/draft.md --specs /tmp/smoke-sanit/specs --out /tmp/smoke-sanit/out/report.pdf --html /tmp/smoke-sanit/out/report.html
grep -c '<h1 class="chapter">' /tmp/smoke-sanit/out/report.html || true
```

Expected: 0 (because the smoke draft has only one h1 — the contract is one h1 only).

- [ ] **Step 4: Commit**

```bash
git add skills/deep-report/scripts/build-pdf.js
git commit -m "feat(build): auto-apply class=\"chapter\" to non-first h1 (safety net)"
```

---

## Task 10: Update print.css — scope chapter break, add break-after, adjacent-sibling margin

**Files:**
- Modify: `skills/deep-report/assets/print.css`

- [ ] **Step 1: Update the h1 rule and add the print-media scope**

Replace the existing `h1` line:

```css
h1 { font-size: 22pt; line-height: 1.2; margin: 0 0 16pt; font-weight: 700; }
```

with:

```css
h1 { font-size: 22pt; line-height: 1.2; margin: 0 0 16pt; font-weight: 700; break-after: avoid; }

@media print {
  h1.chapter        { page-break-before: always; }
  h1:first-of-type  { page-break-before: avoid; }
}

h1 + p, h2 + p, h3 + p, h4 + p { margin-top: 0; }
```

- [ ] **Step 2: Re-run the smoke build and confirm no regressions**

```bash
cd skills/deep-report
node scripts/build-pdf.js --draft /tmp/smoke-sanit/draft.md --specs /tmp/smoke-sanit/specs --out /tmp/smoke-sanit/out/report.pdf --html /tmp/smoke-sanit/out/report.html
node scripts/verify-pdf.js --html /tmp/smoke-sanit/out/report.html --pdf /tmp/smoke-sanit/out/report.pdf
```

Expected: `verdict: pass` on all existing checks.

- [ ] **Step 3: Commit**

```bash
git add skills/deep-report/assets/print.css
git commit -m "fix(css): scope page-break-before to h1.chapter; protect first h1; add break-after on h1"
```

---

## Task 11: Verify-pdf — extend `measureHtmlPage` to capture heading + page-density data

**Files:**
- Modify: `skills/deep-report/scripts/verify-pdf.js`

- [ ] **Step 1: Locate the page.evaluate block**

Find the existing `page.evaluate(({ MM_TO_PX, MARGIN_LEFT_MM, MARGIN_RIGHT_MM, PAGE_W_MM }) => { ... })` block.

- [ ] **Step 2: Extend the in-browser script to also return heading and per-page density data**

Inside the `page.evaluate` body, after the existing `textElements` array is built, before the `return { contentLeft, contentRight, contentWidth, figures, textElements };` line, add:

```js
      const headings = [...document.querySelectorAll("h1, h2, h3, h4")].map((h) => {
        const r = h.getBoundingClientRect();
        const next = (() => {
          let n = h.nextElementSibling;
          while (n && /^H[1-6]$/.test(n.tagName)) n = n.nextElementSibling;
          return n ? n.getBoundingClientRect() : null;
        })();
        return {
          level: +h.tagName.slice(1),
          text: (h.textContent ?? "").trim().slice(0, 80),
          top: r.top,
          bottom: r.bottom,
          nextTop: next ? next.top : null,
        };
      });

      const allTextRects = [...document.querySelectorAll("p, li, td, th, figcaption, h1, h2, h3, h4, h5, h6")].map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      });
```

Then change the final return to:

```js
      return { contentLeft, contentRight, contentWidth, figures, textElements, headings, allTextRects };
```

- [ ] **Step 3: Expose `contentHeightPx` on the returned object**

Inside the `measureHtmlPage` function, after the `await page.setViewport({ width: contentWidthPx, height: contentHeightPx });` line, change the `return measurements;` at the end of the function to:

```js
    return { ...measurements, contentHeightPx, contentWidthPx };
```

- [ ] **Step 4: Run the existing verifier to confirm no regression**

```bash
node scripts/verify-pdf.js --html /tmp/smoke-sanit/out/report.html --pdf /tmp/smoke-sanit/out/report.pdf
```

Expected: `verdict: pass` — the existing checks ignore the new fields.

- [ ] **Step 5: Commit**

```bash
git add skills/deep-report/scripts/verify-pdf.js
git commit -m "refactor(verify): capture heading + per-element rects for upcoming gate checks"
```

---

## Task 12: Verify-pdf test scaffold (for pure-function checks)

**Files:**
- Create: `skills/deep-report/scripts/verify-pdf.test.js`

- [ ] **Step 1: Write the test scaffold and one failing test for `checkOrphanHeading`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkOrphanHeading, checkBlankPage } from "./verify-pdf.js";

const PAGE_H = 1000;

test("checkOrphanHeading flags heading in bottom 8% with no content on same page", () => {
  const headings = [{ level: 2, text: "Lonely", top: 940, bottom: 960, nextTop: 1020 }];
  const r = checkOrphanHeading(headings, PAGE_H);
  assert.equal(r.pass, false);
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].text, "Lonely");
});

test("checkOrphanHeading passes when next content is on same page", () => {
  const headings = [{ level: 2, text: "Fine", top: 940, bottom: 960, nextTop: 980 }];
  const r = checkOrphanHeading(headings, PAGE_H);
  assert.equal(r.pass, true);
});

test("checkOrphanHeading passes when heading is in top 92% of page", () => {
  const headings = [{ level: 2, text: "Top", top: 100, bottom: 120, nextTop: 1200 }];
  const r = checkOrphanHeading(headings, PAGE_H);
  assert.equal(r.pass, true);
});
```

- [ ] **Step 2: Run to verify it fails on import**

```bash
node --test scripts/verify-pdf.test.js
```

Expected: FAIL — `verify-pdf.js does not provide an export named 'checkOrphanHeading'`.

---

## Task 13: Implement `checkOrphanHeading`

**Files:**
- Modify: `skills/deep-report/scripts/verify-pdf.js`

- [ ] **Step 1: Add the exported check function**

Below the existing `checkTextContrast` function, add:

```js
export function checkOrphanHeading(headings, contentHeightPx, tolerance = 0.08) {
  const orphanThresholdPx = contentHeightPx * tolerance;
  const failures = [];
  const measured = headings.map((h) => {
    const pageNumber = Math.floor(h.bottom / contentHeightPx);
    const pageBottom = (pageNumber + 1) * contentHeightPx;
    const distanceToPageEnd = pageBottom - h.bottom;
    const nextOnSamePage = h.nextTop !== null && Math.floor(h.nextTop / contentHeightPx) === pageNumber;
    const orphan = distanceToPageEnd < orphanThresholdPx && !nextOnSamePage;
    const record = { level: h.level, text: h.text, pageIndex: pageNumber, distanceToPageEnd };
    if (orphan) failures.push(record);
    return record;
  });
  return {
    name: "no-orphan-heading",
    measured,
    tolerance: `${(tolerance * 100).toFixed(0)}% of page height`,
    pass: failures.length === 0,
    failures,
  };
}
```

- [ ] **Step 2: Run the tests**

```bash
node --test scripts/verify-pdf.test.js
```

Expected: PASS (3/3 from Task 12).

- [ ] **Step 3: Commit**

```bash
git add skills/deep-report/scripts/verify-pdf.js skills/deep-report/scripts/verify-pdf.test.js
git commit -m "feat(verify): no-orphan-heading check"
```

---

## Task 14: Implement `checkBlankPage`

**Files:**
- Modify: `skills/deep-report/scripts/verify-pdf.js`
- Modify: `skills/deep-report/scripts/verify-pdf.test.js`

- [ ] **Step 1: Add the failing test**

Append to `verify-pdf.test.js`:

```js
test("checkBlankPage flags pages below 10% text density", () => {
  const rects = [
    { top: 10,   bottom: 30,   left: 0, right: 50 },
    { top: 1010, bottom: 1030, left: 0, right: 50 },
  ];
  const r = checkBlankPage(rects, PAGE_H, 612);
  assert.equal(r.pass, false);
  assert.equal(r.failures.length, 2);
});

test("checkBlankPage passes when page covered above threshold", () => {
  const rects = [{ top: 0, bottom: 800, left: 0, right: 612 }];
  const r = checkBlankPage(rects, PAGE_H, 612);
  assert.equal(r.pass, true);
});
```

- [ ] **Step 2: Run to verify failure**

```bash
node --test scripts/verify-pdf.test.js
```

Expected: 3 PASS (existing), 2 FAIL.

- [ ] **Step 3: Add the implementation**

In `verify-pdf.js`, below `checkOrphanHeading`, add:

```js
export function checkBlankPage(allTextRects, contentHeightPx, contentWidthPx, threshold = 0.10) {
  const totalContent = allTextRects.reduce((m, r) => Math.max(m, r.bottom), 0);
  const pageCount = Math.max(1, Math.ceil(totalContent / contentHeightPx));
  const pageArea = contentHeightPx * contentWidthPx;
  const failures = [];
  const measured = [];
  for (let p = 0; p < pageCount; p++) {
    const top = p * contentHeightPx;
    const bottom = (p + 1) * contentHeightPx;
    let covered = 0;
    for (const r of allTextRects) {
      const ix1 = Math.max(r.top, top);
      const ix2 = Math.min(r.bottom, bottom);
      if (ix2 <= ix1) continue;
      const w = Math.min(r.right, contentWidthPx) - Math.max(r.left, 0);
      if (w <= 0) continue;
      covered += (ix2 - ix1) * w;
    }
    const density = covered / pageArea;
    const record = { pageIndex: p, density: Math.round(density * 10000) / 10000 };
    measured.push(record);
    if (density < threshold) failures.push(record);
  }
  return {
    name: "no-blank-page",
    measured,
    tolerance: `${(threshold * 100).toFixed(0)}% text density`,
    pass: failures.length === 0,
    failures,
  };
}
```

- [ ] **Step 4: Run the tests**

```bash
node --test scripts/verify-pdf.test.js
```

Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add skills/deep-report/scripts/verify-pdf.js skills/deep-report/scripts/verify-pdf.test.js
git commit -m "feat(verify): no-blank-page check"
```

---

## Task 15: Wire the two new checks into the verify-pdf CLI flow

**Files:**
- Modify: `skills/deep-report/scripts/verify-pdf.js`

- [ ] **Step 1: Locate the CLI checks array**

Find:

```js
  const m = await measureHtmlPage(args.html);
  const checks = [checkFigureFit(m.figures, m.contentWidth), checkTextContrast(m.textElements)];
```

- [ ] **Step 2: Extend with the two new checks**

Replace with:

```js
  const m = await measureHtmlPage(args.html);
  const checks = [
    checkFigureFit(m.figures, m.contentWidth),
    checkTextContrast(m.textElements),
    checkOrphanHeading(m.headings, m.contentHeightPx),
    checkBlankPage(m.allTextRects, m.contentHeightPx, m.contentWidthPx),
  ];
```

- [ ] **Step 3: Re-run the smoke verifier**

```bash
node scripts/verify-pdf.js --html /tmp/smoke-sanit/out/report.html --pdf /tmp/smoke-sanit/out/report.pdf
```

Expected: `verdict: pass`, four checks listed (`figure-fit-content-width`, `text-contrast-wcag-aa`, `no-orphan-heading`, `no-blank-page`), plus the skipped determinism check.

- [ ] **Step 4: Commit**

```bash
git add skills/deep-report/scripts/verify-pdf.js
git commit -m "feat(verify): wire no-orphan-heading and no-blank-page into CLI"
```

---

## Task 16: Integration test — fail the build on a salted draft

**Files:**
- None new; runs against existing scripts and fixture.

- [ ] **Step 1: Build a deliberately broken HTML using the bad fixture**

```bash
cd skills/deep-report
mkdir -p /tmp/bad-build/specs /tmp/bad-build/out
cp tests/fixtures/research-draft-43-hrs.md /tmp/bad-build/draft.md
node scripts/build-pdf.js --draft /tmp/bad-build/draft.md --out /tmp/bad-build/out/report.pdf --html /tmp/bad-build/out/report.html
```

Expected: build completes. Then:

```bash
cat /tmp/bad-build/out/report.sanitiser.json
```

Expected: `strip-hr-line` `occurrences` is non-zero (the original draft had stacked `---` separators).

- [ ] **Step 2: Inspect the rendered HTML**

```bash
grep -c "<hr" /tmp/bad-build/out/report.html
```

Expected: 0 — every `---` was stripped at sanitisation time.

- [ ] **Step 3: Run the verifier**

```bash
node scripts/verify-pdf.js --html /tmp/bad-build/out/report.html --pdf /tmp/bad-build/out/report.pdf
```

Expected: `verdict: pass` — the sanitiser cleaned up the input before render.

- [ ] **Step 4: Re-introduce the bad CSS rule by hand and confirm the verifier catches it**

```bash
cp assets/print.css /tmp/bad-build/print.css.backup
echo "@media print { h1 { page-break-before: always; } }" >> assets/print.css
node scripts/build-pdf.js --draft /tmp/bad-build/draft.md --out /tmp/bad-build/out/report.pdf --html /tmp/bad-build/out/report.html
node scripts/verify-pdf.js --html /tmp/bad-build/out/report.html --pdf /tmp/bad-build/out/report.pdf || echo "verifier failed as expected"
```

Expected: `verdict: fail`, with at least one `no-orphan-heading` or `no-blank-page` failure listed.

- [ ] **Step 5: Restore the original CSS**

```bash
mv /tmp/bad-build/print.css.backup assets/print.css
node scripts/verify-pdf.js --html /tmp/bad-build/out/report.html --pdf /tmp/bad-build/out/report.pdf
```

Note: re-run the build first if you re-verify against a fresh render. The expected end state is `verdict: pass` once the CSS is restored and the HTML rebuilt.

- [ ] **Step 6: No commit (integration check only)**

This task is verification, not new code.

---

## Task 17: Bump version + CHANGELOG

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump plugin.json**

Change `"version": "0.1.0"` to `"version": "0.1.1"`.

- [ ] **Step 2: Prepend a 0.1.1 entry to CHANGELOG.md**

Insert at the top of the file (above the `## 0.1.0` entry):

```markdown
## 0.1.1 — 2026-05-20

Defensive fixes for excessive `<hr>` and blank-page-before-h1 defects.

- New `synthesizer` subagent prompt at `skills/deep-report/agents/synthesizer.md` with HARD-GATEs against `---`, raw `<hr>`, and duplicated heading levels. Four-level heading hierarchy locked (title `#`, Part `##`, Section `###`, Sub-section `####`).
- `sanitiseMarkdown()` in `scripts/build-pdf.js` strips standalone `---` lines, removes `<hr>` adjacent to headings, normalises heading levels by min-offset, and collapses 3+ blank lines to 2. Idempotent. Emits a non-gating report at `<out>.sanitiser.json`.
- `assets/print.css` scopes `page-break-before: always` to `h1.chapter` only (auto-applied to non-first h1s as a safety net) and protects `h1:first-of-type`. Adds `break-after: avoid` to `h1` and zeros the margin between a heading and its first paragraph.
- `scripts/verify-pdf.js` gains `no-orphan-heading` (8% page-height tolerance) and `no-blank-page` (10% text-density floor) checks; both fail the build and reuse the `CLAIMS_UNVERIFIED` verdict for v0.1.x.
```

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/plugin.json CHANGELOG.md
git commit -m "release: 0.1.1 — PDF spacing fix"
```

---

## Task 18: Stress-test the plugin + push + tag

**Files:**
- None new.

- [ ] **Step 1: Run skill-cheat:skill-stress-test against the plugin**

```bash
SCRIPTS=/Users/hook/.claude/plugins/cache/skill-cheat-local/skill-cheat/0.1.0/skills/skill-stress-test/scripts
TARGET="/Users/hook/Documents/coding/python/Personal_AI  Projects/report"
bash "$SCRIPTS/layer-static.sh" --target "$TARGET" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('layer verdict:', d['verdict'])
for s in d['per_skill']:
    print(f'  {s[\"skill\"]}: {s[\"verdict\"]} ({len(s[\"findings\"])} findings)')
"
```

Expected: `layer verdict: ACCEPT`, both `deep-report` and `using-deep-report` ACCEPT with 0 findings.

- [ ] **Step 2: Run the full test suite**

```bash
cd skills/deep-report
node --test scripts/*.test.js
```

Expected: all tests PASS.

- [ ] **Step 3: Push to GitHub and tag**

```bash
cd "/Users/hook/Documents/coding/python/Personal_AI  Projects/report"
git push origin main
git tag v0.1.1
git push origin v0.1.1
```

- [ ] **Step 4: Verify the public install command still works**

```bash
gh repo view hook12aaa/deep-report --json url,defaultBranchRef,latestRelease 2>&1 | python3 -m json.tool || true
```

Expected: URL `https://github.com/Hook12aaa/deep-report`, default branch `main`, latest release `v0.1.1` (after a moment for GitHub to index the tag).

---

## Self-review

**Spec coverage:**
- Layer 1 (synthesizer prompt) — shipped at cb98af7 before this plan; intentionally out of scope here. ✓
- Layer 2 (sanitiser, 4 rules + idempotence + report) — Tasks 2–8. ✓
- Layer 3 (CSS scope, break-after, adjacent-sibling margin, chapter auto-apply) — Tasks 9–10. ✓
- Layer 4 (no-orphan-heading + no-blank-page + CLI wiring) — Tasks 11–15. ✓
- Testing (unit + integration) — Tasks 2–7 (sanitiser units), Task 12 + 14 (verify units), Task 16 (integration). ✓
- Rollout (version bump, CHANGELOG, stress-test, tag, push) — Tasks 17–18. ✓
- Verdict routing reuses `CLAIMS_UNVERIFIED` — Task 15 implements this implicitly; `RENDER_FAILED` is deferred to v0.2.0 as the spec says. ✓

**Placeholder scan:** No `TBD`, `TODO`, "implement later", "fill in details", or "similar to Task N". Every step has the actual code or the actual command.

**Type/name consistency:**
- `sanitiseMarkdown` used identically in Tasks 2–9. ✓
- `sanitiseWithReport` introduced in Task 8 only, no later reference. ✓
- `checkOrphanHeading`, `checkBlankPage` consistent in Tasks 12–15. ✓
- Field names (`headings`, `allTextRects`, `contentHeightPx`, `contentWidthPx`) consistent across Tasks 11–15. ✓
- Sanitiser report key names (`strip-hr-line`, `strip-hr-tag`, `heading-normalise`, `blank-collapse`) consistent between Task 8 and the spec. ✓

No issues found.
