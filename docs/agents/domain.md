# Domain Docs

How the engineering skills must use this repo's domain documentation when they explore the
codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the glossary and the ubiquitous language.
- **`docs/adr/`** — the ADRs that touch the area you are about to change.

**Neither exists yet. The repo is pre-build.** If a file is absent, **continue silently**.
Do not report that it is absent. Do not propose to make it in advance. The
`mattpocock-skills:domain-modeling` skill makes them only when a term or a decision is
actually resolved. The `mattpocock-skills:grilling` and `mattpocock-skills:codebase-design`
skills reach that skill.

Until `CONTEXT.md` exists, the domain words of this project live in `docs/prd.md` and in
`docs/decisions.md`. Read those instead.

## File structure, once the build starts

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-<decision>.md
│       └── 0002-<decision>.md
└── src/
```

`CONTEXT.md` stays at the repo root, because all the skills read it from that path. This is
an agreed exception to the "keep each document in `docs/`" rule in `docs/README.md`.

`docs/adr/` needs no entry in the doc index. ADRs are numbered and they multiply. This
document governs them instead.

## Use the vocabulary of the glossary

When your output names a domain concept (an issue title, a proposal to refactor, a
hypothesis, a test name), use the term as the glossary defines it. Do not change to a
synonym that the glossary tells you to avoid.

If the concept that you need is not yet in the glossary, this is a signal. Either you
invent language that the project does not use (think again), or there is a true gap (record
it for `mattpocock-skills:domain-modeling`).

## Report conflicts with a decision or an ADR

If your output disagrees with an ADR, or with an entry in `docs/decisions.md`, say so
directly. Do not override it silently:

> _Disagrees with P1 (nothing reaches the evidentiary layer without promotion), but it is
> correct to open it again because…_

`docs/decisions.md` is locked. A decision that contradicts an entry must replace that entry
explicitly. It must never work around it.
