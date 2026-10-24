# Contributing to Gabriel

Thank you for your help. This guide tells how to report a problem and how to send a change.

## Before you start

- Gabriel is a tool for one analyst. The scope is small on purpose. `docs/prd.md` tells what is in
  scope and what is out.
- Open an issue before a large change. Then we can agree on the scope before you write code.
- For a security problem, do not open a public issue. Read [`SECURITY.md`](SECURITY.md).

## Report a problem

Open an [issue](https://github.com/gabriel-neutron/GAB/issues/new/choose) and choose a template.
Do not put a local path, a token or private data in an issue: the repository is public.

## Send a change

1. Fork the repository and make a branch from `staging`.
2. Install the dependencies: `corepack enable`, then `pnpm install`.
3. Make your change, with a test for new logic.
4. Run `pnpm check` and `pnpm test:fast`. `pnpm test` runs the full suite and needs the stack
   (`infra/README.md`).
5. Open a pull request into `staging`. The `main` branch receives only the releases.

The CI runs the checks on each pull request. A pull request that changes only documents runs no job.

## Style

- **Commits and pull request titles** use Conventional Commits: `type(scope): a lower case
  sentence`. `docs/agents/commit.md` gives the full rule.
- **Text** (documents, comments, commit bodies) uses Simplified Technical English (ASD-STE100):
  short sentences, one instruction in each sentence, the active voice. Plain, short English is
  sufficient for a first pull request. The maintainer can edit the words.
- **Documents** tell the reason and the general view. The code holds the details.
  `docs/authoring.md` gives the rules.

## AI agents

The maintainer works with AI coding agents. Their rules are in `CLAUDE.md`, `.claude/` and
`docs/agents/`. You can use an agent or not. Each change gets the same review.

## Code of conduct

Each contributor follows the [code of conduct](CODE_OF_CONDUCT.md).

## License

You send your contribution under the [MIT License](LICENSE) of the project.
