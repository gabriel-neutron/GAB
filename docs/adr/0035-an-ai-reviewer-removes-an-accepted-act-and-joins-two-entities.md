# ADR 0035 — An AI reviewer removes an accepted act and joins two entities

**Status** Accepted · 8 November 2026

## Context

The tenfold wave left accepted acts that the wave sessions call wrong, and duplicate entities of one
firm. A decided act is frozen, and the decisions of an AI reviewer acted only on an act that waits.
So no session could correct the record before the report. Also, an AI reviewer could promote a unit
that waits for a better source, and the rule "a waiting unit is not for a reviewer" was only a line
of a skill. The operator asked for the three changes in issues #1408, #1415 and #1437.

## Decision

- **The lane of a reviewer.** The promotion of an AI reviewer, alone or in a group, refuses a unit
  of the lane "waiting", with a reason that names the rule. The doors of the operator do not change.
- **A removal is a new act.** The act names the accepted act that it removes, and it targets the row
  that the removed act wrote. It cites one passage, and it keeps the copy of what it took away. Two
  kinds of act can be removed: a new relation, which leaves the graph as a delete does, and a change
  of the values of an entity, whose values go back to the values before it. Each other kind is
  refused. An act is removed one time only. A relation that an act in the queue names stays until
  that act is decided. A value on an entity that a join absorbed is removed on the entity that
  stays.
- **A removed act leaves each count.** It stays accepted in the ledger, so the history stays whole.
  The read of the acts names the removal of each removed act, and a count of the accepted acts
  leaves out each act that has one. A removed relation takes each accepted change of it (a start,
  an end, a type or a source) out of the count too. The label of a value does not read a removed act.
- **A join is a merge (M12).** The older entity stays, and the merge moves the values, the relations,
  the documents and the aliases of the newer one, and keeps its name as a former name. The act
  cites one passage. The door refuses one entity named twice and two entities of two types, and
  the merge checks the types again under its lock. An undo stays with the operator.
- **One transaction.** Each door writes its act and decides it at once, as the operator signs an
  act of its own. The rule that an act is never decided by the transaction that proposed it stops a
  machine that proposes a fact and accepts it. A removal adds no fact, and a join adds no fact, and
  each needs a reason and a cited passage. The origin is "decided by an AI reviewer".

## Cost

- Each read that counts or labels the accepted acts must know the removal. The views of the
  database do. A count written by hand must leave out the removed acts.
- The readers of the ledger in the browser know one more kind of act.

## Alternatives

- **A flag on the act, and each read filters it.** The graph keeps the row, so one missed read
  shows the removed fact. Refused.
- **A counter-act in the queue (a delete, or a change back to the old values).** A recount cannot
  find which act a change back removed, and a machine cannot propose a delete. Refused.
- **A separate write path for a join.** It copies the merge, and it loses the copy that an undo
  needs. Refused.
