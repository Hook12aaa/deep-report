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

test("hedgeDensity counts hedges per 1000 words against denylist", () => {
  const denylist = new Set(["may", "might", "could"]);
  const text = "It may rain. It might snow. It could hail. It will stay dry.";
  const density = hedgeDensity(text, denylist);
  assert.ok(density > 0);
  const words = 12;
  assert.equal(Math.round(density), Math.round((3 / words) * 1000));
});

test("hedgeDensity is zero when no hedges present", () => {
  const denylist = new Set(["may", "might"]);
  assert.equal(hedgeDensity("Clear assertion. Concrete fact.", denylist), 0);
});

test("repeatedBigramPercent on text with deliberate repetition", () => {
  const text = "the cat sat. the cat sat. fresh prose follows.";
  const pct = repeatedBigramPercent(text);
  assert.ok(pct > 0, `expected pct > 0 (got ${pct})`);
});

test("repeatedBigramPercent on diverse text returns near zero", () => {
  const text = "alpha beta gamma delta epsilon zeta eta theta iota kappa.";
  assert.equal(repeatedBigramPercent(text), 0);
});
