# ADR 0037 — A fact of a party to the conflict shows its origin

**Status** Accepted · 27 November 2026

## Context

A review of the nodes of the report found many facts whose only cited documents come from a party
to the conflict, mostly the war and sanctions portal of GUR, the military intelligence of Ukraine.
The reader of the release, of the site and of the report did not see this. The report text already
attributes an adverse claim in its own words, but a row of the release, a fact of the site and a
node of the report did not. Rule 6 of `research/AGENTS.md` forbids rating a source, and the
operator wanted one rule in code, not a correction of each fact by hand.

The record already holds a party flag on an author (ADR 0012). A rater model sets it, and it is not
consistent: some names of GUR have no flag, and the flag also covers state companies of states that
are not a party. The release does not carry the author.

## Decision

The expert panel of 27 November 2026 (journalist, OSINT expert, sanctions lawyer, skeptic) agreed
on this rule.

- **The address decides.** A fact has a party origin when each document that it cites is
  published by a state body of one party to the conflict, Russia or Ukraine. One shared function in
  the release package reads the address of each document against a closed list of publishers.
  The record, the release, the site and the report all use that function, so they give the same
  answer. The function reads a copy in a web archive as the page that it copies, and a channel of
  a shared host (a Telegram channel) by its name.
- **The list is closed and short.** It holds the bodies that speak for a party: the military, the
  intelligence service, the presidency, the government, the foreign ministry. It holds no state
  register, no central bank list and no official journal of laws, because an entry there is a
  record of the state and not a statement of a party about the other side. It holds no state
  company and no state media outlet. A change of the list is a change of code, with its test.
- **Each cited document counts.** A fact that also cites a document of another publisher, or
  documents of both parties, has no party origin. The reader can check this from the cited
  documents alone.
- **The words state the origin and rate nothing.** The full words name the body when one body
  publishes each document, then say that its state is a party to the conflict, and that GAB cites
  no other source for the fact. The short mark, where the space is small, is "Party source" and
  the state. No word says that a source is weak, unverified or biased.
- **Where it shows.** The release gives a field on each claim row and each relation row, and the
  release notes describe it. The site shows the full words on the page of a claim, and the mark on
  each cited document and beside the source marks of each fact of a node page. The report shows
  the mark on each cited document of a node panel and of a note, and a mark in the node index for
  a node that cites such a document. In the report, the mark sits on the document and never on a
  condition of a node, because a condition that another fact also supports would read as weaker
  than it is.
- **The count of the critical nodes keeps it apart.** The replay of the critical nodes keeps the
  members of each node fixed and gives two more counts: the critical nodes with a condition that
  only facts of a party support, and the critical nodes with a member (a vessel) that joins them
  only through a fact of a party (a manager or an owner). The count of the critical nodes does
  not change.

## Consequences

- The site and the report show the origin now, with the pinned release, because they read the
  addresses that the release already gives. The field of the release appears at the next release
  build. The report reads the addresses of its node documents from a data file that a command
  builds from the record.
- A publisher that the list does not hold gives no mark, so the list must grow when the record
  cites a new state body of a party. A publisher on the list for one channel can also publish
  under another name.
- The author flag of ADR 0012 stays an input of the letter. It does not decide the origin.
