# ADR 0001 — Repository conventions

**Status** Accepted · **Version** 4 · 10 August 2026
**Tickets** #20 (closed), #22 (closed by ADR 0003), #23 (closed by ADR 0003), #24 (closed by
version 3), #30 (closed)

**Version 4** adds the drift step to §3. The command is now four steps. ADR 0003 §1 required
this step and could not add it, because no generator was named and the step needs a running
database. ADR 0003 version 3 names the generator, so the step is now written. Nothing else in
this ADR changed. §1 gains `src/db/`, which is a fact about the repository and not a decision.

**No decision in this ADR changed when ADR 0002 and ADR 0003 were accepted.** Two things that
are not decisions did change: the "Deliberately absent" table, which records the state of the
repository, and the folder tree in §1, which shows it.

**#30 is closed, and it holds one fact that a reader of §3 and §5 needs.** `pnpm check` stops
at random on this machine with a libuv assertion. The cause is outside this repository:
several Node projects run on the machine at the same time. A crash is not a failure. Run the
command again. This matters most for the drift step of §3, which is measured by the diff and
never by the exit code of the generator.

**No decision in this ADR changed when ADR 0004 was accepted and the first source files were
written.** The folder tree in §1 is refreshed, as this ADR permits. Two facts below are now
out of date, and ADR 0004 holds the newer statement of each. Read ADR 0004 with them:

- The Consequences say "One package means one `tsconfig`". There are now four files and three
  compile targets: the browser bundle, the Node configuration files at the root, and the
  Storybook folder. Each one needs a different `lib` and different `types`. ADR 0004 answers
  this: the signal "is met with a TypeScript configuration and not with a workspace". §6 is
  untouched, and the repository is still one package.
- §3 described three read-only steps. The type check step now generates the route tree before
  it runs, per ADR 0004, so `pnpm check` **writes** `src/routeTree.gen.ts`. Version 4 below
  makes the command four steps, and two of them write. A person who runs it may find a
  generated file in the diff, and that is the intended signal for §5: the operator reads the
  diff.

**No decision in this ADR changed when #60 installed Storybook and the Vitest packages.** Two
facts changed. The folder tree in §1 gains `.storybook/`, `tsconfig.storybook.json` and
`vitest.config.ts`. `pnpm test` no longer stops with an error: it runs `vitest run`, and one
story under `src/shared/ui/` proves the loop. §4 chose that runner, and #60 installs it. The
test policy stays open, and the tracker carries it. §3 is untouched: `pnpm check` still runs
three steps, and it still never runs the tests.

**Version 3** rewrote §1 and §4 in place, which the rules in `docs/README.md` permit while an
ADR has produced no code. §1 gained the folder shape the frontend needs. §4 named the runner
and closed #24.

## Context

`spec.md` §6 listed the folder layout, the check command, the test command and the
definition of done as open.

Version 1 decided a pnpm workspace with `apps/` and `packages/`. A six-agent review rejected
the reasoning. Three findings stand:

- The justification was T6 — one Zod rule shared by the frontend and the backend. It is
  void. The frontend only reads (T4). It needs the shape of a response, not the validation
  of a write.
- The register already refuses this shape of decision twice. C6 refuses `project_id` while
  one project exists. T5 refuses two services while one operator exists. Both accept a later
  migration as the price of a simple present.
- Version 1 gave no home to the database or to the infrastructure. T6 and `spec.md` §4 put
  validation, the read role and the graph traversal inside PostgreSQL. That SQL is logic.

pnpm and the workspace are two decisions, not one. Strict resolution belongs to pnpm.

## Decision

### 1. One package

```
/
├── docs/
├── db/                    the schema — ADR 0003
├── infra/                 the services — ADR 0002
├── .storybook/            the story configuration — two files, named in tsconfig.storybook.json
├── index.html             the entry document — ADR 0004
├── package.json
├── pnpm-workspace.yaml    pnpm settings only. It declares no package; see §6
├── tsconfig.json          the solution file. It compiles nothing
├── tsconfig.app.json      the browser bundle
├── tsconfig.node.json     the configuration files at the root
├── tsconfig.storybook.json  the Storybook folder — #60
├── vite.config.ts
├── vitest.config.ts       the suite of `pnpm test` — #60
├── eslint.config.ts
├── components.json        the shadcn aliases, pointed inside src/shared/
├── .nvmrc
└── src/
    ├── main.tsx           the mount
    ├── router.tsx         the router instance and its defaults
    ├── index.css          the one stylesheet
    ├── theme.css          the GAB tokens. Nothing imports it yet
    ├── routeTree.gen.ts   generated, and committed — ADR 0004 §8
    ├── features/
    │   └── <feature>/     one feature, one flat folder
    ├── shared/            the leaf layer, with the user interface kit in shared/ui/
    ├── routes/            the router's route files
    ├── contract/          the shape of read data, generated — ADR 0003 §8
    └── db/                the shape of the base tables, generated — ADR 0003 §8
```

**`contract/` and `db/` hold generated files, and neither is a feature.** ADR 0003 §8 governs
what writes them and which folder may import which. Both are declared in the lint
configuration, because a folder that nobody declares fails the lint on purpose.

`db/` and `infra/` are shown because they now exist. The table under "Deliberately absent"
records the state of each one. `pnpm-workspace.yaml` holds two pnpm settings and no
`packages` key. Its name says workspace and it declares none, so §6 is not reached.

**A feature never imports another feature.** The seam between two features carries three
things and nothing else: the current selection, the active filter, and the read client. All
three live in `shared/`. A lint rule enforces this; it is not a convention.

**`shared/` is a leaf.** Every feature may import it. It imports no feature. It holds the three
seam items above, and the user interface kit. A component library is not a feature, so an
import of it is never a breach of the rule above.

**`routes/` is not a feature.** It holds the route files that the router reads, and it is the
only folder that may import a feature.

**`main.tsx` and `router.tsx` are in no folder above, so the lint rule cannot classify them.**
The rule matches a folder, and the only folder that holds these two is `src/` itself, which
would then swallow every folder that nobody declared. The two files are therefore named in the
lint configuration and excluded. A name is not a pattern that authored code can enter: a third
file at the root of `src/` fails. Nothing they import escapes, because a second rule refuses a
dependency on any file that belongs to no folder above.

### 2. pnpm, and Node 24

pnpm resolves strictly. A package that imports something it did not declare fails. Node is
pinned to the 24 LTS line in `.nvmrc` and in `engines.node`. Pin the line, never the patch.

### 3. `pnpm check`

It runs the type check, the lint, the format check and the drift check. **It never runs the
tests.**

TypeScript runs with every strict check on. The lint set is `typescript-eslint`. The
formatter is Prettier, and it never touches `docs/`. All three are pinned before the first
source file: a rule set added later is answered with suppressions, and `gab-coder` requires
zero suppressions.

**The drift check regenerates the database types and fails when the result differs from what
is committed.** ADR 0003 §1 makes SQL the only source of truth, and a generated file that
nobody regenerates is a copy that drifts. The step is added here, and not left as a separate
command, because §5 makes a green `pnpm check` the definition of done. A drift check that a
person must remember to run is the discipline that ADR 0003 refuses.

Three properties of this step are not obvious, and each one is a rule:

- **It needs a running database.** Introspection reads the live schema. Docker Desktop must be
  up, and the two commands of ADR 0003 §4 must have run. This is the accepted cost of the
  step. A task that touches no SQL still pays it.
- **It is measured by the diff, never by the exit code of the generator.** The generator stops
  at random on this machine, per the preamble above, and it writes correct and identical
  output when it does. The step therefore regenerates, then compares, and reports only the
  comparison.
- **The comparison is scoped to the two generated folders.** An unrelated change in the
  working tree must not fail it.

**This step writes.** So does the type check, which generates the route tree. A person who
runs `pnpm check` may find a generated file in the diff. §5 says what that means.

**The step is decided here and is not yet in `package.json`.** It is added with the first
migration, for the reason ADR 0003 §4 gives about the database commands: a step that reads an
empty database reports success and proves nothing. Until then `pnpm check` runs three steps.

### 4. `pnpm test`

A separate command. The suite reads documents, embeds them and calls agents, so it is slow.
A check that runs after each file must stay fast.

**The runner is Vitest.** One runner, for every kind of test. #5 chose Vite as the build tool,
and Vitest reads the same configuration, the same resolver and the same TypeScript settings.
A second runner would mean a second configuration of the same things, kept in step by hand.

#24 asked whether code that does not render must wait for the frontend. It does not, and the
answer costs nothing: the same runner serves a parser, a payload validator, a query against
PostgreSQL, and a rendered component. `pnpm test` runs one process and reports one result.

This section chooses a tool. It does not say what to test. **The test policy is open, and the
tracker carries it.** The two are not settled together — a runner chosen before a policy tends
to become the policy.

### 5. Definition of done

An agent reports **DONE** when `pnpm check` passes and the change matches its ticket. An
agent never commits, and it never claims more.

The operator **accepts** a change after reading the diff and updating the ticket. An agent
cannot observe that gate, so it must not report it.

The test requirement is absent on purpose. Too few tests and too many tests are both faults.
**The test policy is open, and the tracker carries it.** It amends this section when it is
settled.

### 6. When this layout becomes a workspace

Convert when a second deployable part exists **as code**, and one module is imported by
both. Not on a plan, and not on a preference.

## Deliberately absent

Each folder below is expected. Do not improvise one. **The Status column is a fact about the
repository and is kept current. No decision in this ADR changes when it is updated.**

| Folder | Holds | Status |
|---|---|---|
| `db/` | Migrations, re-runnable functions and triggers, roles and grants | **Created**, by ADR 0003, which closed #22 and #23. It holds `README.md` only. No DDL is written. |
| `infra/` | The services: PostgreSQL/PostGIS and MinIO (T5), the bucket policy (T3) | **Created**, by ADR 0002. PgBouncer and the CDN rules of `spec.md` §4 stay absent; they need a deployment, which does not exist. |
| `src/contract/` | The shape of read data, generated from the `api` schema | **Absent.** ADR 0003 §8 names the generator. The folder appears with the first migration, because a generator with no table to read produces nothing. |
| `src/db/` | The shape of the base tables, generated from `public` | **Absent**, for the same reason. No file under `src/` may import it — ADR 0003 §8. |

## Consequences

- A green `pnpm check` means the change compiles, conforms, and does not disagree with the
  database. It does not mean the change is correct.
- **`pnpm check` now needs a running database.** That is the price of the drift step of §3,
  and it is paid on every task, not only on a task that touches SQL.
- No repository layout keeps T4 true. T4 is broken by a `fetch` to the backend origin, which
  no package manager sees. The guarantee lives in the `gabriel_read` role, in the connection
  string of the read layer, and in one base URL given to the frontend at build time.
- One package no longer means one `tsconfig`. The browser bundle, the Node configuration files
  and the Storybook folder are three targets in one package. ADR 0004 answers this signal with
  a TypeScript configuration and not with a workspace, so §6 is not reached.

## Not decided here

Every other open question lives in `spec.md` §6, with its ticket number. This ADR does not
copy that list, so the two cannot disagree.
