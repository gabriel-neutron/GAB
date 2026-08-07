# ADR 0001 — Repository conventions

**Status** Accepted · **Version** 2 · 7 August 2026
**Tickets** #20 (closed), #21 test policy, #22 migration tool, #23 read grant, #24 test runner

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
├── package.json
├── tsconfig.json
├── .nvmrc
└── src/
    └── <feature>/      one feature, one flat folder
```

### 2. pnpm, and Node 24

pnpm resolves strictly. A package that imports something it did not declare fails. Node is
pinned to the 24 LTS line in `.nvmrc` and in `engines.node`. Pin the line, never the patch.

### 3. `pnpm check`

It runs the type check, the lint and the format check. **It never runs the tests.**

TypeScript runs with every strict check on. The lint set is `typescript-eslint`. The
formatter is Prettier, and it never touches `docs/`. All three are pinned before the first
source file: a rule set added later is answered with suppressions, and `gab-coder` requires
zero suppressions.

### 4. `pnpm test`

A separate command. The suite reads documents, embeds them and calls agents, so it is slow.
A check that runs after each file must stay fast. **The runner is open — #24**, so the
command fails today and names that ticket.

### 5. Definition of done

An agent reports **DONE** when `pnpm check` passes and the change matches its ticket. An
agent never commits, and it never claims more.

The operator **accepts** a change after reading the diff and updating the ticket. An agent
cannot observe that gate, so it must not report it.

The test requirement is absent on purpose. Too few tests and too many tests are both faults.
**#21** settles the policy, then amends this section.

### 6. When this layout becomes a workspace

Convert when a second deployable part exists **as code**, and one module is imported by
both. Not on a plan, and not on a preference.

## Deliberately absent

Each folder below is expected. None is created yet. Do not improvise one.

| Folder | Holds | Gated by |
|---|---|---|
| `db/` | Migrations, re-runnable functions and triggers, roles and grants | #22 fixes the tool and the file convention. No DDL before it closes. |
| `infra/` | The services: PostgreSQL/PostGIS and MinIO (T5), the bucket policy (T3), PgBouncer and the CDN rules (`spec.md` §4) | How PostgreSQL runs locally. No ticket yet. |
| `src/contract/` | The shape of read data. The mock and the real read layer both satisfy it. | #23. Its form follows the database and the typing. |

## Consequences

- A green `pnpm check` means the change compiles and conforms. It does not mean the change
  is correct.
- No repository layout keeps T4 true. T4 is broken by a `fetch` to the backend origin, which
  no package manager sees. The guarantee lives in the `gabriel_read` role, in the connection
  string of the read layer, and in one base URL given to the frontend at build time.
- One package means one `tsconfig`. The day a browser bundle and a Node process need
  different targets is the first real signal for §6.

## Not decided here

Every other open question lives in `spec.md` §6, with its ticket number. This ADR does not
copy that list, so the two cannot disagree.
