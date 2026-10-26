# HoverCard

A small popover that names what the pointer is over, on the graph and the map, with three facts at most.

- `surface` fill, 1px `border`, `radius-sm`, `shadow-hairline`. Width 280px.
- Head: `caption` eyebrow with the glyph, type and main identifier; the name in `body-sm`.
- Up to two rows: key in `muted-foreground`, value in `data`.
- Opens after 120ms of hover, closes at once. A click opens the `DetailPanel`, not a bigger card.
