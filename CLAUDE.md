# deep-report

Plugin that emits a `/deep-report` slash command. Generates a claim-verified, deep-dive PDF research report on a user-supplied topic.

## Pipeline shape

1. Confirm topic, voice anchor, and depth mode with the user.
2. Decompose the topic into core components.
3. Spawn one research subagent per component.
4. Extract every load-bearing claim into a claims ledger.
5. Run the claim verification sidecar against each claim.
6. Synthesize the verified component drafts into one unified document.
7. Spec every figure as a structured layout (hierarchy, sequence, matrix, or table).
8. Render the document as styled HTML, then print to PDF via a headless browser.
9. Emit the verdict token.

## Verdict tokens

- `REPORT_SHIPPED` — PDF rendered and every claim carries `verdict=verified`.
- `CLAIMS_UNVERIFIED` — one or more load-bearing claims failed the verifier.
- `SCOPE_TOO_VAGUE` — topic was rejected at the confirmation step.

## Invocation

Type `/deep-report` to trigger the skill. The bootstrap is loaded on session start.
