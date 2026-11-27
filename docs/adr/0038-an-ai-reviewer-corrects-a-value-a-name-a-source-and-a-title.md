# ADR 0038 — An AI reviewer corrects a value, a name, a source and a title

**Status** Accepted · 27 November 2026

## Context

On 27 November 2026, two sessions applied about 340 reviewed corrections to the record. Some
corrections had no tool:

- A change of a list of names (the aliases, the former names, the flags) replaced the list, so a
  correction could erase right values. No act took one wrong value out of a list, for example a
  former name that a join added.
- No act gave an entity the current name that an official list gives.
- No act took one wrong source out of a relation, and the removal of an act took only a new
  relation and a change of the values of an entity.
- A stored document had a false title, and no tool corrected it.
- An EU act ends a designation on the day before its entry into force, and its article gives that
  day only as "the date of its publication". `propose` refused that end, because no passage writes
  it.
- The node audit in record mode failed, because the role that it reads as had no right to read the
  level of a document.

The rule of ADR 0035 stays: each change of the record is an act with a reason and a cited
passage, nothing is erased, and a removal is an act.

## Decision

- **A list of names only grows.** A change of the aliases, the former names or the flags adds its
  values after the values of the record, as the history of the MMSI numbers and the call signs
  does. A reviewer takes one value out with its own act. Each copy of the value leaves, and the
  other values keep their order. The documents of the list stay: they back the list as a whole,
  and they link no value to one document. A machine cannot propose this act through the queue.
- **A rename is two acts.** The reviewer gives the current name, which the cited passage must
  write, and the name before goes to the former names or to the aliases. The entity keeps its id
  and the documents of its row. A name that another entity of the same type holds is refused,
  because that is a join.
- **A source leaves a relation with its own act.** The relation keeps at least one source, and a
  start or an end keeps a document of its own act.
- **A removal takes more acts.** It takes back a change of the values of a relation, a rename, a
  start, an end, an added source and a removed source. A start, an end or a name goes back only
  when the act still gave the value that stands. A document that the act added leaves the row
  only when no other act that stands cites it. A change of the type of a relation is still refused:
  the operator decides it.
- **A title has a history.** A document is not an act, so a table keeps each change of a title:
  the title before and after, who, when, and, for a reviewer, the reason and the passage. The
  bytes, the hash and the address do not change. The command that reads the stored bytes again
  writes the same history. A second change is the undo.
- **An end can name its rule.** An end of a relation can say "the day before the entry into force".
  Code then computes the day from one cited passage of an EU act. The passage must hold the article
  on the entry into force and, when the day counts from the publication, exactly one date of the
  Official Journal. Each other end must be a day that a passage writes. The checker of the second
  model reads the rule with the act.
- **The audit reads the level as the operator role.** The operator role reads each document and
  each text already, so the right to read the level adds no new read. The audit role of the
  tunnel does not change.

The expert panel (software architect and skeptic) agreed on this plan on 27 November 2026.

## Cost

- An operator who changes a list in the writer now adds values. To take one out, a reviewer acts.
- A rename that is wrong needs two removals: the name and the old name in the list.
- The rule of the end reads only the words of an EU act in English. An act of another issuer, or
  a passage with two dates of the Official Journal, still needs a passage that writes the day.

## Alternatives

- **A change of a list replaces it, as before.** A correction that gives a short list erases right
  values with no trace in the value. Refused.
- **A new kind of act for each correction.** Each read of the ledger and each count must then
  learn each kind. A removal of a value, a rename and a removal of a source use the kinds that
  exist, so the reads, the counts and the removal work on them. Refused.
- **The end as a day that the reviewer types.** A wrong day then reads as stated. Refused.
- **The audit reads as the research role.** That role holds the doors of a reviewer, so a read
  tool would get write doors. Refused.
