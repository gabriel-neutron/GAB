# Deploy

The public deployment is read-only. The deployment target is open. The writer and the worker jobs
stay on the operator's machine.

## The database and the raw store

1. In `infra/.env`, set `GABRIEL_DB_HOST`, `GABRIEL_DB_PORT` and `GABRIEL_DB_SSL=true` to the
   connection of the database.
2. Run `pnpm db:migrate`, then `pnpm db:apply`.
3. Any S3 provider can hold the raw store. Set `RAW_STORE_ENDPOINT` to its S3 endpoint and
   `RAW_STORE_REGION` to its region.

The read API serves the `api` schema as `gabriel_read`. It writes nothing.

## Vercel

1. Deploy the repository root.
2. Set `VITE_API_URL` to the URL of the read API.

`vercel.json` sends every path to the application, except `/assets/` and `/write`. A request to
`/write` gets a 404.

## The writer and the worker

Run `pnpm writer`, `pnpm layout` and `pnpm reconcile` on the operator's machine, with the same
`infra/.env` as above. They run as they do against the local stack. Only the values change.

## Public writes

No public write path exists. A public write needs real authentication first, and that is separate
work.
