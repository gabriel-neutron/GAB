# Gabriel

An OSINT data-fusion environment built as a personal investigation instrument. It lets a
single analyst ingest documents, extract and correlate information, and build a graph of
entities and relations in which **every claim carries its source**.

Machine output never becomes evidence on its own. Agents write freely into a **candidate
layer**; only an explicit act of promotion by the analyst moves anything into the
**evidentiary layer** that feeds reports, datasets, and public maps.

**Status: build started.** The scoping phase is closed and the specifications below are
settled. The application shell exists: it renders, and it holds no feature. Open decisions
are tracked as issues.

## Shape

TypeScript end to end. PostgreSQL/PostGIS is the only GOLD datastore; MinIO holds the
immutable raw files. The frontend is React with Vite and TanStack Router, the component kit
is shadcn, and the map library is MapLibre. Decisions T7 and T8 deferred the last two; ADR
0004 and ADR 0005 replace them. The build decisions live in the ADR register in
[`docs/README.md`](docs/README.md). Open questions live as
[issues](https://github.com/gabriel-neutron/GAB/issues).

Documentation starts at [`docs/README.md`](docs/README.md).

## License

MIT — see [`LICENSE`](LICENSE).
