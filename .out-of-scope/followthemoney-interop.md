# FollowTheMoney interoperability

Gabriel does not produce or consume FollowTheMoney, and no standard exchange format is
emitted. Any external reuse of the dataset requires conversion work.

## Why this is out of scope

FollowTheMoney was evaluated and rejected. Its ontology is built for exchange between
organisations, and adopting it means accepting its type system — which is exactly the
constraint the schema refuses. The rule here is that no data is deformed to fit a field:
what is used to relate things is typed, what merely describes them is free-form.
An imposed ontology inverts that.

The cost is stated plainly in the risk register: no interoperability. That is accepted, not
overlooked. A single analyst working a single corpus gains nothing from a shared vocabulary
that no one else is reading, and loses the ability to record heterogeneous, incomplete
information the way it actually arrives.

If interoperability ever matters, it becomes an export concern — a mapping written once
against a stable internal schema — not a constraint on how entities are modelled.

## Prior requests

None yet — seeded from `docs/prd.md` §5 at project setup.
