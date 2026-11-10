# Report files

This folder holds the files of the report that the site serves as they are, with no build step.

- `gab-report-en.pdf`: the report in English.
- `stamp.json`: the hash of what the command prints for the PDF: the page, the code of the layout
  pass and the links of the notes. A test fails when a PDF is older than its templates, its figures,
  its byline, the layout pass or the links.
- `record` in `stamp.json`: the tag and the checksum of the pinned data release, which a reader can
  load to count the public record (`docs/deploy.md`). A test fails when it differs from the pin.

The PDF is the print design of the operator, page by page, with the final English text. A test
fails when a block of text or a note of a page is not in the final English text.

## The layout pass

Before the print, a layout pass runs in the printed page:

- Each note stays whole at the foot of the page of its call. When the notes of a page do not fit,
  the end of the page body goes to the next page of the same part, cut at a line. A figure that
  does not fit goes to the top of the next page, and the text after it fills the page.
- Where no next page of the same part is there, the notes of the page get smaller, never below
  7 pt, and only then the pass adds a page. The page numbers, the contents and the list of figures
  follow.
- Each URL of a note is a link, and each "n. X" of a note goes to note X. A note with no URL gets
  one link line when a source document matches it exactly. A manual match gives no link.

The command stops when an element is cut by its box, when a note does not fit at the foot of its
page, or when a note is on another page than its call.

The page templates and the figures are in the folder of the tool, under `tools/`. To change a page,
change its template. `pnpm report:pdf` makes the PDF file and the stamp, with no network
access. Run it after each change to a template, a figure or the source documents of the notes, and
commit the two files together.
