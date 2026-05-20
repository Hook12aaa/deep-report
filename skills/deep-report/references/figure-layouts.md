# Figure Layouts

Four permitted layout families. Refuse anything else.

## 1. hierarchy

A tree with one root and uniform branching. Every child sits at the same depth as its siblings.

Rules:

- One root node.
- Branch width is consistent at each depth.
- Edge length is uniform; never overlap edges.
- Nodes labeled with a single line.

Use for: org charts, taxonomies, decision trees, system component breakdowns.

ASCII template:

```
        [ Root ]
       /   |   \
  [ A ]  [ B ]  [ C ]
   /\
 [A1][A2]
```

## 2. sequence

A linear pipeline. Arrows in one direction. Every node has exactly one predecessor and one successor (except the endpoints).

Rules:

- One axis (left-to-right or top-to-bottom). Not both.
- Branching is forbidden in this family; use `hierarchy` if branching is needed.
- Arrows uniform thickness and length.
- Labels on edges only when the transition has a name.

Use for: pipelines, build steps, request flows, lifecycle stages.

ASCII template:

```
[ Step 1 ] → [ Step 2 ] → [ Step 3 ] → [ Step 4 ]
```

## 3. matrix

A two-axis comparison grid. Cells contain a value, a checkmark, or a short label.

Rules:

- Both axes labeled.
- Cells contain at most one short label per cell.
- No diagonal arrows, no inter-cell lines.
- Headers bolded.

Use for: trade-off comparisons, feature matrices, capability grids.

ASCII template:

```
            |  Option A  |  Option B  |  Option C
------------+------------+------------+-----------
 Speed      |    fast    |    slow    |   medium
 Cost       |    high    |    low     |   medium
 Coverage   |   broad    |   narrow   |   broad
```

## 4. table

A labeled comparison or breakdown. Same structural rules as matrix but with arbitrary cell content (prose, numbers, dates).

Rules:

- Header row present.
- First column labels the row.
- No cell merges, no diagonal cells.
- Numeric columns right-aligned, text columns left-aligned.

Use for: any tabular data: timelines, rankings, costs, attributes.

## Refused layouts

- `mind-map` — radial outward from a center node with non-uniform branching.
- `radial` — circular arrangement of unconnected nodes.
- `scatter` — nodes placed by value on two continuous axes (use a chart spec separately).
- `free-form` — any layout without a stated family.
- `cloud` — word-cloud-style placements.

Scattered layouts render with overlapping lines and unreadable spacing in PDF. Re-prompting to fix a scattered figure is unreliable. Refuse the layout before the figure is drawn.

## Figure spec shape

```json
{
  "id": "<figure-slug>",
  "family": "hierarchy" | "sequence" | "matrix" | "table",
  "title": "<caption>",
  "nodes": [...],
  "edges": [...],
  "rows": [...],
  "columns": [...]
}
```

Use `nodes` and `edges` for `hierarchy` and `sequence`. Use `rows` and `columns` for `matrix` and `table`. Never both.
