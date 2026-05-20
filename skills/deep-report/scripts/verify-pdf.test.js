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

test("checkBlankPage flags pages below 10% text density", () => {
  const rects = [
    { top: 10,   bottom: 30,   left: 0, right: 50 },
    { top: 1010, bottom: 1030, left: 0, right: 50 },
  ];
  const r = checkBlankPage(rects, PAGE_H, 612);
  assert.equal(r.pass, false);
  assert.equal(r.failures.length, 2);
});

test("checkBlankPage passes when page covered above threshold", () => {
  const rects = [{ top: 0, bottom: 800, left: 0, right: 612 }];
  const r = checkBlankPage(rects, PAGE_H, 612);
  assert.equal(r.pass, true);
});
