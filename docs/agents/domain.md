# Domain words

How a skill uses the documentation of this project while it explores the code.

## Where the words live

- **`CONTEXT.md`**, at the repository root — the glossary and the ubiquitous language. The
  `mattpocock-skills:domain-modeling` skill writes it, and only when a term or a decision is
  settled. The `grilling` and `codebase-design` skills reach that skill.
- **`docs/prd.md` and `docs/decisions.md`** — the domain words of this project, until the
  glossary exists. Read these two.
- **`docs/adr/`** — the decisions that touch the area you are about to change.
  `docs/README.md` holds the register, and ADR 0001 holds the repository layout, the check
  command and the definition of done.

**An absent file is a silent condition. Continue, and report nothing about it.** The glossary
arrives when a term is settled, and never in advance.

`CONTEXT.md` stays at the repository root, because every skill reads it from that path.
`docs/authoring.md` records that exception to "every document lives in `docs/`".

## Use the words of the glossary

When your output names a domain concept — an issue title, a proposal to refactor, a
hypothesis, a test name — use the term as the glossary defines it, and keep the term it tells
you to prefer.

A concept that the glossary lacks is a signal. Either the language is invented here, and you
think again, or the gap is real, and you record it for `mattpocock-skills:domain-modeling`.

## Report a conflict with a decision or an ADR

When your output disagrees with an ADR, or with an entry in `docs/decisions.md`, say so in the
output itself:

> _Disagrees with P1 (nothing reaches the evidentiary layer without promotion), and it is
> correct to open it again because…_

`docs/decisions.md` is locked. An entry changes only when a new decision names it and replaces
it.
