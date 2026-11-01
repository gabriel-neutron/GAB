# Report

The application report lives at `/`; its notes live at `/bibliography`. Both routes use the
application header, theme, Geist fonts and semantic tokens. The static release writer prerenders
both routes.

## Content

Show only the report text, the figure facts, the notes and the node references. Do not add a
kicker, a caption of art, a quote of the text or a second copy of a value or a sentence.

The content file holds every word of the page: the text of each part, its notes, the nodes it
names, the figure texts, and the labels of the controls. Do not change a value of the report text
there; add new labels beside the others. The node and relation files are the data of the report
graph. The page reads every count from these files, so a count never sits in the text of the page.
The counts of the database (entities, critical nodes, nodes on an official source, and their
date) come from the final English text: a parser reads them from its sentences, and a change of
these sentences stops the build.

## Locale and final text

The content has one shape and one copy for each locale. A part, a mark or the frame reads the copy
of the page locale from the content context, not from a direct import. The root gives no copy, so
the page reads English; the route of another locale gives its copy to the provider. The part slugs,
the node identifiers and the figure data stay the same in all locales. Some figure components
still read the English labels directly.

The text of a part is the final text of the author, word for word. The source folder holds that
text as the author delivers it, and the heading where each part starts. Only these changes are
allowed: a paragraph cut, a list item for each item of the text, a short heading, and the node
marks. The notes keep the numbers of the final text. The parity test compares, for each part, the
numbers, the months and the note markers of the body and of each figure caption with the source,
and each note with the words of the source. A text change that adds, removes or moves one of
them fails the test. A figure of the page that the final text does not have shows no number.
When the text gives only a total, a dated data file can split it: the critical nodes of each layer
come from the selection test of the author on the record (the nodes that meet the three conditions
in the record, and the nodes of the first list that the record does not link yet), and a test
checks that the layers sum to the total of the text.

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
- A committed, dated file joins each note to the documents of the record that support it, and a
  command on the operator PC builds it (ADR 0033).

## Cover and PDF

The art of the page is decoration: it has no label, no caption and an empty alternative text. The
notes page lists the credit of each image. The PDF is a file of the
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

## Part layouts

Each part has one layout. The layout follows what the reader must learn.

- **summary**: one finding per row on one grid, each with its value and its text. The reader learns the main results.
- **introduction**: a reading column with the three questions. The reader learns that sanctions started before 2022 and what the report asks.
- **method-chronology**: a field of squares for the critical nodes, the three layers, the three conditions, and a timeline that moves with the scroll. A time cursor (the scroll or a slider) chooses an event and shows the tankers designated by each regime to the end of its quarter. The reader learns what makes a node critical and when the sanctions came.
- **pay**: an editorial grid with notes in the margin, wide figures, and the price cap as a scroll scene. The reader learns that Asia replaces the volumes of Europe, but at a discount.
- **ports-fleet**: a sticky map with text cards that change the ports and flows in view, then the traffic and fleet figures. The reader learns where crude leaves Russia and which fleet carries it.
- **finance**: the settlement currencies as a scroll scene with one step for each year, then the payment relays as a numbered list. The reader learns that the rouble and the yuan replace the dollar and the euro.
- **fight**: a scroll-driven chain story with a sticky map, then the suppliers in small charts. The reader learns how foreign components reach Russian weapon plants, and who replaced the coalition sellers.
- **ownership**: the text with its notes in a rail and the ownership chains in layered bands. The reader learns how far a sanction reaches through share chains, and where they stop.
- **limits**: the limits as a numbered register, then the research leads. The reader learns what the data cannot prove.
- **conclusion**: prose, and the answer split into its two routes. The reader learns the two routes around the sanctions.
- **annex-method**: a technical sheet, the index of all named nodes, the scale of the research, and the way to the notes. The reader learns how each fact was sourced and can find every node.
