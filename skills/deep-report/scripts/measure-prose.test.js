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

test("sentenceStats returns mean, max, stdev over word counts", () => {
  const text = "One word. Two words here. Three more words follow this sentence.";
  const s = sentenceStats(text);
  assert.deepEqual(s.counts, [2, 3, 6]);
  assert.equal(s.mean, (2 + 3 + 6) / 3);
  assert.equal(s.max, 6);
  assert.ok(s.stdev > 0);
});

test("maxParagraphWords returns largest paragraph by word count", () => {
  const text = "Short para.\n\nLonger paragraph with more words inside it.\n\nMid one here.";
  assert.equal(maxParagraphWords(text), 7);
});
