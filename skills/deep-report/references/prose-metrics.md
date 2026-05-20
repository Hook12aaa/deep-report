# Prose Metrics

The prose measurement gate runs eight blocking checks against the rendered markdown of each section. A section fails if any blocking check returns `pass: false`. Three advisory metrics warn but do not block.

## Blocking metrics

| # | Metric | Formula | Tolerance | What it catches |
|---|---|---|---|---|
| 1 | Coleman-Liau Index | `0.0588·L − 0.296·S − 15.8` where L = letters per 100 words and S = sentences per 100 words | 9 ≤ CLI ≤ 16 | Walls of jargon or baby-talk |
| 2 | Mean sentence length | `words / sentences` | 12 ≤ mean ≤ 24 | Verbosity baseline |
| 3 | Max sentence length | `max(words per sentence)` | ≤ 40 | The one 80-word sentence |
| 4 | Sentence-length stdev | `stdev(words per sentence)` | ≥ 4.0 | Monotone cadence |
| 5 | Max paragraph length | `max(words per paragraph)` | ≤ 120 | Dump paragraphs |
| 6 | Hedge density | `1000 · hedges / words` against the denylist | ≤ 15 | Mushy non-claims |
| 7 | Repeated-bigram percent | `100 · repeated_bigrams / total_bigrams` | ≤ 8 | Surface redundancy |
| 8 | MATTR-100 | Moving-average type-token ratio over 100-word windows | ≥ 0.60 | Vocabulary crutches |

## Advisory metrics (warn, do not block)

- Passive-voice rate (regex-based, ~60% precision)
- Heading density (varies too much by content type to gate)
- Citation density (depends on report depth)

## Hedge denylist

`assets/hedge-words.txt` ships 26 entries derived from the skill-cheat hedge denylist plus LLM-overrepresented hedges. Update the asset to tune the gate without code changes.

## Coleman-Liau, not Flesch-Kincaid

CLI is character-based, so it is reproducible across syllable-counter implementations. Flesch-Kincaid disagrees across `textstat`, `py-readability-metrics`, and `words/syllable` by 0.1–0.5 grade levels. CLI removes that source of drift.

## Honest limits

The gate is a floor, not a ceiling. It catches:

- Bloated sentences and run-on paragraphs.
- Hedge clouds and vocabulary crutches.
- Surface redundancy.
- Under- or over-segmented prose.

It does not catch:

- Factual wrongness (the claim verifier owns this).
- Tonal mismatch.
- Argument quality.
- Persuasiveness.
- Citation faithfulness (density is counted; correctness is not measured).
