# Report

The application report lives at `/`; its notes live at `/bibliography`. The French report and its
notes live under `/fr`. All these routes use the application header, theme, Geist fonts and
semantic tokens. The static release writer prerenders them, writes the language of each page, and
links each page to its twin in the other language (hreflang).

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
the node identifiers and the figure data stay the same in all locales. A figure component reads its
labels from the copy too: the French copy gives each French label of the publication data as it
is, and the French label for each English name of the data. The frame sets the language of the
page. A text switch in the part bar and on the notes page goes to the same anchor in the other
locale.

The French copy holds the French text (V4) of the author, in the blocks, figures and node marks of
the English page. Its notes keep the ids of the English text: a committed map joins each English
note to its French twin, and the source module gives each French marker the English id of the same
place. The French notes page marks an English note with no twin; no machine translation fills it.
The words of the page itself (controls, table heads) have no French source and are written in the
French copy.

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

## Speed

The release page holds the full text in its HTML, and the browser paints it before any script
loads. Then the client hydrates that HTML: it does not draw the page again. Each part after the
first loads its code and hydrates only when it comes near the view, and the browser lays it out
and paints it only near the view. So the first paint and the start do not pay for the whole page.

These rules keep that true:

- The first render in the browser gives the same markup as the release render. A component reads
  the screen (reduced motion, a width, the storage) through a store whose release value is fixed,
  never in its first render.
- A value that a provider above the parts gives does not change after the start. A new value makes
  React hydrate every waiting part at once.
- Code that measures the page measures the slot of a part, not an element in it: a measure in a
  part far from the view makes the browser lay it out.

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
- A note marker is a button with the number of the note; a screen reader says "Source" and the
  number, and the open state. From 1280px, the note opens in the margin beside its paragraph;
  under 1280px, it opens in a bottom sheet (a dialog). Escape closes it, and the focus goes back to
  the marker. The note shows its reference, then its documents of the record, then its quote, and
  links to the note on the notes page. A note with no document shows its reference only. A quote
  shows only when the file holds one.
- A committed, dated file joins each note to the documents of the record that support it, and a
  command on the operator PC builds it (ADR 0033).

## Cover and PDF

The art of the page is decoration: it has no label, no caption and an empty alternative text. The
notes page lists the credit of each image. A note marker beside the art opens its credit, as a
note marker opens a note; its number is the place of the credit on the notes page. A value of the
summary has the marker of the note that its item cites. The PDF is a file of the
operator and never enters the repository. Set `REPORT_PDF` to its absolute path before a build.
The build copies it as `report.pdf`, and the download link of the first screen gives it. A path
that names no file stops the build. With no PDF, the download link gives the final text of the
page locale: the Markdown file of the source folder, which the build copies as it is.

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
- **pay**: an editorial grid with a margin for the notes, wide figures, and the price cap as a scroll scene. The reader learns that Asia replaces the volumes of Europe, but at a discount.
- **ports-fleet**: a sticky map with text cards that change the ports and flows in view, then the traffic and fleet figures. The reader learns where crude leaves Russia and which fleet carries it.
- **finance**: the settlement currencies as a scroll scene with one step for each year, then the payment relays as a numbered list. The reader learns that the rouble and the yuan replace the dollar and the euro.
- **fight**: a scroll-driven chain story with a sticky map, then the suppliers in small charts. The reader learns how foreign components reach Russian weapon plants, and who replaced the coalition sellers.
- **ownership**: the text with a margin for its notes and the ownership chains in layered bands. The reader learns how far a sanction reaches through share chains, and where they stop.
- **limits**: the limits as a numbered register, then the research leads. The reader learns what the data cannot prove.
- **conclusion**: prose, and the answer split into its two routes. The reader learns the two routes around the sanctions.
- **annex-method**: a technical sheet, the index of all named nodes, the scale of the research, and the way to the notes. The reader learns how each fact was sourced and can find every node.
