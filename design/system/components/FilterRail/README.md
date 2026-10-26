# FilterRail

The left rail that narrows the graph and the map: search, then one row per entity type and per relation family, each with its mark and its count.

- Width `rail-width` (296px), `surface` fill, 1px `border` on the canvas side.
- Section head: `caption` title left, `caption` total right.
- Row: `row-height` 32px, toggle, glyph or line sample, label in `body-sm`, count in `data` right aligned (`gab-count`).
- An off row keeps its mark at full colour and greys only the text (`aria-disabled`), so the reader still sees what they hid.
- Hover and selection: `surface-secondary` fill; the selected row adds a 2px `ring` bar on its left edge (inset, not a coloured border card).
- The same row component serves the map layers and the graph filters. One rail, two canvases.
