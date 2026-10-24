# The map and the graph: what the reader sees

Read this before you change the map page or the graph page.

## The rule

A reader looks, and does not read. Each screen must make sense with its text hidden. Position,
size, colour, shape and a small chart come first. A word names a thing or confirms it.

## The faults the redesign answers

An audit in October 2026 looked at each page at three widths and in the two themes. The faults
were in the two canvases, where an automatic WCAG check cannot look:

- The legend of the map did not show the order of the chain or the size of each stage.
- The colours of the products were near the colours of the stages, so the reader could not tell a
  link from a point by its colour.
- The flat map and the animated globe shared one switch, and a change of mode kept a part of the
  old state.
- The map and the graph each built their own card of the selection.
- The graph left markers out with no sign to the reader.

## The decision for the map

The question: how does a new reader understand the map in one view? Three options went to an
expert panel (a journalist, an OSINT expert and a skeptic):

| Option | Verdict |
|---|---|
| A. The legend becomes the chain: the stages in their order, joined by arrows, each with its colour and a bar of its count. A press puts one stage forward and dims the rest. | Chosen by the three experts. |
| B. Clusters by region, and links with a width from their volume. | Refused. Many links have no volume, so the width would show the missing data and not the flow. A cluster hides the geography that shows the chain. |
| C. A guided first view: one example chain with numbers on the map. | Held. One example can teach the wrong thing, and no check shows that the data holds one complete chain at each step. |

The skeptic added one change that the panel accepted: with every product shown, a link is one
neutral grey. A product chip gives the links of that product their colour. So in the first view,
hue means the stage and nothing else.

## The rules of the operator

- **The map mode is the graph on a map.** It is the default of the Map tab. It draws every entity
  that has a position, with the rail of the types at the left and the card of the selection at the
  right, as the graph does. The globe mode is the second mode: the animated globe that explains the
  chain step by step.
- **One card for the two pages.** The card of an entity and of a relation on the map is the card of
  the graph. No page builds a second card. A point that is not a record of the corpus, such as an
  exit point, keeps a small card of its own.
- **A selection on the graph keeps every node.** A click on a node puts its neighbours forward and
  never removes the other nodes. The graph has no focus view that draws one node and its
  neighbours alone.

## What the pages do now

- **The selection panel.** The map and the graph use one shared panel. It is a column on a wide
  screen and a sheet at the bottom of a phone. It closes with its button or with Escape, and it
  gives the focus back to the control that opened it.
- **The rail of the map.** It is the rail of the graph: one row for each entity type, with a count,
  a switch that hides the points of the type, and the list of the names. A name selects its point.
  On a phone, the rail is a drawer, as on the graph.
- **Two modes of the map.** The address holds the mode, so the back button undoes a change, and a
  link can open the globe. Each mode starts a new globe, so no state goes from one mode to the
  other. The selected entity is in the address, so it stays. Each mode has one legend: the stage
  strip for the map, the steps of the chain for the globe.
- **The stage strip.** It is the legend of the colours of the map. An exit point is a ring and not
  an entity, so the strip counts the rings in the exit stage. "No stage" stands apart, because it is
  not a step.
- **The selection on the graph.** The selected node has a ring. Its direct neighbours are in full
  colour, larger, and named. The neighbours at two steps are fainter. Each other node stays
  on the canvas, dimmed. The camera moves to the node and its direct neighbours.
- **The marker meter.** When the cap cuts markers, a small bar on the graph shows the part that is
  drawn and the number that is not. It has the shape and the colour of a marker, so it needs no
  legend. It is absent when the cap cuts nothing.
