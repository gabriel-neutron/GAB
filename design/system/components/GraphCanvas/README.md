# GraphCanvas

The network view: entity glyphs joined by relation lines on the plain `background`, where the selection is the only bright object.

## Layers, bottom to top
1. Ground: `background`. No grid, no gradient, no vignette.
2. Edges: `RelationLine` styles. 1px at rest, 2px when the edge touches the selection.
3. Nodes: `EntityGlyph` shapes, filled (evidence) or hollow (candidate). Size from the degree, 8px to 28px.
4. Selection: a 2px `ring` circle, 6px outside the node. Never a glow, never a halo of colour.
5. Labels: Geist 12px `muted-foreground`; the selected node 14px `foreground`. Labels show for the selection and its one-hop neighbours only.
6. Chrome over the canvas: a `caption` status bar (top left), the legend (bottom left, `surface` with 1px `border`), zoom buttons (bottom right).

## Focus rule
- Selection and one-hop neighbours at full opacity; every other node and edge at 30% (edges 25%). Hue never changes on dim.
- Two-hop neighbours may stay at 60% when the reader asks for "2 hops".

## Legend
- Lists only the types and families present in the view, in the order of `EntityGlyph` and `RelationLine`.
- Counts in `data` style, right aligned.

## Consumer provides
Nodes (`id`, `type`, `label`, `degree`, `status`), edges (`source`, `target`, `family`), the selection. Sigma reads hex: resolve the tokens per theme with `getComputedStyle` and repaint on theme change, keeping camera and selection.
