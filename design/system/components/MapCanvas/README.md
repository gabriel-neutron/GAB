# MapCanvas

The geographic view: a quiet monochrome basemap that lets entity glyphs, tracks and transfers carry all the colour.

## Basemap
- Water `map-water`, land `map-land`, coast and borders `map-boundary` at 1px (disputed or internal borders dashed 3 3).
- Place names Geist 12px `map-label`; sea names `caption` style with 2px tracking. No road layer, no relief shading, no satellite tint by default.
- Imagery (Sentinel-2) is an opt-in layer, shown in greyscale at 60% so markers keep their contrast.

## Marks
- Points: `EntityGlyph` shapes, 12px to 18px, with a `map-water` halo of 2px where they sit on land edges.
- Military unit: the NATO hostile diamond with its echelon and domain marks in `entity-military-unit`.
- Vessel tracks: 1.5px `entity-vessel` at 60%; the last known position is the glyph.
- Ship-to-ship transfer: a `RelationLine` transfer stroke between the two vessels.
- Event: the burst glyph with one thin `signal` ring. The ring does not animate on the working map; the report may animate it once.
- Selection: 2px `ring` circle, as on the graph.

## Chrome
- Layer chips top left: 28px, `surface` when on, transparent when off, with the glyph and a count.
- Scale bar bottom left (`caption`), cursor coordinates bottom right (`data`).

## Consumer provides
Features with `type`, `status`, geometry; the selection; the visible layers. MapLibre reads colour strings: resolve the tokens per theme.
