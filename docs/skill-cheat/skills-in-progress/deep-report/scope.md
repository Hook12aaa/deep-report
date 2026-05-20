# Scope: deep-report

## Name
`deep-report` — generates a deep-dive, claim-verified research PDF on a user-supplied topic.

## Slash command
`/deep-report`

## Triggers
- **slash**: `/deep-report` (only trigger — strict; no auto-detection on natural language).

## Verdict tokens
- `REPORT_SHIPPED` — PDF written, claims verified, visuals constrained to safe layouts.
- `CLAIMS_UNVERIFIED` — research complete but one or more claims failed the verification sidecar; do not ship.
- `SCOPE_TOO_VAGUE` — topic is not actionable for a deep dive; user must refine.

## Anti-Pattern
**"I can write this report in one shot without verification"** — single-pass write-ups are the source of the hallucinated-claim failures (e.g., naming LNER as the London→Cambridge train when it is Greater Northern / Greater Anglia). The skill exists to enforce: decomposition → per-component research agents → claim verification sidecar → unified write-up → HTML→PDF render.

### Supporting red flags (not the anchor, but the gate watches for them)
- "Bullet points are deep enough" — shallow output without scope guidance.
- "Skip claim verification — the research agents are already grounded."

## Target project path
`/Users/hook/Documents/coding/python/Personal_AI  Projects/report` (confirmed to exist on disk).

## Plugin mode
**new** — full plugin scaffold (plugin.json, hooks, skills/) so `/deep-report` is packageable and globally installable.

## Pipeline shape (scope-locked, design happens in next stage)
1. **Scope-the-topic agent** — refines vague topics, emits `SCOPE_TOO_VAGUE` if not actionable. Sets tone-of-voice anchor (default: Andrew Ng — explainable, articulate, clear).
2. **Decomposer** — breaks topic into core components.
3. **Per-component research agents** — one per component, each writes a markdown file with sources cited inline.
4. **Claim verification sidecar** — extracts claims, grounds each against a source (web or embedding), flags unverifiable claims → `CLAIMS_UNVERIFIED`.
5. **Master synthesizer** — unifies markdown into one document in the requested voice/depth (smart-brevity vs. extreme-detail toggle).
6. **Renderer** — HTML + JS (no Python PDF libs); HTML→PDF via headless Chromium. Visuals constrained to org-chart-style structured diagrams; scattered mind maps disallowed.
7. **Verdict emission** — `REPORT_SHIPPED` / `CLAIMS_UNVERIFIED` / `SCOPE_TOO_VAGUE`.

## Known constraints (locked-in)
- Output: PDF (rendered from HTML, not Python PDF libraries).
- Voice default: Andrew Ng (user can override).
- Visual policy: structured/org-chart layouts only; scattered mind maps banned.
- Depth policy: user picks `smart-brevity` or `extreme-detail` at start.
- Past report corpus to study during design stage: `ai_notes`, `research_notes`, `ai_content_creation`, `org` (best example: the computational-neurons paper in `org`).
