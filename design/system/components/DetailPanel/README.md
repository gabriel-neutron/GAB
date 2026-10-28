# DetailPanel

The right-hand panel that explains one selected entity: who it is, what is proven, how it connects and where each fact comes from.

## Structure, top to bottom
1. Header: `caption` eyebrow (glyph, type, main identifier), the name in `heading-sm`, then status tags (`gab-tag--figure` for the one key fact, `--candidate` for machine facts).
2. Identity: a two-column list. Key in `caption` style and `label`, value in `body-sm`; dates, counts and identifiers in `data`.
3. Relations: rows grouped by family, each with the `RelationLine` sample, the target glyph, the name and a short qualifier on the right.
4. Sources: a `GhostLink` per document, with domain and date in `data` `muted-foreground`.
5. Footer: one `primary` action, the rest `secondary`.

## Rules
- Width `panel-width` (400px), `surface` fill, 1px `border` on the side that faces the canvas. Square corners.
- Sections are separated by `divider` hairlines and a `caption` title. No card inside the panel.
- A name or a value wraps; it is never cut with an ellipsis.
- Every fact row can show its source on hover or focus; a candidate fact shows the hollow glyph and the dashed tag.
