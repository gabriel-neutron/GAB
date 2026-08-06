# Gabriel

An OSINT data-fusion environment built as a personal investigation instrument. It lets a
single analyst ingest documents, extract and correlate information, and build a graph of
entities and relations in which **every claim carries its source**.

Machine output never becomes evidence on its own. Agents write freely into a **candidate
layer**; only an explicit act of promotion by the analyst moves anything into the
**evidentiary layer** that feeds reports, datasets, and public maps.

**Status: pre-build.** The scoping phase is closed and the specifications below are
settled. No source code exists yet. Open decisions are tracked as issues.

## Documentation

| File | What it holds |
|---|---|
| [`docs/prd.md`](docs/prd.md) | Product requirements: the analyst workflow, what the system must do, what it explicitly will not do, and the declared risks accepted by publishing an unvalidated candidate layer. |
| [`docs/decisions.md`](docs/decisions.md) | The decision register — 39 locked decisions with their rationale and accepted consequences. A later decision that contradicts an entry must replace it explicitly rather than work around it. |
| [`docs/spec.md`](docs/spec.md) | The technical specification: the six invariants, the full PostgreSQL/PostGIS schema, the read and write paths, and what is deliberately left unspecified. |

Start with `docs/prd.md` for intent, `docs/decisions.md` for why a thing is the way it is,
and `docs/spec.md` for how it is built.

## Shape

TypeScript end to end. PostgreSQL/PostGIS is the only GOLD datastore; MinIO holds the
immutable raw files. The frontend framework and the map library are open decisions and are
deliberately unmade — see the issue tracker.

## License

MIT — see [`LICENSE`](LICENSE).
