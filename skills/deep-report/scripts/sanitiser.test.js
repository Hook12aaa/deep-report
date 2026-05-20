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

test("strips multiple consecutive <hr> before a heading (idempotence prerequisite)", () => {
  const input = "<hr>\n<hr/>\n<HR>\n<h1>Title</h1>";
  const out = sanitiseMarkdown(input);
  assert.equal(out, "<h1>Title</h1>");
  assert.equal(sanitiseMarkdown(out), out, "idempotent on chained-hr input");
});
