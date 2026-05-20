#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

export function renderParagraph(block) {
  const sentences = [block.topic_sentence, ...block.claims.map((c) => c.claim)];
  return sentences.join(" ");
}

export function renderWhyItMatters(_block) { return ""; }
export function renderBullets(_block) { return ""; }
export function renderCallout(_block) { return ""; }
export function renderSection(_spec) { return ""; }
