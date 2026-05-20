import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { sanitiseMarkdown } from "./build-pdf.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, "../tests/fixtures/research-draft-43-hrs.md");

test("strips standalone --- lines", () => {
  const input = "Section one\n\n---\n\nSection two\n";
  const out = sanitiseMarkdown(input);
  assert.equal(out.includes("---"), false);
  assert.ok(out.includes("Section one"), "preceding content preserved");
  assert.ok(out.includes("Section two"), "following content preserved");
});

test("strips <hr> adjacent to headings", () => {
  const a = "<hr>\n<h1>Title</h1>";
  const b = "<h1>Title</h1>\n<hr/>";
  const c = "<h2>Section</h2>  <hr />\n<p>body</p>";
  assert.equal(sanitiseMarkdown(a), "<h1>Title</h1>");
  assert.equal(sanitiseMarkdown(b), "<h1>Title</h1>");
  assert.equal(sanitiseMarkdown(c).includes("<hr"), false);
});

test("strips standalone <hr> lines regardless of adjacency", () => {
  const a = "intro\n\n<hr>\n\n## Markdown heading\n\nbody";
  const b = "## Markdown heading\n<hr>\nbody";
  const c = "para\n\n<HR>\n\nmore prose";
  assert.equal(sanitiseMarkdown(a).includes("<hr"), false, "strips <hr> on its own line before a markdown heading");
  assert.equal(sanitiseMarkdown(b).includes("<hr"), false, "strips <hr> on its own line after a markdown heading");
  assert.equal(sanitiseMarkdown(c).includes("<HR"), false, "strips uppercase standalone <HR>");
});

test("strips multiple consecutive <hr> before a heading (idempotence prerequisite)", () => {
  const input = "<hr>\n<hr/>\n<HR>\n<h1>Title</h1>";
  const out = sanitiseMarkdown(input);
  assert.equal(out, "<h1>Title</h1>");
  assert.equal(sanitiseMarkdown(out), out, "idempotent on chained-hr input");
});

test("normalises heading levels by min offset", () => {
  const input = "## Title\n\n### Section\n\nbody\n\n#### Sub\n";
  const out = sanitiseMarkdown(input);
  assert.match(out, /^# Title$/m);
  assert.match(out, /^## Section$/m);
  assert.match(out, /^### Sub$/m);
});

test("leaves heading levels unchanged when min is already 1", () => {
  const input = "# Title\n\n## Part\n\n### Section\n";
  const out = sanitiseMarkdown(input);
  assert.equal(out, input);
});

test("no headings present is a no-op", () => {
  const input = "Just prose, no headings.\n";
  assert.equal(sanitiseMarkdown(input), input);
});

test("normalises heading levels with offset 2 (draft starts at ###)", () => {
  const input = "### Title\n\n#### Section\n\nbody\n";
  const out = sanitiseMarkdown(input);
  assert.match(out, /^# Title$/m);
  assert.match(out, /^## Section$/m);
});

test("collapses 3+ blank lines to 2", () => {
  const input = "para one\n\n\n\n\npara two\n";
  const out = sanitiseMarkdown(input);
  assert.equal(out, "para one\n\npara two\n");
});

test("sanitiseMarkdown is idempotent on its own output", async () => {
  const fixture = await readFile(FIXTURE, "utf8");
  const once = sanitiseMarkdown(fixture);
  const twice = sanitiseMarkdown(once);
  assert.equal(once, twice, "second pass changed the output");
});

test("sanitiseMarkdown strips 43 --- from the worst-offender fixture", async () => {
  const fixture = await readFile(FIXTURE, "utf8");
  const out = sanitiseMarkdown(fixture);
  const remainingHrLines = (out.match(/^\s*-{3,}\s*$/gm) ?? []).length;
  assert.equal(remainingHrLines, 0);
});

import { sanitiseWithReport } from "./build-pdf.js";

test("sanitiseWithReport report shape and accurate counts", () => {
  const input = "## Title\n\n---\n\n<hr>\n<h2>Adjacent</h2>\n\nbody\n\n<hr>\nlone\n";
  const { sanitised, report } = sanitiseWithReport(input);
  assert.equal(typeof sanitised, "string");
  assert.equal(report["strip-hr-line"].occurrences, 1);
  assert.equal(report["strip-hr-tag"].occurrences, 2, "both <hr> tags counted; standalone-line rule strips every <hr>");
  assert.equal(report["heading-normalise"].offset, 1);
  assert.equal(typeof report["blank-collapse"].occurrences, "number");
});
