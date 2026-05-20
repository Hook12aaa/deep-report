# Changelog

## 0.1.0 — 2026-05-18

First release.

- Nine-stage pipeline: topic confirmation, decomposition, per-component research subagents, claims ledger, verification sidecar, synthesis, figure spec authoring, HTML render, PDF print.
- Four figure families only: hierarchy (Graphviz `dot`, uniform-width nodes), sequence (hand-rolled SVG strip), matrix (CSS Grid), table (semantic `<table>`). Scattered and radial layouts refused at the spec stage.
- Deterministic measurement gate (`scripts/measure-figure.js`) replaces vision review. Reports numbers and tolerances per check; no "looks good".
- Post-render verifier (`scripts/verify-pdf.js`): figure-fit-content-width, WCAG AA text contrast, byte-equal determinism diff after metadata strip.
- Verdict tokens: `REPORT_SHIPPED`, `CLAIMS_UNVERIFIED`, `SCOPE_TOO_VAGUE`.
