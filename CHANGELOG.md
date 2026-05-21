# Changelog

## 0.2.0 — 2026-05-20

Prose-spec architecture: the synthesiser becomes a JSON-spec author, a deterministic renderer turns specs into markdown, and an eight-metric measurement gate enforces prose quality alongside the existing figure pipeline.

- New `agents/prose-spec-author.md` subagent — reads verified component drafts plus the claims ledger and emits a `prose-section-spec` (paragraph, why_it_matters, bullets, callout blocks) conforming to `schemas/prose-section-spec.schema.json`. Refuses raw markdown.
- New `scripts/render-prose.js` — deterministic spec → markdown. Paragraph blocks join `topic_sentence + claims[]`; fixed-shape blocks render template-style. No LLM call in the renderer.
- New `scripts/measure-prose.js` — eight blocking metrics (Coleman-Liau 9–16, mean sentence 12–24, max sentence ≤40, sentence stdev ≥4, max paragraph ≤120 words, hedge density ≤15/1000, repeated-bigram ≤8%, MATTR-100 ≥0.60). Three advisory metrics (passive voice, heading density, citation density) warn but do not block. Hedge denylist at `assets/hedge-words.txt`.
- New `references/prose-metrics.md` documenting each metric's formula, tolerance, and honest limit.
- New verdict `RENDER_FAILED` — gates that previously routed to `CLAIMS_UNVERIFIED` (no-orphan-heading, no-blank-page, figure-fit, prose-measure) now emit `RENDER_FAILED` instead.
- `scripts/build-pdf.js` accepts `--prose-specs <dir>`, loads specs, renders + measures each section, aborts on any fail. The `sanitiseMarkdown` family is removed — spec-driven prose does not emit `---` or stray `<hr>`.
- Removed `agents/synthesizer.md`, superseded by `agents/prose-spec-author.md`.
- New integration fixtures (`tests/fixtures/prose-spec-{pass,hedge-heavy,monotone}.json`) + new `tests/integration-gates.sh` assertions exercising the prose gate end-to-end.
- New drift markers in `tests/drift-check.sh` for the v0.2 architecture; v0.1.x markers updated to assert the sanitiser removal.

Breaking change for callers wiring directly to `scripts/build-pdf.js`: the `--prose-specs <dir>` flag is now required when the draft contains `{{prose:<id>}}` placeholders. Drafts without placeholders continue to work as in v0.1.1.

## 0.1.1 — 2026-05-20

Defensive fixes for excessive `<hr>` and blank-page-before-h1 defects.

- New `synthesizer` subagent prompt at `skills/deep-report/agents/synthesizer.md` with HARD-GATEs against `---`, raw `<hr>`, and duplicated heading levels. Four-level heading hierarchy locked (title `#`, Part `##`, Section `###`, Sub-section `####`).
- `sanitiseMarkdown()` in `scripts/build-pdf.js` strips standalone `---` lines, strips standalone `<hr>` lines (independent of heading proximity), strips `<hr>` inline-adjacent to HTML headings, normalises heading levels by min-offset, and collapses 3+ blank lines to 2. Idempotent. Emits a non-gating report at `<out>.sanitiser.json`.
- `assets/print.css` scopes `page-break-before: always` to `h1.chapter` only (auto-applied to non-first h1s as a safety net) and protects `h1:first-of-type`. Adds `break-after: avoid` to `h1` and zeros the margin between a heading and its first paragraph.
- `scripts/verify-pdf.js` gains `no-orphan-heading` (8% page-height tolerance) and `no-blank-page` (10% text-density floor) checks; both fail the build and reuse the `CLAIMS_UNVERIFIED` verdict for v0.1.x.
- `tests/drift-check.sh` asserts 45 markers across all four layers (synthesizer HARD-GATEs, sanitiser exports + rules + report keys, CSS scope, verifier checks, release files). Fails the build if any marker drifts.
- `tests/integration-gates.sh` builds 4 deliberately-bad fixtures end-to-end (sparse content, `---` salting, `<hr>` salting, multi-h1) and asserts gate-firing behaviour — sparse content trips `no-blank-page`, all `<hr>` get stripped from rendered HTML, chapter-class applies only to non-first h1. Wired into `tests/run-tests.sh`.

Known limitation: the markdown sanitiser does not honour fenced code blocks. Lines starting with `#` inside a `\`\`\`` fence may be treated as headings. The downstream `renderMarkdown` has the same limitation; the synthesizer prompt's HARD-GATEs make this safe in practice. Track for a future pipeline-wide CommonMark pass.

## 0.1.0 — 2026-05-18

First release.

- Nine-stage pipeline: topic confirmation, decomposition, per-component research subagents, claims ledger, verification sidecar, synthesis, figure spec authoring, HTML render, PDF print.
- Four figure families only: hierarchy (Graphviz `dot`, uniform-width nodes), sequence (hand-rolled SVG strip), matrix (CSS Grid), table (semantic `<table>`). Scattered and radial layouts refused at the spec stage.
- Deterministic measurement gate (`scripts/measure-figure.js`) replaces vision review. Reports numbers and tolerances per check; no "looks good".
- Post-render verifier (`scripts/verify-pdf.js`): figure-fit-content-width, WCAG AA text contrast, byte-equal determinism diff after metadata strip.
- Verdict tokens: `REPORT_SHIPPED`, `CLAIMS_UNVERIFIED`, `SCOPE_TOO_VAGUE`.
