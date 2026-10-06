# ADR 0001 — Repository conventions

**Status** Accepted · 10 August 2026

## Decision

The repository is a pnpm workspace. The web application is the root package. Each other part that
deploys alone is a package under `packages/`. The database schema (`db/`), the infrastructure
(`infra/`), the tools (`tools/`) and the documentation (`docs/`) each have a top-level folder.

Make a new package only when a second deployable part exists as code, and when it shares a module
with another part. Do not make a package for a plan or for a preference.

Under `src/`, there are four kinds of folder:

- **A feature.** One surface of the user interface, in one flat folder.
- **`shared/`.** The user interface kit, and what one feature needs from another feature.
- **`routes/`.** The route files that the router reads.
- **A generated folder.** ADR 0003 tells what writes it and who can import it.

A feature never imports another feature. `shared/` imports no feature. Only `routes/` can import a
feature.

The lint configuration is the only statement of this layout. It declares each folder, and it
refuses a folder that nobody declared. Do not draw the tree in a document, because a copy of the
tree drifts from the code.

The project uses pnpm and the Node LTS line. pnpm resolves strictly, so an import that the package
did not declare fails.

## The two commands

- `pnpm check` runs the drift check, the type check, the lint and the format check. It does not run
  the tests.
- `pnpm test` runs the tests. Vitest is the only test runner, for every kind of test.

TypeScript runs with all strict checks. The linter is `typescript-eslint` and the formatter is
Prettier. The repository allows no suppression. A generated file can be excluded by its name, never
by a pattern that written code can enter.

The drift check makes the database types again and compares them with the committed types. A
difference fails the check.

**Definition of done:** `pnpm check` passes, the tests of the change pass, and the change does what
its ticket asks, and a separate review agent finds nothing that blocks. The agent then merges into
`staging`. The operator promotes `staging` to `main`.

## Reason

Strict resolution, strict types and zero suppressions find errors before review. A lint rule is the
only layout rule that cannot drift, because it fails the build. Separate features let one agent
build each surface in isolation. One test runner gives one configuration for all tests.

The check and the tests are two commands because the tests are slow, and the check must stay fast
enough to run after each file.

## Cost

- `pnpm check` needs a running database for each task, also for a task that does not touch SQL.
- `pnpm check` can write. The drift check and the route generator can change a generated file, so
  a person can find a generated file in the diff.
- A green `pnpm check` shows that the change compiles and obeys the rules. It does not show that
  the change is correct.
- No layout rule keeps the public read safe. The read role of the database and the read address
  given to the frontend keep it safe (ADR 0003).
- One package can hold more than one compile target: the browser bundle, the Node configuration
  files and the Storybook folder each have their own TypeScript configuration.
