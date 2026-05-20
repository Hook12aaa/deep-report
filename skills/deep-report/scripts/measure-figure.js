#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_TOLERANCES = {
  siblingWidthPx: 2,
  edgeLengthCv: 0.10,
  bboxOverlapPx: 0,
  textPaddingPx: 4,
  edgeSnapPx: 3.0,
};

function mean(xs) {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

function extractFigureBlock(html, figureId) {
  const re = new RegExp(`<figure[^>]+id="fig-${figureId}"[\\s\\S]*?<\\/figure>`);
  const m = html.match(re);
  if (!m) return null;
  return m[0];
}

function extractAttr(tag, name) {
  const re = new RegExp(`${name}="([^"]*)"`);
  const m = tag.match(re);
  return m ? m[1] : null;
}

function parsePoints(pointsStr) {
  return pointsStr
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x, y };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function bboxFromPoints(pts) {
  if (pts.length === 0) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

function bboxesOverlap(a, b) {
  return !(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0);
}

function overlapArea(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return Math.max(0, w) * Math.max(0, h);
}

function bboxFromPathD(d) {
  const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((mm) => +mm[0]);
  if (nums.length < 4) return null;
  const xs = [];
  const ys = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    xs.push(nums[i]);
    ys.push(nums[i + 1]);
  }
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const x1 = Math.max(...xs);
  const y1 = Math.max(...ys);
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

function parseGraphvizNodes(svg) {
  const nodes = [];
  const groupRe = /<g[^>]*class="node"[^>]*>([\s\S]*?)<\/g>/g;
  let m;
  while ((m = groupRe.exec(svg))) {
    const body = m[1];
    const titleMatch = body.match(/<title>([^<]+)<\/title>/);
    const polyMatch = body.match(/<polygon[^>]*points="([^"]+)"/);
    const ellipseMatch = body.match(/<ellipse[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*rx="([^"]+)"[^>]*ry="([^"]+)"/);
    const pathMatch = body.match(/<path[^>]*d="([^"]+)"/);
    const textMatch = body.match(/<text[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*>([\s\S]*?)<\/text>/);

    let bbox = null;
    if (polyMatch) {
      bbox = bboxFromPoints(parsePoints(polyMatch[1]));
    } else if (ellipseMatch) {
      const cx = +ellipseMatch[1];
      const cy = +ellipseMatch[2];
      const rx = +ellipseMatch[3];
      const ry = +ellipseMatch[4];
      bbox = { x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry, w: rx * 2, h: ry * 2 };
    } else if (pathMatch) {
      bbox = bboxFromPathD(pathMatch[1]);
    }

    if (!bbox) continue;

    let text = null;
    if (textMatch) {
      text = { x: +textMatch[1], y: +textMatch[2], content: textMatch[3].replace(/<[^>]+>/g, "").trim() };
    }

    nodes.push({
      id: titleMatch ? titleMatch[1] : null,
      bbox,
      text,
    });
  }
  return nodes;
}

function parseGraphvizEdges(svg) {
  const edges = [];
  const groupRe = /<g[^>]*class="edge"[^>]*>([\s\S]*?)<\/g>/g;
  let m;
  while ((m = groupRe.exec(svg))) {
    const body = m[1];
    const titleMatch = body.match(/<title>([^<]+)<\/title>/);
    const pathMatch = body.match(/<path[^>]*d="([^"]+)"/);
    if (!pathMatch) continue;
    const d = pathMatch[1];
    const coordPairs = [...d.matchAll(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g)].map((mm) => ({
      x: +mm[1],
      y: +mm[2],
    }));
    if (coordPairs.length < 2) continue;
    const start = coordPairs[0];
    let end = coordPairs[coordPairs.length - 1];
    const arrowMatch = body.match(/<polygon[^>]*points="([^"]+)"/);
    if (arrowMatch) {
      const arrowPts = parsePoints(arrowMatch[1]);
      if (arrowPts.length > 0) {
        end = arrowPts.reduce((best, p) =>
          Math.hypot(p.x - end.x, p.y - end.y) > Math.hypot(best.x - end.x, best.y - end.y) ? p : best
        , arrowPts[0]);
      }
    }
    const pts = coordPairs;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    edges.push({
      title: titleMatch ? titleMatch[1] : null,
      start,
      end,
      length,
    });
  }
  return edges;
}

function parseSequenceFigure(svg) {
  const rects = [...svg.matchAll(/<rect\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"/g)].map((mm) => {
    const x = +mm[1];
    const y = +mm[2];
    const w = +mm[3];
    const h = +mm[4];
    return { x0: x, y0: y, x1: x + w, y1: y + h, w, h };
  });
  const lines = [...svg.matchAll(/<line[^>]*x1="([^"]+)"[^>]*y1="([^"]+)"[^>]*x2="([^"]+)"[^>]*y2="([^"]+)"/g)].map(
    (mm) => ({ x1: +mm[1], y1: +mm[2], x2: +mm[3], y2: +mm[4], length: Math.hypot(+mm[3] - +mm[1], +mm[4] - +mm[2]) })
  );
  const texts = [...svg.matchAll(/<text[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g)].map((mm) => ({
    x: +mm[1],
    y: +mm[2],
    content: mm[3].replace(/<[^>]+>/g, "").trim(),
  }));
  return { rects, lines, texts };
}

function groupNodesByDepth(nodes) {
  const buckets = new Map();
  for (const n of nodes) {
    const key = Math.round(n.bbox.y0);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(n);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([y, ns], depth) => ({ depth, y, nodes: ns }));
}

function measureHierarchy(figureHtml, tol) {
  const checks = [];
  const svgMatch = figureHtml.match(/<svg[\s\S]*?<\/svg>/);
  if (!svgMatch) {
    return { verdict: "fail", checks: [{ name: "svg-present", pass: false, reason: "no <svg> element" }] };
  }
  const svg = svgMatch[0];
  const nodes = parseGraphvizNodes(svg);
  const edges = parseGraphvizEdges(svg);

  checks.push({
    name: "node-count",
    measured: nodes.length,
    pass: nodes.length >= 2,
  });

  const depths = groupNodesByDepth(nodes);
  for (const d of depths) {
    if (d.nodes.length < 2) continue;
    const widths = d.nodes.map((n) => n.bbox.w);
    const spread = Math.max(...widths) - Math.min(...widths);
    checks.push({
      name: `sibling-width-equality.depth=${d.depth}`,
      measured: { widths, spread },
      tolerance: tol.siblingWidthPx,
      pass: spread <= tol.siblingWidthPx,
    });
  }

  function parseEdgeTitle(t) {
    if (!t) return [null, null];
    const decoded = t.replace(/&#45;/g, "-").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
    const [from, to] = decoded.split("->");
    return [from?.trim() ?? null, to?.trim() ?? null];
  }
  const childrenByParent = new Map();
  for (const e of edges) {
    const [from, to] = parseEdgeTitle(e.title);
    if (!from || !to) continue;
    const child = nodes.find((n) => n.id === to);
    if (!child) continue;
    if (!childrenByParent.has(from)) childrenByParent.set(from, []);
    childrenByParent.get(from).push(child);
  }
  for (const [parent, kids] of childrenByParent) {
    if (kids.length < 2) continue;
    const sorted = [...kids].sort((a, b) => (a.bbox.x0 + a.bbox.x1) / 2 - (b.bbox.x0 + b.bbox.x1) / 2);
    const centers = sorted.map((n) => (n.bbox.x0 + n.bbox.x1) / 2);
    const gaps = [];
    for (let i = 1; i < centers.length; i++) gaps.push(centers[i] - centers[i - 1]);
    const spread = gaps.length > 0 ? Math.max(...gaps) - Math.min(...gaps) : 0;
    checks.push({
      name: `sibling-horizontal-spacing-uniformity.parent=${parent}`,
      measured: { childCenters: centers, gaps, spread },
      tolerance: tol.siblingWidthPx,
      pass: spread <= tol.siblingWidthPx,
    });
  }

  const overlaps = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (bboxesOverlap(nodes[i].bbox, nodes[j].bbox)) {
        overlaps.push({ a: nodes[i].id, b: nodes[j].id, area: overlapArea(nodes[i].bbox, nodes[j].bbox) });
      }
    }
  }
  checks.push({
    name: "node-bbox-overlap",
    measured: overlaps,
    tolerance: tol.bboxOverlapPx,
    pass: overlaps.length === 0,
  });

  const snapMisses = [];
  for (const e of edges) {
    const [fromTitle, toTitle] = parseEdgeTitle(e.title);
    const fromNode = nodes.find((n) => n.id === fromTitle);
    const toNode = nodes.find((n) => n.id === toTitle);
    if (!fromNode || !toNode) continue;
    const startDist = distanceToBboxBorder(e.start, fromNode.bbox);
    const endDist = distanceToBboxBorder(e.end, toNode.bbox);
    if (startDist > tol.edgeSnapPx || endDist > tol.edgeSnapPx) {
      snapMisses.push({ edge: e.title, startDist, endDist });
    }
  }
  checks.push({
    name: "edge-endpoint-snap",
    measured: snapMisses,
    tolerance: tol.edgeSnapPx,
    pass: snapMisses.length === 0,
  });

  const verdict = checks.every((c) => c.pass) ? "pass" : "fail";
  return { verdict, family: "hierarchy", checks };
}

function distanceToBboxBorder(pt, bbox) {
  const dx = Math.max(bbox.x0 - pt.x, 0, pt.x - bbox.x1);
  const dy = Math.max(bbox.y0 - pt.y, 0, pt.y - bbox.y1);
  return Math.hypot(dx, dy);
}

function measureSequence(figureHtml, tol) {
  const checks = [];
  const svgMatch = figureHtml.match(/<svg[\s\S]*?<\/svg>/);
  if (!svgMatch) {
    return { verdict: "fail", checks: [{ name: "svg-present", pass: false }] };
  }
  const { rects, lines, texts } = parseSequenceFigure(svgMatch[0]);

  checks.push({ name: "step-count", measured: rects.length, pass: rects.length >= 2 });

  if (rects.length >= 2) {
    const widths = rects.map((r) => r.w);
    const heights = rects.map((r) => r.h);
    checks.push({
      name: "step-width-equality",
      measured: { widths, spread: Math.max(...widths) - Math.min(...widths) },
      tolerance: tol.siblingWidthPx,
      pass: Math.max(...widths) - Math.min(...widths) <= tol.siblingWidthPx,
    });
    checks.push({
      name: "step-height-equality",
      measured: { heights, spread: Math.max(...heights) - Math.min(...heights) },
      tolerance: tol.siblingWidthPx,
      pass: Math.max(...heights) - Math.min(...heights) <= tol.siblingWidthPx,
    });

    const gaps = [];
    const sorted = [...rects].sort((a, b) => a.x0 - b.x0);
    for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i].x0 - sorted[i - 1].x1);
    if (gaps.length >= 2) {
      checks.push({
        name: "step-gap-uniformity",
        measured: { gaps, spread: Math.max(...gaps) - Math.min(...gaps) },
        tolerance: tol.siblingWidthPx,
        pass: Math.max(...gaps) - Math.min(...gaps) <= tol.siblingWidthPx,
      });
    }
  }

  if (lines.length >= 2) {
    const lengths = lines.map((l) => l.length);
    checks.push({
      name: "connector-length-equality",
      measured: { lengths, spread: Math.max(...lengths) - Math.min(...lengths) },
      tolerance: tol.siblingWidthPx,
      pass: Math.max(...lengths) - Math.min(...lengths) <= tol.siblingWidthPx,
    });
  }

  const overlaps = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (bboxesOverlap(rects[i], rects[j])) {
        overlaps.push({ i, j, area: overlapArea(rects[i], rects[j]) });
      }
    }
  }
  checks.push({
    name: "step-bbox-overlap",
    measured: overlaps,
    tolerance: tol.bboxOverlapPx,
    pass: overlaps.length === 0,
  });

  const textsInsideRects = texts.filter((t) => rects.some((r) => t.x >= r.x0 && t.x <= r.x1 && t.y >= r.y0 && t.y <= r.y1));
  checks.push({
    name: "label-inside-step",
    measured: { texts: texts.length, inside: textsInsideRects.length },
    pass: textsInsideRects.length === rects.length,
  });

  const verdict = checks.every((c) => c.pass) ? "pass" : "fail";
  return { verdict, family: "sequence", checks };
}

function measureMatrix(figureHtml) {
  const checks = [];
  const tableMatch = figureHtml.match(/<table[^>]*class="figure-matrix"[\s\S]*?<\/table>/);
  if (!tableMatch) return { verdict: "fail", checks: [{ name: "table-present", pass: false }] };
  const t = tableMatch[0];
  const thead = (t.match(/<thead>([\s\S]*?)<\/thead>/) ?? [])[1] ?? "";
  const tbody = (t.match(/<tbody>([\s\S]*?)<\/tbody>/) ?? [])[1] ?? "";
  const headerCells = [...thead.matchAll(/<th[^>]*>/g)].length;
  const rowMatches = [...tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  const rowCellCounts = rowMatches.map((m) => [...m[1].matchAll(/<(th|td)[^>]*>/g)].length);

  checks.push({ name: "header-present", measured: headerCells, pass: headerCells >= 2 });
  checks.push({ name: "row-count", measured: rowMatches.length, pass: rowMatches.length >= 1 });

  const uniform = rowCellCounts.every((c) => c === headerCells);
  checks.push({
    name: "row-cell-count-uniformity",
    measured: { headerCells, rowCellCounts },
    pass: uniform,
  });

  const verdict = checks.every((c) => c.pass) ? "pass" : "fail";
  return { verdict, family: "matrix", checks };
}

function measureTable(figureHtml) {
  const checks = [];
  const tableMatch = figureHtml.match(/<table[^>]*class="figure-table"[\s\S]*?<\/table>/);
  if (!tableMatch) return { verdict: "fail", checks: [{ name: "table-present", pass: false }] };
  const t = tableMatch[0];
  const thead = (t.match(/<thead>([\s\S]*?)<\/thead>/) ?? [])[1] ?? "";
  const tbody = (t.match(/<tbody>([\s\S]*?)<\/tbody>/) ?? [])[1] ?? "";
  const headerCells = [...thead.matchAll(/<th[^>]*>/g)].length;
  const rowMatches = [...tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  const rowCellCounts = rowMatches.map((m) => [...m[1].matchAll(/<td[^>]*>/g)].length);

  checks.push({ name: "header-present", measured: headerCells, pass: headerCells >= 2 });
  checks.push({ name: "row-count", measured: rowMatches.length, pass: rowMatches.length >= 1 });

  const uniform = rowCellCounts.every((c) => c === headerCells);
  checks.push({
    name: "row-cell-count-uniformity",
    measured: { headerCells, rowCellCounts },
    pass: uniform,
  });

  const inlineBold = (tbody.match(/<(b|strong)\b/g) ?? []).length;
  checks.push({
    name: "no-inline-bolding-in-cells",
    measured: inlineBold,
    pass: inlineBold === 0,
  });

  const verdict = checks.every((c) => c.pass) ? "pass" : "fail";
  return { verdict, family: "table", checks };
}

export function measure(figureHtml, family, tolerances = {}) {
  const tol = { ...DEFAULT_TOLERANCES, ...tolerances };
  switch (family) {
    case "hierarchy":
      return measureHierarchy(figureHtml, tol);
    case "sequence":
      return measureSequence(figureHtml, tol);
    case "matrix":
      return measureMatrix(figureHtml);
    case "table":
      return measureTable(figureHtml);
    default:
      throw new Error(`unhandled family: ${family}`);
  }
}

const invokedAsCli = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (invokedAsCli) {
  const [figurePath, family, outPath] = process.argv.slice(2);
  if (!figurePath || !family) {
    console.error("usage: measure-figure.js <figure.html> <family> [out.json]");
    process.exit(64);
  }
  const html = await readFile(figurePath, "utf8");
  const report = measure(html, family);
  const out = JSON.stringify(report, null, 2);
  if (outPath) await writeFile(outPath, out);
  else process.stdout.write(out + "\n");
  process.exit(report.verdict === "pass" ? 0 : 1);
}
