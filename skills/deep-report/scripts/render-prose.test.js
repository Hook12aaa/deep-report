import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSection, renderParagraph, renderWhyItMatters, renderBullets, renderCallout } from "./render-prose.js";

test("renderParagraph joins topic sentence and claims", () => {
  const block = {
    type: "paragraph",
    topic_sentence: "Attention won.",
    claims: [
      { claim: "AlexNet dropped error to 15%.", evidence_refs: ["a"] },
      { claim: "Transformers matched RNN baselines.", evidence_refs: ["b"] },
    ],
    max_words: 100,
  };
  const out = renderParagraph(block);
  assert.match(out, /^Attention won\./);
  assert.match(out, /AlexNet dropped error to 15%\./);
  assert.match(out, /Transformers matched RNN baselines\./);
});

test("renderWhyItMatters emits a bolded one-line stake", () => {
  const block = { type: "why_it_matters", stake: "Compute is the new bottleneck." };
  const out = renderWhyItMatters(block);
  assert.equal(out, "**Why it matters:** Compute is the new bottleneck.");
});

test("renderBullets emits a markdown unordered list", () => {
  const block = { type: "bullets", items: ["alpha", "beta", "gamma"] };
  const out = renderBullets(block);
  assert.equal(out, "- alpha\n- beta\n- gamma");
});

test("renderCallout emits a blockquote prefixed with the kind", () => {
  assert.equal(
    renderCallout({ type: "callout", kind: "caveat", body: "Numbers from 2024 baseline." }),
    "> **Caveat:** Numbers from 2024 baseline."
  );
  assert.equal(
    renderCallout({ type: "callout", kind: "definition", body: "Attention: a weighted combination of values." }),
    "> **Definition:** Attention: a weighted combination of values."
  );
  assert.equal(
    renderCallout({ type: "callout", kind: "data_point", body: "1.2 trillion tokens." }),
    "> **Data point:** 1.2 trillion tokens."
  );
});

test("renderSection joins blocks separated by blank lines", () => {
  const spec = {
    section_id: "demo",
    purpose: "test the dispatcher",
    audience: "technical",
    blocks: [
      { type: "paragraph", topic_sentence: "Lead.", claims: [{ claim: "Follow.", evidence_refs: ["a"] }], max_words: 80 },
      { type: "why_it_matters", stake: "It matters." },
      { type: "bullets", items: ["one", "two"] },
    ],
  };
  const out = renderSection(spec);
  assert.match(out, /^Lead\. Follow\.\n\n\*\*Why it matters:\*\* It matters\.\n\n- one\n- two$/);
});

test("renderSection idempotent on its own output structure", () => {
  const spec = {
    section_id: "demo",
    purpose: "test",
    audience: "general",
    blocks: [{ type: "bullets", items: ["a", "b"] }],
  };
  const first = renderSection(spec);
  const second = renderSection(spec);
  assert.equal(first, second);
});
