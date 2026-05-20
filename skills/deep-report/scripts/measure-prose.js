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

export function sentenceStats(_text) { return null; }
export function maxParagraphWords(_text) { return 0; }
export function hedgeDensity(_text, _denylist) { return 0; }
export function repeatedBigramPercent(_text) { return 0; }
export function mattr(_text, _window) { return 0; }
export function measureProse(_text) { return null; }
