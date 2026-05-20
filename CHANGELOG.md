# Changelog

## 0.1.1 — 2026-05-20

Defensive fixes for excessive `<hr>` and blank-page-before-h1 defects.

- New `synthesizer` subagent prompt at `skills/deep-report/agents/synthesizer.md` with HARD-GATEs against `---`, raw `<hr>`, and duplicated heading levels. Four-level heading hierarchy locked (title `#`, Part `##`, Section `###`, Sub-section `####`).
- `sanitiseMarkdown()` in `scripts/build-pdf.js` strips standalone `---` lines, removes `<hr>` adjacent to headings, normalises heading levels by min-offset, and collapses 3+ blank lines to 2. Idempotent. Emits a non-gating report at `<out>.sanitiser.json`.
- `assets/print.css` scopes `page-break-before: always` to `h1.chapter` only (auto-applied to non-first h1s as a safety net) and protects `h1:first-of-type`. Adds `break-after: avoid` to `h1` and zeros the margin between a heading and its first paragraph.
- `scripts/verify-pdf.js` gains `no-orphan-heading` (8% page-height tolerance) and `no-blank-page` (10% text-density floor) checks; both fail the build and reuse the `CLAIMS_UNVERIFIED` verdict for v0.1.x.

Known limitation: the markdown sanitiser does not honour fenced code blocks. Lines starting with `#` inside a `\`\`\`` fence may be treated as headings. The downstream `renderMarkdown` has the same limitation; the synthesizer prompt's HARD-GATEs make this safe in practice. Track for a future pipeline-wide CommonMark pass.

## 0.1.0 — 2026-05-18

First release.

- Nine-stage pipeline: topic confirmation, decomposition, per-component research subagents, claims ledger, verification sidecar, synthesis, figure spec authoring, HTML render, PDF print.
- Four figure families only: hierarchy (Graphviz `dot`, uniform-width nodes), sequence (hand-rolled SVG strip), matrix (CSS Grid), table (semantic `<table>`). Scattered and radial layouts refused at the spec stage.
- Deterministic measurement gate (`scripts/measure-figure.js`) replaces vision review. Reports numbers and tolerances per check; no "looks good".
- Post-render verifier (`scripts/verify-pdf.js`): figure-fit-content-width, WCAG AA text contrast, byte-equal determinism diff after metadata strip.
- Verdict tokens: `REPORT_SHIPPED`, `CLAIMS_UNVERIFIED`, `SCOPE_TOO_VAGUE`.
