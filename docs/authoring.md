# Writing a document

Read this before you write or change a file under `docs/`, `README.md` or `CLAUDE.md`.

## Who owns each document

| Document | Owner | Rule |
|---|---|---|
| `prd.md`, `decisions.md` | The operator | They hold the purpose, the uses and the product rules. Change them only when the operator asks for it in the session. A hook asks the operator before each write. |
| Every other document | The agent | Change it with no approval, in the same pull request as the code it describes. |

## A document tells why and gives the general view

A document holds what the code cannot show:

- the purpose and the reason for a choice;
- the cost of the choice;
- the general shape: the components, the flows, who asks what from whom;
- the rules that hold on every path.

A document can name the stable things: the main folders (`db/`, `packages/`, `src/`, `infra/`,
`tools/`), the packages, the external services, and the actors by their role.

A document never copies the code. The code is the source of truth, and an agent reads it for each
detail. So a document holds **no** table name, column, type, function name, file name below the
main folders, job kind, enum value, SQL text, configuration value, count, status of a ticket, or
list that repeats the code.

**The test:** if a normal code commit can make a sentence false, delete the sentence.

| Write this | Not this |
|---|---|
| The database refuses an attribute that has no source. | The `chk_attrs_sourced` check calls `attrs_are_sourced(jsonb)`. |
| A machine role can propose, and only the operator promotes. | `gabriel_agent` has `EXECUTE` on six doors: `propose_change`, … |
| The worker runs the AI jobs from a queue in the database. | The job kinds are `extract_text`, `second_read`, `load_mapped`. |

## Decide, or ask the operator

- **A technical choice:** a name, a column, a format, a structure, the text of an ADR. The agent
  decides it. If the choice is costly to reverse, the agent writes the reason in an ADR. The agent
  continues, and asks no question.
- **A product choice:** what the app does, what is public, what counts as evidence, the scope. Ask
  the operator. The answer goes into `prd.md` or `decisions.md`.

## ADRs

- An ADR holds one decision, its reason and its cost. Keep it to 1,000 words or fewer.
- Keep each ADR true. Edit it in place when the build changes, because git keeps the old text.
  When a decision is replaced, mark it **Superseded by ADR NNNN**.
- A measurement keeps its date.
- Name another document by its name only (`ADR 0003`, `decisions.md` M8). Do not cite a section
  number, because section numbers change.

## Size

Keep each document short. A document that grows past 1,000 words probably copies the code or
holds more than one decision.

## Style

Write in ASD-STE100 Simplified Technical English, as `CLAUDE.md` requires.
