# Deploy

The public deployment is read-only. Supabase holds the database, the read API and the raw store.
Vercel serves the frontend. The writer and the worker jobs stay on the operator's machine.

## Supabase

1. Create the project.
2. In `infra/.env`, set `GABRIEL_DB_HOST`, `GABRIEL_DB_PORT` and `GABRIEL_DB_SSL=true` to the
   connection of the project.
3. Run `pnpm db:migrate`, then `pnpm db:apply`.
4. Set `RAW_STORE_ENDPOINT` to the S3 endpoint of Supabase Storage, and `RAW_STORE_REGION` to the
   region of the project.

The read API serves the `api` schema as `gabriel_read`. It writes nothing.

## Vercel

1. Deploy the repository root.
2. Set `VITE_API_URL` to the PostgREST URL of the project.

`vercel.json` sends every path to the application, except `/assets/` and `/write`. A request to
`/write` gets a 404.

## The writer and the worker

Run `pnpm writer`, `pnpm layout` and `pnpm reconcile` on the operator's machine, with the same
`infra/.env` as above. They run as they do against the local stack. Only the values change.

## Public writes

No public write path exists. A public write needs real authentication first, and that is separate
work.
