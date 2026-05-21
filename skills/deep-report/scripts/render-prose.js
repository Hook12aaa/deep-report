#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

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

export function renderSection(spec) {
  return spec.blocks.map((block) => {
    switch (block.type) {
      case "paragraph": return renderParagraph(block);
      case "why_it_matters": return renderWhyItMatters(block);
      case "bullets": return renderBullets(block);
      case "callout": return renderCallout(block);
      default: throw new Error(`unhandled block type: ${block.type}`);
    }
  }).join("\n\n");
}

const invokedAsCli = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (invokedAsCli) {
  const [specPath, outPath] = process.argv.slice(2);
  if (!specPath) {
    console.error("usage: render-prose.js <spec.json> [out.md]");
    process.exit(64);
  }
  const spec = JSON.parse(await readFile(specPath, "utf8"));
  const md = renderSection(spec);
  if (outPath) {
    await writeFile(outPath, md);
    console.error(`wrote ${outPath}`);
  } else {
    process.stdout.write(md + "\n");
  }
}
