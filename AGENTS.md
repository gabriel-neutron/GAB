# Instructions for AI coding agents

Read `CLAUDE.md` first. It holds the rules of this repository, and they apply to each agent.

- Docs map: `docs/README.md`. The code is the source of truth.
- Write each document, code comment, commit and pull request in ASD-STE100 Simplified Technical English.
- Run `pnpm check` before you push. Run `pnpm test:fast` for a test that needs no database.
- The repository is public. Never write a local path, a user name or private data in a file.
- The public site is a static build with an edge worker (`tools/edge/`). Its rules are in `docs/deploy.md`.
