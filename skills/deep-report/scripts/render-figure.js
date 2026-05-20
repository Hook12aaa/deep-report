#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCHEMA_PATH = resolve(__dirname, "../schemas/figure-spec.schema.json");

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeDotLabel(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function validateSpec(spec) {
  if (!spec || typeof spec !== "object") throw new Error("spec must be an object");
  if (!spec.family) throw new Error("spec.family is required");
  if (!["hierarchy", "sequence", "matrix", "table"].includes(spec.family)) {
    throw new Error(`spec.family must be one of hierarchy|sequence|matrix|table, got ${spec.family}`);
  }
  if (!spec.id || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(spec.id)) {
    throw new Error("spec.id must be an identifier");
  }
  if (!spec.caption) throw new Error("spec.caption is required");
}

function renderHierarchy(spec) {
  const ids = new Set(spec.nodes.map((n) => n.id));
  if (!ids.has(spec.root)) throw new Error(`hierarchy.root '${spec.root}' is not in nodes`);
  for (const e of spec.edges) {
    if (!ids.has(e.from)) throw new Error(`edge.from '${e.from}' not in nodes`);
    if (!ids.has(e.to)) throw new Error(`edge.to '${e.to}' not in nodes`);
  }

  const FONT_SIZE_PT = 11;
  const CHAR_WIDTH_IN = 0.076;
  const SIDE_MARGIN_IN = 0.18;
  const SAFETY_IN = 0.20;
  const longestLabel = spec.nodes.reduce((a, n) => Math.max(a, n.label.length), 0);
  const uniformWidthIn = longestLabel * CHAR_WIDTH_IN + SIDE_MARGIN_IN * 2 + SAFETY_IN;
  const uniformWidth = uniformWidthIn.toFixed(3);

  const lines = [];
  lines.push("digraph H {");
  lines.push('  graph [rankdir=TB, splines=ortho, nodesep=0.45, ranksep=0.55, bgcolor="transparent"];');
  lines.push(
    `  node  [shape=box, style="rounded,filled", fillcolor="#f7f7f9", color="#222", fontname="Helvetica", fontsize=${FONT_SIZE_PT}, margin="${SIDE_MARGIN_IN},0.10", height=0.45, width=${uniformWidth}, fixedsize=true];`
  );
  lines.push('  edge  [color="#222", arrowsize=0.7, penwidth=1.1, fontname="Helvetica", fontsize=9];');
  for (const n of spec.nodes) {
    lines.push(`  ${n.id} [label="${escapeDotLabel(n.label)}"];`);
  }
  for (const e of spec.edges) {
    const lbl = e.label ? ` [label="${escapeDotLabel(e.label)}"]` : "";
    lines.push(`  ${e.from} -> ${e.to}${lbl};`);
  }
  lines.push("}");
  const dotSource = lines.join("\n");

  const res = spawnSync("dot", ["-Tsvg"], { input: dotSource, encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(`graphviz dot failed: ${res.stderr || res.error?.message || "unknown"}`);
  }
  const svg = res.stdout.replace(/<\?xml[^?]*\?>\s*/g, "").replace(/<!DOCTYPE[^>]+>\s*/g, "");
  return wrapFigure(spec, svg);
}

function renderSequence(spec) {
  const n = spec.steps.length;
  const W = 140;
  const H = 56;
  const GAP = 32;
  const PAD = 8;
  const totalW = n * W + (n - 1) * GAP + PAD * 2;
  const totalH = H + PAD * 2;

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" font-family="Helvetica" font-size="11">`
  );
  parts.push(
    `<defs><marker id="${spec.id}_arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#222"/></marker></defs>`
  );
  for (let i = 0; i < n; i++) {
    const x = PAD + i * (W + GAP);
    const y = PAD;
    const step = spec.steps[i];
    parts.push(
      `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="6" ry="6" fill="#f7f7f9" stroke="#222" stroke-width="1"/>`
    );
    parts.push(
      `<text x="${x + W / 2}" y="${y + H / 2 + 4}" text-anchor="middle">${escapeXml(step.label)}</text>`
    );
    if (i < n - 1) {
      const lx1 = x + W;
      const ly = y + H / 2;
      const lx2 = lx1 + GAP;
      parts.push(
        `<line x1="${lx1}" y1="${ly}" x2="${lx2 - 1}" y2="${ly}" stroke="#222" stroke-width="1" marker-end="url(#${spec.id}_arrow)"/>`
      );
    }
  }
  parts.push("</svg>");
  return wrapFigure(spec, parts.join(""));
}

function renderMatrix(spec) {
  const nrows = spec.rows.length;
  const ncols = spec.cols.length;
  if (spec.cells.length !== nrows) {
    throw new Error(`matrix.cells row count ${spec.cells.length} != rows ${nrows}`);
  }
  for (let i = 0; i < nrows; i++) {
    if (spec.cells[i].length !== ncols) {
      throw new Error(`matrix.cells[${i}] col count ${spec.cells[i].length} != cols ${ncols}`);
    }
  }

  const html = [];
  html.push(`<table class="figure-matrix" data-figure-id="${escapeXml(spec.id)}">`);
  html.push("<thead><tr><th></th>");
  for (const c of spec.cols) html.push(`<th>${escapeXml(c.label)}</th>`);
  html.push("</tr></thead><tbody>");
  for (let i = 0; i < nrows; i++) {
    html.push(`<tr><th scope="row">${escapeXml(spec.rows[i].label)}</th>`);
    for (let j = 0; j < ncols; j++) {
      html.push(`<td>${escapeXml(spec.cells[i][j])}</td>`);
    }
    html.push("</tr>");
  }
  html.push("</tbody></table>");
  return wrapFigure(spec, html.join(""));
}

function renderTable(spec) {
  const ncols = spec.columns.length;
  for (let i = 0; i < spec.rows.length; i++) {
    if (spec.rows[i].length !== ncols) {
      throw new Error(`table.rows[${i}] has ${spec.rows[i].length} cells, expected ${ncols}`);
    }
  }
  const html = [];
  html.push(`<table class="figure-table" data-figure-id="${escapeXml(spec.id)}">`);
  html.push("<thead><tr>");
  for (const c of spec.columns) {
    const align = c.align ?? (c.type === "num" ? "right" : "left");
    html.push(`<th class="align-${align}">${escapeXml(c.label)}</th>`);
  }
  html.push("</tr></thead><tbody>");
  for (const row of spec.rows) {
    html.push("<tr>");
    for (let j = 0; j < ncols; j++) {
      const cell = row[j];
      const align = spec.columns[j].align ?? (spec.columns[j].type === "num" ? "right" : "left");
      let value;
      let emphasis = false;
      if (cell !== null && typeof cell === "object") {
        value = cell.value;
        emphasis = !!cell.emphasis;
      } else {
        value = cell;
      }
      const cls = `align-${align}${emphasis ? " emphasis" : ""}`;
      html.push(`<td class="${cls}">${escapeXml(value)}</td>`);
    }
    html.push("</tr>");
  }
  html.push("</tbody></table>");
  return wrapFigure(spec, html.join(""));
}

function wrapFigure(spec, inner) {
  return `<figure class="figure figure-${spec.family}" id="fig-${escapeXml(spec.id)}" data-family="${spec.family}">
${inner}
<figcaption>${escapeXml(spec.caption)}</figcaption>
</figure>`;
}

export function render(spec) {
  validateSpec(spec);
  switch (spec.family) {
    case "hierarchy":
      return renderHierarchy(spec);
    case "sequence":
      return renderSequence(spec);
    case "matrix":
      return renderMatrix(spec);
    case "table":
      return renderTable(spec);
    default:
      throw new Error(`unhandled family: ${spec.family}`);
  }
}

const invokedAsCli = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (invokedAsCli) {
  const [specPath, outPath] = process.argv.slice(2);
  if (!specPath) {
    console.error("usage: render-figure.js <spec.json> [out.html]");
    process.exit(64);
  }
  const spec = JSON.parse(await readFile(specPath, "utf8"));
  const html = render(spec);
  if (outPath) {
    await writeFile(outPath, html);
    console.error(`wrote ${outPath}`);
  } else {
    process.stdout.write(html);
  }
}
