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
