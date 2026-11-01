# Report files

This folder holds the files of the report that the site serves as they are, with no build step.

- `gab-report-en.pdf`: the report in English.
- `gab-report-fr.pdf`: the report in French.
- `stamp.json`: the hash of the page that the command prints for each PDF. A test prints the page again
  and fails when a PDF is older than its templates, its figures, its byline or the tool.

Each PDF is the print design of the operator, page by page. The French pages are the design as the
operator made it. The English pages have the same layout, with the final English text in place of
the French text and the figures with English labels. A test fails when a block of text of an English
page is not in the final English text.

The page templates and the figures are in the folder of the tool, under `tools/`. To change a page,
change its template. `pnpm report:pdf` makes the two PDF files and the stamp, with no network
access. Run it after each change to a template or to a figure, and commit the three files together.
