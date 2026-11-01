# Report files

This folder holds the files of the report that the site serves as they are, with no build step.

- `gab-report-en.pdf`: the report in English, made from the final English text.
- `gab-report-fr.pdf`: the report in French, made from the final French text.
- `stamp.json`: the hash of the source text of each PDF. A test compares it with the source text
  and fails when a PDF is older than its text.

`pnpm report:pdf` makes the two PDF files and the stamp. Run it after each change to the final
text, and commit the three files together.
