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
});
