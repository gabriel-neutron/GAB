# ADR 0001 — Repository conventions

**Status** Accepted · 10 August 2026

### 1. One package

One `package.json` at the root. `pnpm-workspace.yaml` holds pnpm settings and declares no package.

The database schema, the infrastructure and the documentation each get a top-level folder. Under
`src/`, four kinds of folder exist and no fifth is improvised:

- **A feature.** One feature, one flat folder.
- **`shared/`, the seam.** The user interface kit, and what one feature needs from another.
- **`routes/`.** The route files the router reads.
- **A generated folder.** §8 of ADR 0003 says what writes it and who may import it.

**A feature never imports another feature.** **`shared/` is a leaf**: every feature may import it,
and it imports no feature. **`routes/` is the only folder that may import a feature.**

**The lint configuration is where this layout is stated, and it is the only place.** Each folder is
declared there, the default is refusal, and a folder that nobody declared fails the lint on
purpose. A tree drawn in a document would be a second copy of the repository, and a copy drifts.

A file that belongs to no folder above is excluded **by name** — the mount and the router instance.
A name is not a pattern that authored code can enter.

### 2. pnpm, and Node 24

pnpm resolves strictly: a package that imports something it did not declare fails. Node is pinned
to the 24 LTS line in `.nvmrc` and in `engines.node`. Pin the line, never the patch.

### 3. `pnpm check`

It runs the type check, the lint, the format check and the drift check. **It never runs the tests.**

TypeScript runs with every strict check on. The lint set is `typescript-eslint`. The formatter is
Prettier, and it never touches `docs/`. All three are pinned before the first source file: a rule
set added later is answered with suppressions, and this repository allows none.

**The drift check regenerates the database types and fails when the result differs from what is
committed.** It needs a running database, it is measured by the diff and never by the exit code of
the generator, and its comparison is scoped to the generated folders. A drift check that reads an
empty database proves nothing, so it is added with the schema it guards.

This step writes, and so does the type check, which generates the route tree. A person who runs
`pnpm check` may find a generated file in the diff.

### 4. `pnpm test`

A separate command, because the suite is slow and a check that runs after each file must stay fast.

**The runner is Vitest**, for every kind of test: a parser, a payload validator, a query against
PostgreSQL and a rendered component. One runner, one configuration.

This section chooses a tool and not a policy. **The test policy is open, and the tracker carries
it.**

### 5. Definition of done

An agent reports **DONE** when `pnpm check` passes and the change matches its ticket. **An agent
never commits, and it never claims more.** The operator accepts a change after reading the diff.

### 6. When this layout becomes a workspace

Convert when a second deployable part exists **as code**, and one module is imported by both. Not
on a plan, and not on a preference.

## Consequences

- A green `pnpm check` means the change compiles and conforms. It does not mean it is correct.
- **`pnpm check` needs a running database**, on every task, not only one that touches SQL.
- No repository layout keeps T4 true. That guarantee lives in the `gabriel_read` role and in the
  base URL given to the frontend at build time.
- One package does not mean one `tsconfig`. The browser bundle, the Node configuration files and
  the Storybook folder are separate compile targets in one package.
