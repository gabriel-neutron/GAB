# The map and the graph: what the reader sees

Read this before you change the map page or the graph page.

## The rule

A reader looks, and does not read. Each screen must make sense with its text hidden. Position,
size, colour, shape and a small chart come first. A word names a thing or confirms it.

## The audit

An audit looked at each page at three widths and in the two themes. The automatic WCAG check
found no fault on the pages. The faults were in the two canvases, where the check cannot look:

- **Map.** The legend was a line of dots and words. It did not show the order of the chain, and it
  did not show how many points each stage holds. The links had the colour of their product, and
  these colours were near the colours of the stages. So the reader could not tell a line from a
  point by its colour.
- **Map.** The animated globe and the flat map shared one page and one switch. A change of mode
  kept a part of the old state and lost the rest.
- **Map and graph.** Each page built its own card of the selection: its own close control, its own
  Escape key and its own phone sheet.
- **Graph.** The canvas draws a limited number of markers for pending evidence. It did not tell the
  reader that it left markers out.

The faults that stay open are in issue 914. The largest ones are the colours of the map
in the light theme, which have too little contrast on the land, and the overview of the graph,
which shows no structure when the layout gives no position.

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

## What the pages do now

- **One card of the selection.** The map and the graph use one shared panel. It is a column on a
  wide screen and a sheet at the bottom of a phone. It closes with its button or with Escape, and
  it gives the focus back to the control that opened it.
- **Two modes of the map.** "Map" shows each point, flat and still. "Globe" plays the chain. The
  address holds the mode, so the back button undoes a change, and a link can open the globe. Each
  mode starts a new globe, so no state goes from one mode to the other. The selection is in the
  address, so it stays. Each mode has one legend: the stage strip for the map, the steps of the
  chain for the globe.
- **The stage strip.** It replaces the old legend. An exit point is a ring and not an entity, so the
  strip counts the rings in the exit stage. "No stage" stands apart, because it is not a step.
- **The marker meter.** When the cap cuts markers, a small bar on the graph shows the part that is
  drawn and the number that is not. It has the shape and the colour of a marker, so it needs no
  legend. It is absent when the cap cuts nothing.
