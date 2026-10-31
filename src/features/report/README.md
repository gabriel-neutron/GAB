# Report

The application report lives at `/`; its notes live at `/bibliography`. Both routes use the
application header, theme, Geist fonts and semantic tokens. The static release writer prerenders
both routes.

## Content

The content file holds every word of the page: the text of each part, its notes, the nodes it
names, the figure texts, and the labels of the controls. Do not change a value of the report text
there; add new labels beside the others. The node and relation files are the data of the report
graph. The page reads every count from these files, so a count never sits in the text of the page.

## The part contract

The report is a list of parts. Each part has a slug, a title, blocks, notes and node identifiers.
The parts folder maps each slug to one component. The component receives the part, and renders one
section whose id is the slug. A part with no design of its own uses the default part: a chapter
head, the nodes of the part, and the blocks of the text.

To design a part, write its component in a file of its own in the parts folder, and change one
entry of the map. Use the block renderer, the rich text and the figure frame, so that the marks
and the figure facts stay the same on all parts. A figure frame always shows the unit, the period
and the sources of its chart.

## Marks and references

The text holds three marks: a reference to a node, a note marker, and bold or italic text. One
parser splits a text into runs, and the rich text draws each run.

- A node reference shows the glyph of the entity type and a thin underline. Hover or keyboard focus
  shows a short card. A click or Enter opens the node panel. On a touch screen, a tap shows the
  card, and the button of the card opens the panel.
- The node panel is a dialog: a column at the right on a wide screen, a bottom sheet under 768px.
  Escape, the close control or a drag down on the sheet closes it, and the focus goes back to the
  reference. The panel shows the relations, the neighbours, a small map when the node has a
  position, the document identifiers and all fields of the node. It links to the entity page and
  to the graph when the node has a corpus record.
- A chart opens the panel through the report hook, and gives the element that gets the focus back.
- A note marker opens the text of the note, and links to the note on the notes page.

## Cover and PDF

The cover art is an illustration and carries a label that says so. The PDF is a file of the
operator and never enters the repository. Set `REPORT_PDF` to its absolute path before a build.
The build copies it as `report.pdf`, and only then the page shows the download link. A path that
names no file stops the build.

## Motion

Titles resolve from random ASCII glyphs when they enter the view. The words are in the page from
the start. Under reduced motion, the page shows the final state at once. Animations change only
the transform and the opacity. The map of the panel loads only when the panel opens.

## Older figures

The figure components of the paper report stay in this folder for later use by the parts. The
figure route renders them one by one, with the older report styles.
