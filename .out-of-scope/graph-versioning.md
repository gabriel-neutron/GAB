# Graph version history

There is no global history of the graph, no audit log of every change, and no general
undo. Only entity merges are reversible.

## Why this is out of scope

The model is current-state and unversioned. Merges are the single exception: a merge stores
a snapshot of the absorbed entity and all its relations, so it can be undone completely.
That exception exists because a merge is the one destructive operation an analyst performs
routinely and cannot easily reconstruct by hand.

Everything else is recoverable from the material rather than from a change log. The raw
files are immutable and every claim cites a document, so the evidentiary layer can be
rebuilt from its sources. A general version history would duplicate that guarantee in a
weaker form, at the cost of writing history rows on every attribute update.

Requests for "who changed this and when" are also worth reading carefully: with a single
operator and no authentication, the *who* is always the same, and the *when* is rarely the
question. What is usually wanted is provenance — which document supports this value — and
that already exists.

## Prior requests

None yet — seeded from `docs/prd.md` §5 at project setup.
