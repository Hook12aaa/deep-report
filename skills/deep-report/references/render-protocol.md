# Render Protocol

The renderer takes the synthesized markdown and figure specs, emits styled HTML, and prints the HTML to PDF via a headless browser. Non-browser PDF generators are out of scope.

## Inputs

- `report/draft.md` — the unified markdown document from the synthesizer.
- `report/figures/<figure-id>.spec.json` — one file per figure, conforming to the families in `figure-layouts.md`.
- `report/claims.jsonl` — the claims ledger. Every load-bearing claim in the draft must appear here with `verdict=verified`.

## Outputs

- `report/<topic-slug>.html` — the styled HTML.
- `report/<topic-slug>.pdf` — the printed PDF.

## Stage order

1. Convert `report/draft.md` to HTML with a markdown processor.
2. For each figure reference in the draft, render the figure spec into inline SVG or HTML and inline it at the reference point.
3. Apply the print-targeted CSS stylesheet.
4. Print to PDF via a headless browser.

The headless browser is the only permitted PDF producer. Routes that bypass the browser are out of scope.

## Page sizing defaults

- Paper: A4 (210 × 297 mm).
- Margin: 22 mm top and bottom, 24 mm left and right.
- Default font size: 11 pt body, 10 pt captions.
- Line height: 1.45.
- Headings: H1 24 pt, H2 18 pt, H3 14 pt, H4 12 pt.

## Style defaults

- Body: serif typeface for prose, sans-serif for figures.
- Color palette: monochrome with one accent color. Accent reserved for figure highlights and code spans.
- Tables: full width, alternating row backgrounds, header row bolded.
- Figures: captioned below, numbered consecutively.
- Page breaks: avoid mid-paragraph and mid-figure breaks. Force a break before each top-level section.

## Headless browser invocation

The renderer invokes the headless browser with:

- `--headless`
- `--disable-gpu`
- `--no-sandbox` if the host requires it
- `--print-to-pdf=<output-path>`
- `--no-pdf-header-footer`
- `--print-to-pdf-no-header`

Refuse:

- PDF libraries that render markdown or HTML through a re-implemented layout engine.
- HTML-to-PDF converters that do not run a real browser layout pass.
- Server-side rendering pipelines that flatten figures to raster before print.

## Failure handling

If the browser print returns non-zero, the renderer:

1. Logs the browser stderr.
2. Does not emit a PDF.
3. Exits with a non-zero code so the Bottom Line script can surface the render failure.

The renderer never emits a partial or fallback PDF.
