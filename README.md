# Gabriel

An OSINT data-fusion environment built as a personal investigation instrument. It lets a
single analyst ingest documents, extract and correlate information, and build a graph of
entities and relations in which **every claim carries its source**.

Machine output never becomes evidence on its own. Agents write freely into a **candidate
layer**; only an explicit act of promotion by the analyst moves anything into the
**evidentiary layer** that feeds reports, datasets, and public maps.

**Status: MVP shipped.** The core screens, the worker, and the database gate all pass. Open
work items stay tracked as issues.

## Shape

TypeScript end to end. PostgreSQL/PostGIS is the only GOLD datastore; SeaweedFS, an S3 server, holds the
raw files as they arrived. They stay unchanged by convention: the store does not prevent an
overwrite, because it has no versioning and no object lock. The frontend is React with Vite and
TanStack Router, the component kit is shadcn, and the map library is MapLibre. The build decisions live in the ADR register in
[`docs/README.md`](docs/README.md). Open questions live as
[issues](https://github.com/gabriel-neutron/GAB/issues).

The types of the database are generated from the live schema, and `pnpm check` regenerates them
and fails on a difference. **It therefore needs a running database**, on every task, and not only
on one that touches SQL.

Documentation starts at [`docs/README.md`](docs/README.md).

## License

MIT — see [`LICENSE`](LICENSE).
