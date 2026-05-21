#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const MM_TO_PX = 96 / 25.4;
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN_LEFT_MM = 24;
const MARGIN_RIGHT_MM = 24;
const MARGIN_TOP_MM = 22;
const MARGIN_BOTTOM_MM = 22;
const CONTRAST_BODY = 4.5;
const CONTRAST_LARGE = 3.0;

function parseArgs(argv) {
  const args = { html: null, pdf: null, secondPdf: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--html") args.html = argv[++i];
    else if (a === "--pdf") args.pdf = argv[++i];
    else if (a === "--second-pdf") args.secondPdf = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--help") args.help = true;
  }
  return args;
}

function relLuminance(r, g, b) {
  const toLin = (c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrastRatio(rgb1, rgb2) {
  const l1 = relLuminance(...rgb1);
  const l2 = relLuminance(...rgb2);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

function parseRgb(css) {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return [+m[1], +m[2], +m[3]];
}

async function loadPuppeteer() {
  try {
    return (await import("puppeteer")).default;
  } catch {
    throw new Error("puppeteer is required: run `npm install puppeteer` in the skill directory");
  }
}

async function measureHtmlPage(htmlPath) {
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    const contentWidthPx = Math.round((PAGE_W_MM - MARGIN_LEFT_MM - MARGIN_RIGHT_MM) * MM_TO_PX);
    const contentHeightPx = Math.round((PAGE_H_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM) * MM_TO_PX);
    await page.setViewport({ width: contentWidthPx, height: contentHeightPx });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);

    const measurements = await page.evaluate(({ MM_TO_PX, MARGIN_LEFT_MM, MARGIN_RIGHT_MM, PAGE_W_MM }) => {
      const contentLeft = MARGIN_LEFT_MM * MM_TO_PX;
      const contentRight = (PAGE_W_MM - MARGIN_RIGHT_MM) * MM_TO_PX;
      const contentWidth = contentRight - contentLeft;

      const figures = [...document.querySelectorAll("figure.figure")].map((f) => {
        const r = f.getBoundingClientRect();
        return {
          id: f.id,
          family: f.dataset.family,
          left: r.left,
          right: r.right,
          width: r.width,
          height: r.height,
          overflowLeft: contentLeft - r.left,
          overflowRight: r.right - contentRight,
        };
      });

      const textElements = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.nodeValue.trim();
        if (!text) continue;
        const parent = node.parentElement;
        if (!parent) continue;
        if (["SCRIPT", "STYLE"].includes(parent.tagName)) continue;
        const cs = getComputedStyle(parent);
        textElements.push({
          tag: parent.tagName,
          fontSizePt: parseFloat(cs.fontSize) * 0.75,
          fontWeight: cs.fontWeight,
          color: cs.color,
          background: bgColorOf(parent),
          sample: text.slice(0, 40),
        });
      }

      function bgColorOf(el) {
        let cur = el;
        while (cur) {
          const cs = getComputedStyle(cur);
          if (cs.backgroundColor && !cs.backgroundColor.includes("rgba(0, 0, 0, 0)")) return cs.backgroundColor;
          cur = cur.parentElement;
        }
        return "rgb(255, 255, 255)";
      }

      const headings = [...document.querySelectorAll("h1, h2, h3, h4")].map((h) => {
        const r = h.getBoundingClientRect();
        const next = (() => {
          let n = h.nextElementSibling;
          while (n && /^H[1-6]$/.test(n.tagName)) n = n.nextElementSibling;
          return n ? n.getBoundingClientRect() : null;
        })();
        return {
          level: +h.tagName.slice(1),
          text: (h.textContent ?? "").trim().slice(0, 80),
          top: r.top,
          bottom: r.bottom,
          nextTop: next ? next.top : null,
        };
      });

      const allTextRects = [...document.querySelectorAll("p, li, td, th, figcaption, h1, h2, h3, h4, h5, h6")].map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      });

      return { contentLeft, contentRight, contentWidth, figures, textElements, headings, allTextRects };
    }, { MM_TO_PX, MARGIN_LEFT_MM, MARGIN_RIGHT_MM, PAGE_W_MM });

    return { ...measurements, contentHeightPx, contentWidthPx };
  } finally {
    await browser.close();
  }
}

function checkFigureFit(figures, contentWidthPx) {
  const measured = figures.map((f) => ({
    id: f.id,
    family: f.family,
    width: f.width,
    contentWidth: contentWidthPx,
    overflow: f.width - contentWidthPx,
  }));
  const failures = measured.filter((f) => f.overflow > 0.5);
  return {
    name: "figure-fit-content-width",
    measured,
    tolerance: 0.5,
    pass: failures.length === 0,
    failures,
  };
}

function checkTextContrast(textElements) {
  const failures = [];
  const dedup = new Map();
  for (const e of textElements) {
    const key = `${e.color}|${e.background}|${e.fontSizePt}|${e.fontWeight}`;
    if (dedup.has(key)) continue;
    dedup.set(key, e);
  }
  const samples = [...dedup.values()];
  for (const e of samples) {
    const fg = parseRgb(e.color);
    const bg = parseRgb(e.background);
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    const isLarge = e.fontSizePt >= 14 || (e.fontSizePt >= 11 && +e.fontWeight >= 700);
    const threshold = isLarge ? CONTRAST_LARGE : CONTRAST_BODY;
    if (ratio < threshold) {
      failures.push({ ...e, ratio: Math.round(ratio * 100) / 100, threshold });
    }
  }
  return {
    name: "text-contrast-wcag-aa",
    measured: { sampled: samples.length, failures },
    pass: failures.length === 0,
  };
}

export function checkOrphanHeading(headings, contentHeightPx, tolerance = 0.08) {
  const orphanThresholdPx = contentHeightPx * tolerance;
  const failures = [];
  const measured = headings.map((h) => {
    const pageNumber = Math.floor(h.bottom / contentHeightPx);
    const pageBottom = (pageNumber + 1) * contentHeightPx;
    const distanceToPageEnd = pageBottom - h.bottom;
    const nextOnSamePage = h.nextTop !== null && Math.floor(h.nextTop / contentHeightPx) === pageNumber;
    const orphan = distanceToPageEnd < orphanThresholdPx && !nextOnSamePage;
    const record = { level: h.level, text: h.text, pageIndex: pageNumber, distanceToPageEnd };
    if (orphan) failures.push(record);
    return record;
  });
  return {
    name: "no-orphan-heading",
    measured,
    tolerance: `${(tolerance * 100).toFixed(0)}% of page height`,
    pass: failures.length === 0,
    failures,
  };
}

export function checkBlankPage(allTextRects, contentHeightPx, contentWidthPx, threshold = 0.10) {
  const totalContent = allTextRects.reduce((m, r) => Math.max(m, r.bottom), 0);
  const pageCount = Math.max(1, Math.ceil(totalContent / contentHeightPx));
  const pageArea = contentHeightPx * contentWidthPx;
  const failures = [];
  const measured = [];
  for (let p = 0; p < pageCount; p++) {
    const top = p * contentHeightPx;
    const bottom = (p + 1) * contentHeightPx;
    let covered = 0;
    for (const r of allTextRects) {
      const ix1 = Math.max(r.top, top);
      const ix2 = Math.min(r.bottom, bottom);
      if (ix2 <= ix1) continue;
      const w = Math.min(r.right, contentWidthPx) - Math.max(r.left, 0);
      if (w <= 0) continue;
      covered += (ix2 - ix1) * w;
    }
    const density = covered / pageArea;
    const record = { pageIndex: p, density: Math.round(density * 10000) / 10000 };
    measured.push(record);
    if (density < threshold) failures.push(record);
  }
  return {
    name: "no-blank-page",
    measured,
    tolerance: `${(threshold * 100).toFixed(0)}% text density`,
    pass: failures.length === 0,
    failures,
  };
}

function stripPdfMetadataBytes(buf) {
  const lines = buf.toString("latin1").split("\n");
  return lines
    .filter((l) => !/^\/(CreationDate|ModDate|Producer|ID)/.test(l.trim()))
    .filter((l) => !/<<[\s\S]*\/CreationDate[\s\S]*>>/.test(l))
    .join("\n");
}

async function checkDeterminism(pdfPath, secondPath) {
  if (!secondPath) return { name: "determinism", pass: true, skipped: "no --second-pdf provided" };
  const [a, b] = await Promise.all([readFile(pdfPath), readFile(secondPath)]);
  const hashA = createHash("sha256").update(stripPdfMetadataBytes(a)).digest("hex");
  const hashB = createHash("sha256").update(stripPdfMetadataBytes(b)).digest("hex");
  return {
    name: "determinism",
    measured: { hashA, hashB, equal: hashA === hashB, bytesA: a.length, bytesB: b.length },
    pass: hashA === hashB,
  };
}

const invokedAsCli = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (invokedAsCli) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.html) {
    console.error("usage: verify-pdf.js --html <built.html> [--pdf <built.pdf>] [--second-pdf <other.pdf>] [--out <report.json>]");
    process.exit(64);
  }

  const m = await measureHtmlPage(args.html);
  const checks = [
    checkFigureFit(m.figures, m.contentWidth),
    checkTextContrast(m.textElements),
    checkOrphanHeading(m.headings, m.contentHeightPx),
    checkBlankPage(m.allTextRects, m.contentHeightPx, m.contentWidthPx),
  ];
  if (args.pdf) {
    checks.push(await checkDeterminism(args.pdf, args.secondPdf));
  }
  const verdict = checks.every((c) => c.pass || c.skipped) ? "pass" : "fail";
  const report = {
    verdict,
    failureToken: verdict === "fail" ? "RENDER_FAILED" : null,
    html: args.html,
    pdf: args.pdf ?? null,
    checks,
  };
  const out = JSON.stringify(report, null, 2);
  if (args.out) await writeFile(args.out, out);
  else process.stdout.write(out + "\n");
  process.exit(verdict === "pass" ? 0 : 1);
}
