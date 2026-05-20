#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEDGE_LIST_PATH = resolve(__dirname, "../assets/hedge-words.txt");

export function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function splitWords(text) {
  return text.match(/[A-Za-z0-9'-]+/g) ?? [];
}

export function splitParagraphs(text) {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
}

export function colemanLiau(text) {
  const words = splitWords(text);
  const sentences = splitSentences(text);
  if (words.length === 0 || sentences.length === 0) return 0;
  const chars = words.join("").length;
  const L = (chars / words.length) * 100;
  const S = (sentences.length / words.length) * 100;
  return 0.0588 * L - 0.296 * S - 15.8;
}

export function sentenceStats(text) {
  const counts = splitSentences(text).map((s) => splitWords(s).length);
  if (counts.length === 0) return { counts: [], mean: 0, max: 0, stdev: 0 };
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const max = Math.max(...counts);
  const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
  const stdev = Math.sqrt(variance);
  return { counts, mean, max, stdev };
}
export function maxParagraphWords(text) {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) return 0;
  return Math.max(...paragraphs.map((p) => splitWords(p).length));
}
export function hedgeDensity(text, denylist) {
  const words = splitWords(text).map((w) => w.toLowerCase());
  if (words.length === 0) return 0;
  const hedges = words.filter((w) => denylist.has(w)).length;
  return (hedges / words.length) * 1000;
}

export async function loadHedgeDenylist() {
  const raw = await readFile(HEDGE_LIST_PATH, "utf8");
  return new Set(raw.split("\n").map((w) => w.trim().toLowerCase()).filter((w) => w.length > 0));
}
export function repeatedBigramPercent(text) {
  const words = splitWords(text).map((w) => w.toLowerCase());
  if (words.length < 2) return 0;
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) bigrams.push(words[i] + " " + words[i + 1]);
  const counts = new Map();
  for (const b of bigrams) counts.set(b, (counts.get(b) ?? 0) + 1);
  let repeated = 0;
  for (const c of counts.values()) if (c > 1) repeated += c;
  return (repeated / bigrams.length) * 100;
}
export function mattr(text, window) {
  const words = splitWords(text).map((w) => w.toLowerCase());
  if (words.length === 0) return 0;
  if (words.length <= window) return new Set(words).size / words.length;
  const ratios = [];
  for (let i = 0; i + window <= words.length; i++) {
    const slice = words.slice(i, i + window);
    ratios.push(new Set(slice).size / window);
  }
  return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}
export function measureProse(_text) { return null; }
