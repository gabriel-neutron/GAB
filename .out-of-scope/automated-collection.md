# Continuous automated collection

Gabriel has no scheduled monitoring, no crawlers, and no real-time connectors. Documents
enter the corpus because an analyst put them there.

## Why this is out of scope

Scouting and collecting raw material sits outside the workflow by design. The system starts
at ingestion: a document arrives, proposals come out. That is a batch regime, and it is the
whole shape of the pipeline.

Continuous collection would break the model in a specific way rather than merely adding
work. The most likely breaking point of the schema is attribute-key drift — three spellings
of one notion coexisting until the graph is silently unusable. The guardrail against it is
monitoring, which makes drift *visible* but does not prevent it, and that guardrail is
already declared insufficient the moment an agent writes in volume. A collector running on
a schedule is precisely a machine writing in volume, unattended.

Automated collection also implies a target list, a cadence, and a footprint that persist
whether or not anyone is investigating. That is a different tool with a different risk
profile.

## Prior requests

None yet — seeded from `docs/prd.md` §5 at project setup.
