# Authoring a document

Every document lives in `docs/`. `README.md` and `CLAUDE.md` stay at the repository root, and
`CONTEXT.md` joins them when the glossary exists, because every skill reads it from that path.

**The operator owns `docs/`.** An agent proposes a change and names the document. It writes
none.

## The drift test

A copy of something that changes is a copy that **drifts**. ADR 0003 §1 refuses drift in the
schema, and the same rule holds for prose: a document drifts the moment it states a fact.

**A sentence belongs in `docs/` only when a normal commit cannot make it false.** Installing a
library, adding a file, closing a ticket: when one of these makes the sentence false, the
sentence is a fact, and it already has a home. The repository, the configuration files and the
tracker each hold their own facts.

Name the constraint, and let the instance live in the code:

| Belongs in a document | Drifts, and belongs elsewhere |
|---|---|
| The runner is Vitest | `pnpm test` runs one browser project |
| A feature never imports another feature | The features are `map`, `graph`, `review` and `detail` |
| A generated file is committed, and a drift check guards it | `src/contract/` holds four files |
| The zoom breakpoints are calibrated on real data | The breakpoints are 5, 10 and 15 |

**A document is ready when every sentence in it survives that test.**

## Two rules that follow

**Executing an accepted decision changes no document.** Installing the runner that an ADR
chose is that ADR, carried out. The ticket records the work, and the commit shows the result.
A document is needed when a **new** decision is made.

**A code commit leaves `docs/` untouched.** A task that seems to need a document change has met
a decision that no ticket carries. Stop, and ask the operator.

**Correct the document before the ticket closes.** A ticket that a document cites by number
carries that document with it. Put the correction under ASK first, and close the ticket after.
A ticket that closes first leaves a document that says a settled question is open, and nothing
downstream finds it.

## Where each kind of sentence lives

Placement follows one axis: how long the sentence stays true.

| Lifetime | Home |
|---|---|
| Never changes | `decisions.md`, which is locked, and `adr/NNNN`, which is written once |
| Changes when the scope changes | `prd.md` |
| Changes when an invariant, the read path or the write path changes | `spec.md` |
| Changes every day | the tracker, the code, and the configuration files |

## What an ADR is

**A document is an ADR when all four are true.** The decision is made, not asked. It is about
the build. It is costly to reverse. No entry in `decisions.md` already settles it.

**Four things take another home.** An open question is a tracker ticket. A scope decision is
`decisions.md` and `prd.md`. A rule held on every path is `spec.md`. A reversible choice is a
configuration file.

## Rules for an ADR

- Number ADRs from 0001 up. Use each number once, and keep it for ever. Status is
  **Proposed**, **Accepted**, or **Superseded by ADR NNNN**.
- **An ADR is written once.** After it is Accepted, the Status line is the only line that
  changes. A decision that changes gets a new ADR, which names the one it replaces. An ADR
  carries no version.
- Write the decision, the reason and the cost. A measurement that produced the decision is a
  reason, and it belongs there. Every other fact about the repository as it stands today —
  a folder tree, a file list, a status table, a ticket list, a "not yet" — drifts, and stays
  out.
- **A measurement keeps its date, and it is never refreshed.** A number that a measurement
  produced is the reason for the decision, and an old reason is still the reason. Write the
  date beside it. A new number is a new decision, and it needs a new ADR. This is why a
  measurement passes the drift test that an ordinary fact fails.
- **Silence says that a decision did not change.** Write the decision, and leave it alone.
- Cite a section: `ADR 0003 §7`.
- Name every decision an ADR replaces. `decisions.md` is locked, so an ADR that contradicts an
  entry is a fault: stop, and ask the operator.
- An ADR cites a **closed** ticket only, and only when that ticket adds something the ADR does
  not say. For an open question write "the tracker carries it", and leave the number out.
- Each meaning has one owner. When a second document needs the same rule, it cites the owner.
- A new document gets a row in the first table of `README.md`. A new ADR gets a row in the
  register there instead.
