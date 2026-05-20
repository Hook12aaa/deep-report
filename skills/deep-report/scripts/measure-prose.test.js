import { test } from "node:test";
import assert from "node:assert/strict";
import { colemanLiau, sentenceStats, maxParagraphWords, hedgeDensity, repeatedBigramPercent, mattr, measureProse } from "./measure-prose.js";

test("colemanLiau on a known sample", () => {
  const text = "The cat sat on the mat. The dog ran. Birds sing.";
  const cli = colemanLiau(text);
  assert.ok(cli > 0, `cli > 0 (got ${cli})`);
  assert.ok(cli < 10, `cli < 10 for elementary text (got ${cli})`);
});

test("colemanLiau is deterministic on the same input", () => {
  const text = "Some prose. With sentences. Three of them.";
  assert.equal(colemanLiau(text), colemanLiau(text));
});
