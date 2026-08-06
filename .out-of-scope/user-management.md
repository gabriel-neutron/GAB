# User management

Gabriel has no accounts, no roles, no permissions, and no collaboration features. There is
no authentication at all.

## Why this is out of scope

There is exactly one operator. External contributors produce reports that enter the system
as **sources**, not as users — they never touch the instrument. Multi-project support is
theoretical and mono-project in fact.

Introducing authentication would not just add a login screen. It would add identity to
every write path, ownership to every row, and a permission check to every read — which
means the schema, the API surface, and the review queue all grow a dimension that serves
nobody, since the population of users is one.

This also interacts with publication. Everything Gabriel produces is public, including the
unvalidated candidate layer. There is no private tier to protect and therefore no access
boundary to enforce. Anything requesting roles or sharing controls is asking for a
different product.

## Prior requests

None yet — seeded from `docs/prd.md` §5 at project setup.
