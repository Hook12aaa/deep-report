import { test } from "node:test";
import assert from "node:assert/strict";
import { checkOrphanHeading, checkBlankPage } from "./verify-pdf.js";

const PAGE_H = 1000;

test("checkOrphanHeading flags heading in bottom 8% with no content on same page", () => {
  const headings = [{ level: 2, text: "Lonely", top: 940, bottom: 960, nextTop: 1020 }];
  const r = checkOrphanHeading(headings, PAGE_H);
  assert.equal(r.pass, false);
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].text, "Lonely");
});

test("checkOrphanHeading passes when next content is on same page", () => {
  const headings = [{ level: 2, text: "Fine", top: 940, bottom: 960, nextTop: 980 }];
  const r = checkOrphanHeading(headings, PAGE_H);
  assert.equal(r.pass, true);
});

test("checkOrphanHeading passes when heading is in top 92% of page", () => {
  const headings = [{ level: 2, text: "Top", top: 100, bottom: 120, nextTop: 1200 }];
  const r = checkOrphanHeading(headings, PAGE_H);
  assert.equal(r.pass, true);
});
