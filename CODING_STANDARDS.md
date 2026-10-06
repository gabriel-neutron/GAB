# Coding standards

The reviewer (`/code-review`, Standards axis) applies these rules to the diff. `pnpm check` already
enforces the lint, the format and the types, so the reviewer does not repeat them. The reviewer
does not block on the wording of a commit, a PR or a comment.

## Modules

- Each file has one job and one main export. A new file with many exports is probably two files.
- Name each export in domain words (`GLOSSARY.md`). The name alone says what the caller gets.
- A module hides its storage, transport, format and retry details. Its interface is smaller than its
  interior.
- One feature is one flat folder. A feature never imports another feature.
- Import each symbol from the file that declares it. A file that only passes on the exports of other
  files has no reason to exist.
- A boundary (a route, a handler, a CLI entry) reads its input, calls one feature function and maps
  the result. It makes no decision. Presentation code shows a result and holds no logic.

## Types

- Validate each value from outside at the edge, before use.
- Make an illegal state impossible to build: use a closed set of cases.
- No cast, no suppression, no escape hatch.

## Simplicity

- Choose the smallest solution that does the job and keeps the audit trail. Add no layer, option or
  check that the spec does not ask for.
- Build from what is installed. A new dependency needs a reason in the pull request.

## Comments

- A comment records a reason the code cannot show: an external constraint, the origin of a number,
  or a departure from the obvious solution (ADR 0006). Delete every other comment.
- A comment in the source code (`src/`, the source of each package) holds no reference: no document
  path, no section, no ticket number. The commit message holds references.
- Delete or correct each comment that the change made false.
