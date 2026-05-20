# PDF spacing fix — design

**Date:** 2026-05-20
**Status:** Spec — awaiting user review.
**Plugin:** `deep-report` v0.1.0 → v0.1.1.

## Problem

Real-world reports produced by the plugin are landing with two visual defects:

1. **Excessive horizontal rules between sections.** Across one observed run: 129 `---` separators in research-agent drafts (worst offender 43 in a single file), 91 in the synthesizer's drafts. The markdown processor converts every line of three-or-more dashes into an `<hr>` element. The result is a `<hr>` between every heading and its content.
2. **Blank pages before every chapter.** The deployed `assets/print.css` carries `h1 { page-break-before: always; }`. Combined with an `<hr>` immediately above a chapter heading, the rule forces a page break with only the `<hr>` printed above it — a mostly-blank page above each chapter.

Root cause is upstream of CSS: the research and synthesizer subagents have a habit of using `---` as a visual breath between sections. The print stylesheet then turns the habit into a printable failure. The current pipeline has no gate that catches this.

## Goals

- Stop new `---` entering markdown at synthesis time.
- Strip existing `---` / `<hr>` near headings before render.
- Stop blanket `page-break-before` on every h1.
- Make orphaned headings and blank pages a measurable, gating failure rather than a visual surprise.

## Non-goals

- No verdict-vocabulary change in this scope (v0.1.1 reuses `CLAIMS_UNVERIFIED` for render failures; a `RENDER_FAILED` verdict is deferred to a v0.2.0 design revision that re-hashes the integrity block).
- No content rewriting in the sanitiser — it never changes wording, ordering, or argument structure.

## Architecture

Four layers, ordered by catch-rate. Each layer catches a different residual the previous layer missed.

```
synthesizer subagent
  ↓ (HARD-GATE: no ---, heading hierarchy only)
markdown draft
  ↓
sanitiseMarkdown()  (inline in build-pdf.js)
  - strip standalone --- lines
  - strip <hr> adjacent to headings
  - normalise heading levels
  - collapse 3+ blank lines to 2
  ↓ sanitised markdown
markdown → HTML (existing)
  ↓
assets/print.css (scoped)
  - page-break-before: always on h1.chapter only
  - h1:first-of-type → page-break-before: avoid
  - h1 gains break-after: avoid
  - heading + p → margin-top: 0
  ↓
Puppeteer page.pdf()
  ↓
verify-pdf.js (extended)
  + no-orphan-heading check
  + no-blank-page check
  ↓ PDF or CLAIMS_UNVERIFIED with measured failure
```

## Layer 1 — synthesizer subagent prompt

New file: `skills/deep-report/agents/synthesizer.md`. Authored through the full skill-cheat pipeline (`/skill-scope` → `/skill-design` → `/skill-author` → `/skill-voice-review`) so the imperative voice and HARD-GATE shape pass lint against the same contract every other skill in the plugin uses.

**HARD-GATEs:**

1. *Do NOT emit a `---` standalone line anywhere in the draft. STOP and continue with prose.*
2. *Do NOT emit raw `<hr>` HTML. STOP and continue with prose.*
3. *Never use the same heading level for both a Part and a Section. STOP and demote one.*
4. *Do NOT introduce facts not present in the claims ledger. STOP and emit `[NEEDS-RESEARCH]`.*

**Heading-level contract** (locked in the prompt body):

| Element | Heading level |
|---|---|
| Report title | `# H1` (one only) |
| Part (top-level section) | `## H2` |
| Section (within a part) | `### H3` |
| Sub-section | `#### H4` |

**Anti-Pattern:** *"I'll use `---` as a visual breath between sections."* — Markdown horizontal rules are not breathing room; they are semantic dividers that print as printed rules. Use heading hierarchy and paragraph breaks. The renderer handles spacing.

**Refusal token:** `REFUSE:needs-research:<component-id>` on a single line, same shape as `figure-spec-author`. Used when the synthesizer cannot produce the unified document without violating the contract.

## Layer 2 — markdown sanitiser

Inline function `sanitiseMarkdown(text)` in `scripts/build-pdf.js`. Called once before `renderMarkdown(text)`.

**Rules in order of application:**

1. **Strip standalone `---` lines.** Pattern `/^\s*-{3,}\s*$/gm` → empty. Reason: dominant failure mode; markdown processors convert this to `<hr>`.
2. **Strip `<hr>` adjacent to headings.** Two patterns:
   - `/<hr\s*\/?>\s*(<h[1-6])/g` → `$1`
   - `/(<\/h[1-6]>)\s*<hr\s*\/?>/g` → `$1`
   Defence against synthesisers that emit raw HTML.
3. **Normalise heading levels.** Scan markdown, find minimum heading level (count of `#`), compute `offset = min - 1`, subtract offset from every heading. Auto-shifts so the highest in-draft level becomes `h1`.
4. **Collapse 3+ blank lines to 2.** Pattern `/\n{3,}/g` → `"\n\n"`. Prevents synthesizers' visual-breath attempts inflating paragraph spacing.

**Idempotence:** sanitising the same input twice produces the same output. Asserted in tests.

**Sanitiser report:** emitted alongside the build report at `out/<slug>.sanitiser.json`:

```json
{
  "strip-hr-line":     { "occurrences": 91 },
  "strip-hr-tag":      { "occurrences": 0 },
  "heading-normalise": { "offset": 1 },
  "blank-collapse":    { "occurrences": 14 }
}
```

Non-gating. Tracks the bug class over time so synthesiser drift is visible even when downstream layers catch it.

**Out of scope:** no content rewriting, no claim-ledger interaction, no HTML rendering.

## Layer 3 — CSS scope changes

Minimal diff to `assets/print.css`.

```css
/* before */
@media print { h1 { page-break-before: always; } }

/* after */
@media print {
  h1.chapter        { page-break-before: always; }
  h1:first-of-type  { page-break-before: avoid; }
}

h1 {
  font-size: 22pt; line-height: 1.2; margin: 0 0 16pt;
  font-weight: 700;
  break-after: avoid;          /* new — stops orphan headings */
}

h1 + p, h2 + p, h3 + p, h4 + p { margin-top: 0; }  /* new */
```

**Chapter-class application is a safety net, not the primary path.** Under the Layer 1 heading contract every report has exactly one h1 (the title), so `h1.chapter` should never fire in a contract-compliant build. When the synthesizer violates the contract and emits multiple h1s, the renderer applies `class="chapter"` automatically to every h1 after the first — converting "every h1 becomes a forced break" into "only second-and-subsequent h1 chapter-breaks", with the first h1 explicitly protected by `:first-of-type → page-break-before: avoid`. Synthesizer never emits raw HTML for this. The chapter class lives in code, not in the prompt.

## Layer 4 — measurement gate additions

Two new checks in `scripts/verify-pdf.js`. Both run inside the existing Puppeteer pass; no extra browser launch.

### Check A: `no-orphan-heading`

A heading is orphaned when it sits in the bottom 8% of its page with no body content on the same page.

```
for each heading element h1..h4:
    headingBottom     = h.getBoundingClientRect().bottom
    pageNumber        = floor(headingBottom / contentHeightPx)
    pageBottom        = (pageNumber + 1) * contentHeightPx
    distanceToPageEnd = pageBottom - headingBottom
    nextNonHeading    = first sibling element after h that is not a heading
    nextOnSamePage    = floor(nextNonHeading.top / contentHeightPx) === pageNumber

    orphan = distanceToPageEnd < (contentHeightPx * 0.08) AND !nextOnSamePage
```

Tolerance: 8% of page height. Fails the build if any heading is orphaned. Failure record: `{ level, text, pageIndex, distanceToPageEnd }`.

### Check B: `no-blank-page`

A page is blank when text-bearing elements cover less than 10% of the content area.

```
for each page p in 0..pageCount - 1:
    pageRect    = [p * contentH, (p+1) * contentH]
    textBoxes   = all text-bearing elements whose bbox intersects pageRect
    coveredArea = sum of (bbox ∩ pageRect) for each textBox
    density     = coveredArea / (contentWidthPx * contentHeightPx)

    blank = density < 0.10
```

Tolerance: 10% text density. Deliberately low — a page with one figure plus two paragraphs still passes; a page with only a heading and a horizontal rule does not.

### Failure routing

Both checks fail the build (`verify-pdf.js` exits non-zero). Pipeline emits `CLAIMS_UNVERIFIED` for now, with the actual cause logged in the verifier report. A dedicated `RENDER_FAILED` verdict requires re-hashing the integrity block and is scoped to a separate v0.2.0 design revision.

## Testing

**Unit:**

1. `sanitiseMarkdown` golden tests:
   - Input: research-agent draft with 43 `---` separators. Expected: 0 in output.
   - Input: mixed `---` + raw `<hr>` adjacent to headings. Expected: both stripped.
   - Input: synthesizer draft using `##` as max level. Expected: shifted to `#` (offset 1).
   - Input: any output of the sanitiser. Expected: idempotent — `sanitise(sanitise(x)) === sanitise(x)`.
2. CSS regression test (visual): not adopted — we measure, not eyeball. Replaced by:
3. `no-orphan-heading` check tests:
   - Input: synthetic HTML with a heading 5 pixels above page boundary, no content below. Expected: fail with `distanceToPageEnd < 8%`.
   - Input: heading near top of page with content below. Expected: pass.
4. `no-blank-page` check tests:
   - Input: HTML rendering a page with one heading and one `<hr>` only. Expected: fail.
   - Input: page with one figure plus two paragraphs. Expected: pass.

**Integration:**

5. End-to-end smoke against the existing four-figure smoke draft, with a deliberate `---` salting between the prose blocks. Expected: build succeeds, sanitiser report shows non-zero `strip-hr-line`, gate passes.
6. End-to-end with `h1 { page-break-before: always; }` re-added by hand to print.css. Expected: gate fails on `no-orphan-heading` or `no-blank-page`.

## Rollout

1. Author Layer 1 (synthesizer prompt) through skill-cheat pipeline. Produces `agents/synthesizer.md` and `docs/skill-cheat/skills-in-progress/synthesizer/{scope,design}.{md,json}` + sha256 sidecar.
2. Implement Layers 2–4 as a single PR after Layer 1's `AUTHOR_DONE` lands.
3. Run `tests/run-tests.sh` plus the new unit + integration tests.
4. Bump `plugin.json` and `CHANGELOG.md` from 0.1.0 to 0.1.1.
5. Run `skill-cheat:skill-stress-test` against the plugin — expect `VALIDATION_CLEAN`.
6. Tag and push.

## Open decisions deferred to implementation

- **Sanitiser placement** — inline in `build-pdf.js`. Confirmed; not a separate script.
- **Heading-level handling** — auto-shift normalisation. Confirmed; not refuse-the-build.
- **Tolerances** — 8% / 10% as starting values. Confirmed; tune later if needed.
- **Verdict routing** — reuse `CLAIMS_UNVERIFIED` in this scope; `RENDER_FAILED` deferred to v0.2.0.
