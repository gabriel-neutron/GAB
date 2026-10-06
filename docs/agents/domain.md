# Domain words

How a skill uses the documentation of this project while it explores the code.

## Where the words live

- **`GLOSSARY.md`**, at the repository root: the glossary. The `domain-modeling` and
  `grill-with-docs` skills write it when a term is settled. If the file is absent, continue and
  report nothing.
- **`docs/prd.md` and `docs/decisions.md`**: the purpose and the product rules. The operator owns
  them.
- **`docs/adr/`**: the build decisions. `docs/README.md` lists them.

## Use the words of the glossary

When your output names a domain concept (an issue title, a test name, a module), use the term that
the glossary defines.

## A conflict with a decision

- **Your change disagrees with an ADR:** the agent owns the ADRs. Decide, update the ADR in the
  same pull request, and say so in the pull request.
- **Your change disagrees with `prd.md` or `decisions.md`:** this is a product rule. Stop and ask
  the operator one short question.
