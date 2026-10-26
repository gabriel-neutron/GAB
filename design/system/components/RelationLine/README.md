# RelationLine

The stroke of one relation family: a dash pattern AND a hue, the same on the graph, the map (flows, transfers) and the legends.

| Family | Pattern | Hue token |
| --- | --- | --- |
| Ownership | solid | `relation-ownership` (neutral: the structure) |
| Designation | 12 5 | `relation-designation` (signal: the sanction) |
| Operation | 5 4 | `relation-operation` |
| Ship-to-ship transfer | 12 4 2 4 | `relation-transfer` |
| Other | 2 5 | `relation-other` |

- The dash pattern carries the family alone where hues are hard to tell apart.
- Width 1px at rest, 2px when the edge touches the selection. Arrow heads 6px, same colour.
- A dimmed edge drops to 25% opacity. Never a second colour for "dimmed".
