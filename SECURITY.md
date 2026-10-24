# Security policy

## Report a vulnerability

Do not open a public issue for a security problem.

Use the private report of GitHub: open the **Security** tab of the repository, then **Report a
vulnerability**. Give the steps to reproduce the problem and its effect.

The maintainer answers as soon as possible. When the fix is ready, we publish an advisory, with your name
if you agree.

## Supported versions

Only the last commit on `staging` and the last release get security fixes.

## Scope

The scope includes the code of this repository: the web interface, the writer, the worker, the MCP
server and the database rules. The services that the project uses (OpenRouter, the S3 store, the
search service) are out of scope. Report a problem in them to their owners.
