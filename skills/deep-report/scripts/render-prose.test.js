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
