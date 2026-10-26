# EntityGlyph

The mark of one entity type: a geometric shape AND a hue, the same on the graph, the map, the rail, the panel and the report.

| Type | Shape | Hue token |
| --- | --- | --- |
| Vessel | triangle | `entity-vessel` |
| Port | notched square | `entity-port` |
| Facility | square | `entity-facility` |
| Company | circle | `entity-company` |
| Bank | portico | `entity-bank` |
| Person | hexagon | `entity-person` |
| State body | pentagon | `entity-state-body` |
| Legal act | folded sheet | `entity-legal-act` |
| Military unit | NATO hostile diamond | `entity-military-unit` |
| Event | four-point burst | `entity-event` (= `signal`) |
| Unknown | dashed circle | `entity-unknown` |

## Rules
- The shape carries the type; the hue confirms it. A reader who cannot see the hue still reads the type.
- Filled = promoted evidence. Hollow with a 1.5px edge = candidate. Never a third state by colour alone.
- Size `glyph-size` (14px) in lists. On a canvas the size follows the degree of the node (8px to 28px).
- Entity hues never enter the chrome: no button, tab, heading or panel edge in an entity hue.
- The consumer provides the type key; the glyph paths live in `components/EntityGlyph/preview.html` (14px box centred on 0,0).
- A Sigma or MapLibre canvas cannot read a CSS variable: resolve the token to hex once per theme change.
