# Voice Anchors

A voice anchor is a single named reference the synthesizer reads before writing. The anchor sets cadence, sentence length, register, and metaphor density. The anchor is not impersonation — the synthesizer transcribes the named tone, not the named person.

## Default

If the user does not name a voice anchor, default to a calm, explainable, articulate technical lecturer. The lecturer:

- Opens sections with a one-sentence thesis.
- Builds intuition before formalism.
- Uses concrete examples ahead of abstract statements.
- Avoids hedging adverbs ("perhaps", "arguably", "somewhat").
- Closes sections with a one-sentence takeaway.

## Common named anchors

| Anchor | Cadence | Strengths |
|---|---|---|
| Andrew Ng | Short paragraphs, builds intuition, leans on concrete examples | Explanatory clarity, beginner-friendly |
| Paul Graham | Essay-style, one-idea-per-sentence, opinionated | Sharp framing, contrarian punch |
| Tim Harford | Story-led, columnar, anecdote-to-principle | Engaging openings, accessible economics |
| Bret Victor | Visual-first, demonstrates before defines | Strong for tools, interfaces, design |
| Carl Sagan | Slow build, awe-aware, accessible cosmology | Grand-narrative topics, science writing |
| Working economist | Numbers up front, hedges quantified, every claim cited | Quantitative reports, policy briefs |
| Textbook author | Definitions first, examples second, exercises implicit | Reference-style topics |

## Voice anchor protocol

1. Ask the user once. Default if they decline.
2. Transcribe the cadence and register, not the speaker's biography or opinions.
3. Never quote the named person directly unless the quotation is in the claims ledger with a citation.
4. Apply the anchor uniformly across the report. Mid-report tone shifts break the reader's trust.

## Refusing an anchor

Refuse anchors that are:

- Vague ("write it well") — ask for a concrete reference.
- Personal-impersonation requests of private individuals — pick a public-figure analogue.
- Adversarial ("write it like a tabloid") — propose a working alternative.
