# ADR 0033 — A note of the report cites the documents of the record

**Status** Accepted · 1 November 2026

## Context

The web report shows the final English text with its notes. A note gives a reference in words and
often an address. The reader cannot see that the GAB record holds the document behind the note, so
the reader cannot see the work behind each fact (#1149, #1154).

The record holds each source as a stored document with an id, a type, a retrieval date and the
original address. The raw files are in a private store, and no archive address is public.

## Decision

- **A committed, dated file joins each note to its documents.** For each note of the final text,
  the file gives zero or more document rows: the document id, the type, the retrieval date and the
  original address. The page reads this file. It never reads the record when it renders, so the
  static release needs no backend (ADR 0028).
- **An exact address makes a row.** A build command on the operator PC reads the notes of the
  text and asks the document tools of the record for each address. A stored address that is the
  same, with no fragment, makes a row. An address that is only a host makes no row, because one
  host holds many works.
- **A reviewed manual table completes the exact rows.** Each manual row names a note, one exact
  stored address and the reason. A row is allowed only when an identifier names the work: an
  "op. cit." to the same work of an earlier note, a CELEX number and its stored English text, a
  press-release id, an indicator code, or an address that the note writes with no scheme. A
  reviewer agent that did not write the table checks each row. A title match or a host match is
  never a row.
- **A note with no row shows its reference only.** No empty card suggests a source that the record
  does not hold.
- **A note shows at most one quote.** The quote has at most 25 words, it is a part of the stored
  excerpt of a decided fact, and the provider of its document gives an open licence (the same
  allow-list as the public read). The file holds the excerpt and the licence beside the quote.
- **The file holds no address of the private store.** A row gives only the original address.
- **A test checks the file.** It refuses an unknown note id, a missing note, a row with no
  retrieval date or no original address, and a quote that breaks one of the quote rules.

## Measurement

On 1 November 2026, the exact addresses give rows to 37.8 % of the notes. With the manual table,
80.3 % of the notes have one or more rows. The other notes cite a database by its host, the author's
calculations, or a document that the record does not hold.

## Cost

- The file is a copy at one date. A document that the record gets later shows only after a new
  build and a new commit.
- The document tools give neither the excerpt of a decided fact nor the licence of a document. So
  the first file holds no quote. A quote needs a read of these two values from the record first.
- One address can hold more than one stored document (two retrievals). The file shows each one.
- The manual table is a file to keep true. A change of the text can make a row point at the wrong
  note, so a change of the notes needs a new build and a new review.
