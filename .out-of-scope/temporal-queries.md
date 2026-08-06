# Temporal queries

The graph cannot answer "what was the state on 3 March 2024". It holds current state only.

## Why this is out of scope

The data model is deliberately current-state. The single exception is that identity and
ownership relations carry a validity interval — dates are permitted in exactly two places,
and nowhere else.

This is a declared and accepted loss, not an oversight. It means the graph cannot
demonstrate by query that an asset belonged to X at the time of an event and to Y
afterwards. The validity intervals soften that loss without closing it.

Any demonstration of sequence rests on the documents. That is the intended path: the
documents are immutable, they carry access dates, and every claim cites them. The narrative
of "who held what, when" is built from sources and written into the report — not recovered
from a bitemporal query.

Making the graph temporal would mean versioning every entity, relation and attribute, and
rewriting every read path to take an as-of parameter. That is a different schema, and the
arbitration criterion does not support paying for it at 1 to 10k entities with one analyst.

## Prior requests

None yet — seeded from `docs/prd.md` §5 at project setup.
