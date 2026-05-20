#!/usr/bin/env node

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { dirname, resolve, basename, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { render } from "./render-figure.js";
import { measure } from "./measure-figure.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, "..");
const PRINT_CSS_PATH = resolve(SKILL_ROOT, "assets/print.css");

export function sanitiseMarkdown(text) {
  let out = text;
  out = out.replace(/^\s*-{3,}\s*$/gm, "");
  out = out.replace(/(<hr\s*\/?>\s*)+(<h[1-6])/gi, "$2");
  out = out.replace(/(<\/h[1-6]>)(\s*<hr\s*\/?>)+/gi, "$1");
  return out;
}

function parseArgs(argv) {
  const args = { draft: null, specs: null, out: null, html: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--draft") args.draft = argv[++i];
    else if (a === "--specs") args.specs = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--html") args.html = argv[++i];
    else if (a === "--help") args.help = true;
  }
  return args;
}

async function loadSpecs(specsDir) {
  if (!specsDir) return new Map();
  const entries = await readdir(specsDir);
  const out = new Map();
  for (const e of entries) {
    if (!e.endsWith(".json")) continue;
    const path = resolve(specsDir, e);
    const spec = JSON.parse(await readFile(path, "utf8"));
    if (!spec.id) throw new Error(`spec ${path} missing id`);
    out.set(spec.id, { spec, path });
  }
  return out;
}

async function renderAndMeasureAll(specs) {
  const renderedById = new Map();
  const failures = [];
  for (const [id, { spec, path }] of specs) {
    let html;
    try {
      html = render(spec);
    } catch (err) {
      failures.push({ id, path, stage: "render", error: err.message });
      continue;
    }
    const report = measure(html, spec.family);
    if (report.verdict !== "pass") {
      failures.push({ id, path, stage: "measure", report });
      continue;
    }
    renderedById.set(id, { html, family: spec.family, report });
  }
  return { renderedById, failures };
}

function escapeHtmlAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlText(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMarkdownInline(text) {
  return text
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtmlText(c)}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${c}</strong>`)
    .replace(/(^|[^*])\*([^*\n]+)\*/g, (_, pre, c) => `${pre}<em>${c}</em>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${escapeHtmlAttr(u)}">${t}</a>`);
}

function renderMarkdown(text) {
  const blocks = text.split(/\n\n+/);
  const out = [];
  for (const raw of blocks) {
    const block = raw.replace(/\n$/, "");
    if (!block.trim()) continue;
    if (/^\{\{fig:[A-Za-z_][A-Za-z0-9_]*\}\}\s*$/.test(block.trim())) {
      out.push(block.trim());
      continue;
    }
    const heading = block.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/m.test(block) && block.split("\n").every((l) => /^[-*]\s+/.test(l) || /^\s+\S/.test(l))) {
      const items = block.split(/\n(?=[-*]\s+)/).map((l) => l.replace(/^[-*]\s+/, ""));
      out.push("<ul>" + items.map((i) => `<li>${renderMarkdownInline(i)}</li>`).join("") + "</ul>");
      continue;
    }
    if (/^\d+\.\s+/m.test(block) && block.split("\n").every((l) => /^\d+\.\s+/.test(l) || /^\s+\S/.test(l))) {
      const items = block.split(/\n(?=\d+\.\s+)/).map((l) => l.replace(/^\d+\.\s+/, ""));
      out.push("<ol>" + items.map((i) => `<li>${renderMarkdownInline(i)}</li>`).join("") + "</ol>");
      continue;
    }
    out.push(`<p>${renderMarkdownInline(block.replace(/\n/g, " "))}</p>`);
  }
  return out.join("\n");
}

function substituteFigures(html, renderedById) {
  return html.replace(/\{\{fig:([A-Za-z_][A-Za-z0-9_]*)\}\}/g, (_, id) => {
    const r = renderedById.get(id);
    if (!r) throw new Error(`figure id '${id}' referenced but not found in specs dir`);
    return r.html;
  });
}

async function buildDocument(draftMd, renderedById, css) {
  const body = substituteFigures(renderMarkdown(draftMd), renderedById);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>deep-report</title>
<style>
${css}
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

async function printToPdf(htmlPath, outPath) {
  let puppeteer;
  try {
    puppeteer = (await import("puppeteer")).default;
  } catch {
    throw new Error("puppeteer is required: run `npm install puppeteer` in the skill directory");
  }
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const url = pathToFileURL(htmlPath).href;
    await page.goto(url, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
}

const invokedAsCli = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (invokedAsCli) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.draft || !args.out) {
    console.error(
      "usage: build-pdf.js --draft <draft.md> [--specs <dir>] --out <out.pdf> [--html <out.html>]"
    );
    process.exit(64);
  }

  const draftMd = await readFile(args.draft, "utf8");
  const specs = await loadSpecs(args.specs);
  const { renderedById, failures } = await renderAndMeasureAll(specs);

  if (failures.length > 0) {
    console.error(JSON.stringify({ stage: "measurement", failures }, null, 2));
    process.exit(2);
  }

  const css = await readFile(PRINT_CSS_PATH, "utf8");
  const fullHtml = await buildDocument(draftMd, renderedById, css);

  const htmlPath = args.html ?? resolve(dirname(args.out), basename(args.out, extname(args.out)) + ".html");
  await mkdir(dirname(htmlPath), { recursive: true });
  await writeFile(htmlPath, fullHtml);

  await mkdir(dirname(args.out), { recursive: true });
  await printToPdf(htmlPath, args.out);

  const report = {
    draft: args.draft,
    specs: args.specs ?? null,
    html: htmlPath,
    pdf: args.out,
    figures: [...renderedById.entries()].map(([id, r]) => ({ id, family: r.family, verdict: r.report.verdict })),
  };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
