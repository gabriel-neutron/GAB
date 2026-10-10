# ADR 0021 — Merge candidates across two scripts come from one fixed table and a stored pair

**Status** Accepted · 10 October 2026

## Context

The FNF investigation promises entity resolution across Latin and Cyrillic spellings. One Russian
company can be in the record twice: once with the Latin name of a sanctions list, and once with
the Cyrillic name of a register. The operator must see each such pair once, decide it, and never
decide it again. A release gives the number of candidates in each state. The key changes which
pairs exist, and the stored decisions name pairs, so the table and the storage are costly to
change after the operator decides the first pairs.

## Decision

### One table, and the common variants folded

- The worker transliterates Russian Cyrillic with the table of ICAO Doc 9303 (seventh edition,
  2015). A Russian passport uses this table since 2014, so it is the most frequent Latin form of
  a Russian name in a register or a list. The key drops the hard sign and the soft sign.
- The other tables (BGN/PCGN, GOST 7.79, GOST 52535, the old passport form, the German form) write
  some letters in another way. The key folds each of these spellings to one form, on both sides of
  a comparison: kh and h; ts, tz and tc; shch and sch; iu, yu and ju; ia, ya and ja; ye and e at
  any place; y, j and i; x and ks; w and v; c and k (not in ch); and a doubled letter and one
  letter. So е and ё, and и, й and ы, are one letter in the key.
- The key is in lower case, with no punctuation and no apostrophe, and with no legal form: the
  Russian forms (ООО, ОАО, ПАО, ЗАО, АО, НАО, ИП, as the table writes them) and the English forms
  (LLC, JSC, OJSC, PJSC, CJSC, Ltd, plc, Inc). A key with fewer than three letters or digits is no
  key.
- The key is a pure function of the worker, with offline tests on a fixed list of names in both
  scripts. It is not the name key of the database, which only puts a name in lower case.

### A pair

- A pair is two entities of one type where a Latin name of one and a Cyrillic name of the other
  give one key. A name is the label, or a text of the former names, the aliases or the Cyrillic
  label. A name with letters of both scripts is in no pair. Two names in one script are not a
  candidate: the duplicate check of the review compares them already.
- The fold makes more pairs than one table, and some are false. The operator decides each pair,
  and no rule and no model decides one.

### The storage

- A table of the record holds each pair: the two identifiers in order, the key, the name of each
  entity that matched, the state (proposed, confirmed, refused), and the day, the author and the
  merge act of the decision. Only the operator role reads or writes it, through doors. No machine
  role holds a grant.
- The worker command reads the names, finds the pairs, and gives them to one door. The door adds
  each pair that no row names, keeps each row as it is, and deletes each proposed pair that the run
  did not find again. So a refused or confirmed pair never comes back.
- A merge deletes the absorbed row, so the table holds no foreign key on the entities. Each read
  resolves an identifier through the alias table to the survivor of today. A refusal still holds
  after a merge of one of its entities.
- A confirmation is the reversible merge of ADR 0014 with the name of the absorbed entity kept as
  a former name. The operator chooses the survivor. The merge and the new state of the pair are
  written in one transaction.
- The release reads the three counts as the operator role, and writes them in its file manifest.

## Alternatives

- **A key in SQL.** The database would compute the key at each read, and a change of a fold would
  need a new index. The key in the worker has offline tests, and the database stores its result.
- **Two or more keys for each name, one for each table.** More code for the same pairs: each fold
  is symmetric, so one folded key matches each pair that two tables match.
- **The decision as an act of the ledger.** A refusal changes no element of the record, and the
  ledger holds what changes the record. The confirmation is an act already: the merge.
- **A foreign key with a cascade.** A merge would delete the refusal with the absorbed row, and
  the pair would come back.

## Cost

- A name in Ukrainian or Belarusian letters that the Russian table does not hold keeps those
  letters, and matches no Latin name.
- A Latin name in English words (Shipping, Oil, Refinery) matches a Cyrillic name only when the
  Cyrillic name spells the same English word.
- An undo of a confirmed merge leaves the pair confirmed, so the command does not propose it
  again.
- A change of the table or of a fold can give new pairs, and leave some refused pairs unused.
