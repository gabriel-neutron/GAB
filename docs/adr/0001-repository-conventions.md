# ADR 0001 — Repository conventions

**Status** Accepted · 10 August 2026
**Tickets** #20 (closed), #22 (closed by ADR 0003), #23 (closed by ADR 0003), #24 (closed by
this ADR), #30 (closed)

## Context

`spec.md` listed the folder layout, the check command, the test command and the definition of
done as open.

A first draft decided a pnpm workspace with `apps/` and `packages/`. A six-agent review
rejected the reasoning. Three findings stand:

- The justification was T6 — one Zod rule shared by the frontend and the backend. It is
  void. The frontend only reads (T4). It needs the shape of a response, not the validation
  of a write.
- The register already refuses this shape of decision twice. C6 refuses `project_id` while
  one project exists. T5 refuses two services while one operator exists. Both accept a later
  migration as the price of a simple present.
- That draft gave no home to the database or to the infrastructure. T6 and `spec.md` §4 put
  validation, the read role and the graph traversal inside PostgreSQL. That SQL is logic.

pnpm and the workspace are two decisions, not one. Strict resolution belongs to pnpm.

## Decision

### 1. One package

One `package.json` at the root. `pnpm-workspace.yaml` holds pnpm settings and declares no
package, so §6 is not reached.

The database schema, the infrastructure and the documentation each get a top-level folder.
Under `src/`, four kinds of folder exist and no fifth is improvised:

- **A feature.** One feature, one flat folder.
- **`shared/`, the seam.** It holds the user interface kit, and what one feature needs from
  another.
- **`routes/`.** The route files the router reads.
- **A generated folder.** ADR 0003 §8 says what writes it and who may import it. A generated
  folder is not a feature.

**A feature never imports another feature.** The seam carries the active filter and the read
client, and both live in `shared/`. **The selection is not one of them: it is a route
parameter, and ADR 0004 §7 holds it.** The operator ruled on 12 August 2026, when the two ADRs
were found to disagree.

**`shared/` is a leaf.** Every feature may import it. It imports no feature. A component
library is not a feature, so an import of the kit is never a breach of the rule above.

**`routes/` is not a feature.** It is the only folder that may import one.

**The lint configuration is where this layout is stated, and it is the only place.** Each
folder above is declared there, the default is refusal, and a folder that nobody declared
fails the lint on purpose. A tree drawn in this document would be a second copy of the
repository, and a copy drifts.

**A file that belongs to no folder above cannot be classified by a folder rule.** The mount
and the router instance are therefore excluded **by name**. A name is not a pattern that
authored code can enter, so a further file at the root of `src/` fails, and nothing those two
import escapes.

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
nobody regenerates is a copy that drifts. The step belongs here, and not in a command of its
own, because §5 makes a green `pnpm check` the definition of done. A drift check that a person
must remember to run is the discipline that ADR 0003 refuses.

Three properties of this step are not obvious, and each one is a rule:

- **It needs a running database.** Introspection reads the live schema. Docker Desktop must be
  up, and the commands of ADR 0003 §4 must have run. This is the accepted cost of the step. A
  task that touches no SQL still pays it.
- **It is measured by the diff, never by the exit code of the generator.** The generator stops
  at random on the operator's machine with a libuv assertion, because several Node projects
  run there at the same time, and it writes correct and identical output when it does. The
  step therefore regenerates, then compares, and reports only the comparison. #30 holds the
  cause. A crash of `pnpm check` is not a failure: run it again.
- **The comparison is scoped to the generated folders.** An unrelated change in the working
  tree must not fail it.

**This step writes, and so does the type check, which generates the route tree.** A person who
runs `pnpm check` may find a generated file in the diff. §5 says what that means.

**The drift step is decided here, and it enters `package.json` with the first migration.** A
step that reads an empty database reports success and proves nothing.

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

## Consequences

- A green `pnpm check` means the change compiles, conforms, and does not disagree with the
  database. It does not mean the change is correct.
- **`pnpm check` needs a running database.** That is the price of the drift step of §3, and it
  is paid on every task, not only on a task that touches SQL.
- No repository layout keeps T4 true. T4 is broken by a `fetch` to the backend origin, which
  no package manager sees. The guarantee lives in the `gabriel_read` role, in the connection
  string of the read layer, and in one base URL given to the frontend at build time.
- **One package does not mean one `tsconfig`.** The browser bundle, the Node configuration
  files at the root and the Storybook folder are separate compile targets in one package, and
  each needs its own `lib` and `types`. ADR 0004 answers that signal with a TypeScript
  configuration and not with a workspace, so §6 is not reached.

## Not decided here

Every open question lives on the tracker, with its ticket. This ADR copies no part of that
list, so the two cannot disagree.
