# Verifier Protocol

The claim verification sidecar runs after the research subagents and before synthesis. The sidecar reads `report/claims.jsonl` and writes a `verdict` to every row.

## Source-trust order

When a claim cites multiple sources, fetch and compare in this order. Stop at the first source that confirms or contradicts.

1. **Primary record** — the document or system that *is* the fact: a statute, a court ruling, a regulator filing, a published dataset, a peer-reviewed paper, a company's own announcement, a transit operator's own timetable.
2. **Official aggregator** — a government statistics bureau, a regulator's summary page, a standards body.
3. **Reputable secondary** — a major newspaper of record, a peer-reviewed survey, a textbook.
4. **Tertiary** — encyclopedias, knowledge bases. Treat as a pointer to a primary source, not as a citation.

Refuse:

- Search-engine result pages.
- Social-media posts.
- AI-generated summaries.
- Pages where the publication date is missing or older than the claim's referenced event.

## Close-paraphrase rule

A claim is `verified` when the source contains the same fact, expressed in equivalent terms, within a tolerance:

- Numbers must match to the precision the claim asserts.
- Named entities (people, organizations, routes, operators) must be the exact names used by the source.
- Dates must match to the same calendar day, unless the claim is explicitly year-only.
- Quoted text must be verbatim; paraphrased text must preserve meaning.

A claim is `contradicted` when the source asserts a different specific fact at the same level of detail.

A claim is `unverified` when the source does not address the claim, or when the source could not be fetched.

## Ledger row shape

```
{
  "id": "<component-slug>-<n>",
  "component": "<component-slug>",
  "claim": "<verbatim claim text>",
  "cited_source": "<url-or-doc-id>",
  "verdict": "pending" | "verified" | "unverified" | "contradicted",
  "verifier_note": "<one-line evidence from the source>"
}
```

## Corrective pass

After the first verifier pass, every row carrying `unverified` or `contradicted` is sent back to the component subagent that authored it. The subagent re-researches with the verifier note in hand. The verifier then runs once more. If any row remains non-`verified`, emit `CLAIMS_UNVERIFIED` and stop.

One corrective pass only. Repeated re-research churns budget without raising precision.

## What the verifier does NOT do

- Does not introduce new claims.
- Does not soften the claim to match a weaker source.
- Does not accept "the model knows this" as verification.
- Does not run on prose that is not in the ledger.

## Worked example

Claim: "The London-to-Cambridge train is operated by Greater Anglia."

Verifier fetches the National Rail station-search page for Cambridge. The page lists Great Northern (Thameslink) and Greater Anglia as the operators serving Cambridge, with Great Northern running the King's Cross route. Verdict: `contradicted` — the King's Cross to Cambridge service is Great Northern, not Greater Anglia. Verifier note records the contradiction. The component subagent re-researches; the claim is rewritten as "operated by Great Northern" and re-verified against the same page. Verdict on second pass: `verified`.
