# ADR 0029 — A doubted unit joins a unit that waits

**Status** Accepted · 19 October 2026

## Context

A unit that waits for a better source often has one weak source, for example a post of a general
staff channel. The research later finds a second, independent source of the same event. The
propose tool makes a new unit of it, because the second source has another author. A check or a
dispute then makes the new unit a doubt. The reviewer could not decide the pair:

- No step moved the second source to the waiting unit.
- A rejection of the new unit lost the second source, and the waiting unit kept one weak source.

## Decision

- One step joins a doubted unit to a unit that waits. The waiting unit takes the passages of the
  doubted unit, and the doubted unit is closed. The step is the same kind of act as `add_source`
  (ADR 0027): the documents of one act join another act, and nothing else changes.
- The two units are new events with the same kind, the same site and the same day in their names.
  The doubted unit holds one act, or two in the case below. The two units cite their passages in the same modalities, so a
  denial never joins an assertion. The step refuses words read from an image.
- The waiting unit can also be a pending `occurred_at` relation of an event that the record holds.
  The name of that event is the name of the unit. The relation keeps its type, its ends and its
  dates.
  The doubted unit may hold two acts: the event and its `occurred_at` link to the site where the
  waiting relation ends. The names then match by kind and day, and the site is the same site. The
  step closes both acts.
- The doubted unit is a doubt. The waiting unit has weak sources and is no doubt of its own. The doubt of a check
  spreads to each act of one claim, so the state of the waiting unit is read after the doubted
  unit is closed. A doubt of its own rolls the step back.
- The database refuses the step when the waiting unit cites each document of the doubted unit
  already. If it cites some of them, it takes the passages of the other documents only.
- A citation is written once, so the waiting act takes copies of the passages. The promotion of
  the act reads its citations, as it does for an act that a later item joined.
- The doubted unit is closed as a duplicate, with a note that names the waiting unit and the cause of the doubt, and the
  origin and the reason of the reviewer. A later claim of the same fact does not read this
  closure as a rejection (the rule that finds a claim rejected before skips a duplicate).
- The step is one statement of the database. It locks the acts of both units, in the order of
  their ids, before it reads them. Two reviewers on one pair run one after the other, and the
  second finds the doubted unit closed and is refused.
- The step does not run the rules. The waiting unit stays in the queue for its reviewer, who sees
  the new passages.
- The AI reviewer reaches the step through the tool `join_unit`, with the other decisions of the
  review. It records the origin "decided by an AI reviewer" and a reason.

## Related change

The second model that checks a batch used to get the excerpt and its context only. It disputed the
day of an event when the passage gave a weekday. It now gets, with each passage, the day of
publication of the document, and with each claim the weekday of each claimed day. The caller gives
the day of publication in `published_on`. If it gives none, the tool reads a date in the path of the
address of the document. The prompt of the checker tells how to read a weekday with these two
values.

## Alternatives

- **Reject the new unit.** Loses the second source. Refused.
- **Merge the acts (`merge_waiting_act`).** It needs the same author and the same payload. Two
  witnesses of one event have two authors. Refused.
- **A new reject reason `joined`.** It needs a new value in the constraint, in the front and in the
  rule that finds a claim rejected before. The note names the waiting unit, so the value gives
  little. Not done.

## Cost

- The join does not make a second author of the waiting unit: the author and the claim stay, so the
  unit stays in the waiting lane for its reviewer.
- The closure of the doubted unit uses the reason "duplicate". The note holds the link.
- A pair of units with more than one act each is not joined. The reviewer decides it by hand.
- The operator has no button for the step yet. The tool and the database door of the AI reviewer
  are the only ways in.
