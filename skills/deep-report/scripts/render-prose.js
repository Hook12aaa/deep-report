#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

export function renderParagraph(block) {
  const sentences = [block.topic_sentence, ...block.claims.map((c) => c.claim)];
  return sentences.join(" ");
}

export function renderWhyItMatters(block) {
  return `**Why it matters:** ${block.stake}`;
}
export function renderBullets(block) {
  return block.items.map((s) => `- ${s}`).join("\n");
}
const CALLOUT_LABELS = { caveat: "Caveat", definition: "Definition", data_point: "Data point" };
export function renderCallout(block) {
  const label = CALLOUT_LABELS[block.kind];
  return `> **${label}:** ${block.body}`;
}
export function renderSection(_spec) { return ""; }
