# ADR 0032 — A wide table is a table

**Status** Accepted · 31 October 2026 · Extends ADR 0030 and ADR 0031

## Context

ADR 0031 sends a table to a mapping, and the mapping of ADR 0030 reads one figure for each row: it
has one column of values and one column of periods. The monthly tax revenue of the Ministry of
Finance of Russia is a wide table. The months are columns, the measures are rows, and annual total
columns stand between the months. The labels of the rows repeat under different parents. An empty
cell means that the measure does not apply, a dash means that the source has no data, and a
negative value is real. No mapping could read this table, and the other way in (one act for each
cell) would break ADR 0031.

The expert panel (software-architect, osint-expert, skeptic) agreed on 31 October 2026 that the
table goes through a mapping, and that the loader unpivots it (#1111).

## Decision

- **The mapping has a wide variant.** It names the rows to read by their position under the
  header, and it gives one measure for each row. It gives one unit and one method for the table.
  It names no column of values, periods or areas, so a wide figure has no reporter (the rule of
  the world figure).
- **Only a month header cell is a period.** The loader reads the header cells with the rule of
  the periods of a month. An annual total column is not a period, so it gives no figure.
- **One cell is one figure, and its span is the cell.** The figure points at the words of its
  cell (P9), and not at the whole row.
- **Rows are read by position, and the key holds the row.** The labels repeat, so a label is no
  key. The mapping gives the measure of a position, and the measure is part of the key of the
  figure.
- **An empty cell is not applicable and gives nothing.** A dash goes to the load report as a cell
  with no data. A cell that is not a number goes to the report with its reason. A negative value
  loads.
- **The door reads the cell itself, as in ADR 0030.** The caller gives the span of the cell, the
  span of its row, the position and the header name of the column. The door checks the header
  against the signature of the mapping, finds the record at that position, checks that the
  column is a month, takes the value from the field of that column, and checks that the span lies
  in the row, holds the text of the field, and follows the fields that come before that column.
  It takes the measure from the mapping, and never from the caller.
- **The licence comes from the provider of the document**, as in ADR 0030.

## Cost

- The door counts the records of the page to check the position, so a page with an empty line
  before the header, or between rows, is refused. A text set of a workbook has none.
- The mapping lists the rows by hand, and the operator reads the dry run to check them. A new
  edition of the table with a different order of rows needs a new mapping.
- A cell that holds a number in a text form that the number rule refuses (a space between the
  groups of digits) goes to the report.
