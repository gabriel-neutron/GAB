import io


def edit(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    for old, new, label in pairs:
        assert old in s, "NOT FOUND: " + label
        assert s.count(old) == 1, "AMBIGUOUS: " + label
        s = s.replace(old, new, 1)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
    print("updated " + path)


# ===================================================== ADR 0001 — the "not yet" promise
edit('docs/adr/0001-repository-conventions.md', [
    ("""committed.** It needs a running database, it is measured by the diff and never by the exit code of
the generator, and its comparison is scoped to the generated folders. **It enters `package.json`
with the first migration**, because a step that reads an empty database proves nothing.""",
     """committed.** It needs a running database, it is measured by the diff and never by the exit code of
the generator, and its comparison is scoped to the generated folders. A drift check that reads an
empty database proves nothing, so it is added with the schema it guards.""",
     "ADR 0001 drift promise"),
])

# ===================================================== ADR 0003
edit('docs/adr/0003-schema-pipeline-and-read-contract.md', [
    # §2 — a report of what has been run is not a decision.
    ("""An npm dependency, so no second binary is installed. **It was not run.** If its SQL support does
not match §3, replace the tool and keep §3: the file convention is the decision, and the tool is
the smaller half.""",
     """An npm dependency, so no second binary is installed. If its SQL support does not match §3,
replace the tool and keep §3: the file convention is the decision, and the tool is the smaller
half.""",
     "ADR 0003 not run"),
    # §4 — the same "not yet".
    ("""No baseline dump, and no step applied by hand. `pnpm db:reset` destroys the volume and runs the
three again. **They enter `package.json` with the first migration.**""",
     """No baseline dump, and no step applied by hand. `pnpm db:reset` destroys the volume and runs the
three again. A command that reads an empty database proves nothing, so these arrive with the
schema they apply.""",
     "ADR 0003 commands promise"),
    # §6 — a second copy of the SQL, and it has already split from the file.
    ("""Two lines
in the grants file are the perimeter:

```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA api FROM gabriel_read;
```

It covers every view, including the ones nobody has written yet, and it re-runs on every apply, so
a convenience grant is erased rather than inherited.""",
     """The perimeter is a blanket
revoke, in the grants file, of every write on every table of the read schema, from every role that
is not the owner. **§1 refuses a second copy of the SQL, so this ADR quotes none: read the grants
file.** The revoke covers every view, including the ones nobody has written yet, and it re-runs on
every apply, so a convenience grant is erased rather than inherited.""",
     "ADR 0003 sql copy"),
])

# ===================================================== ADR 0005 — an open ticket by number
edit('docs/adr/0005-map-and-tile-path.md', [
    ("""**#73 holds what must be true before any deployment**: that policy is for casual and low-volume
use, and it is not a tile service for an application.""",
     """**What must be true before any deployment** is this: that policy is for casual and low-volume
use, and it is not a tile service for an application. The tracker carries the work.""",
     "ADR 0005 #73 first"),
    ("""- The map works on the operator's machine only. A public map needs a deployment, which does not
  exist, and **#73 gates it**.""",
     """- The map works on the operator's machine only. A public map needs a deployment, and the tile
  path of §3 must be settled before that deployment. The tracker carries it.""",
     "ADR 0005 #73 second"),
])

# ===================================================== spec.md — three ticket numbers
edit('docs/spec.md', [
    ("""No role writes those tables; a `SECURITY DEFINER` function does. Settled by #15. |""",
     """No role writes those tables; a `SECURITY DEFINER` function does. |""",
     "spec #15"),
    ("""decision signed by a name that nothing proves to be a person is #42, and
`db/apply/90_grants.sql` states that limit in full.""",
     """decision signed by a name that nothing proves to be a person is an open question, and the
tracker carries it. The grants file states that limit in full.""",
     "spec #42 first"),
    ("""**What happens to the rest is an open question — #42.** S3 says the operator intervenes only""",
     """**What happens to the rest is an open question, and the tracker carries it.** S3 says the
operator intervenes only""",
     "spec #42 second"),
])

# ===================================================== docs/README.md — a ticket number and a count
edit('docs/README.md', [
    ("""on 17 August 2026: three of those surfaces are built, so their documents had become a record, and
the repository was carrying too much documentation for a project that is building a user interface.""",
     """on 17 August 2026: a document that describes a surface which is already built is a record and not
an order, and the repository was carrying too much documentation for a project that is building a
user interface.""",
     "README count"),
    ("""The review surface is not built, so its components and its rules were moved to **#58** before the
file was deleted.""",
     """The rules of a surface that is not built moved to the tracker, with the ticket that builds it,
before the file was deleted.""",
     "README #58"),
])

# ===================================================== root README.md
edit('README.md', [
    ("""**Status: build started.** The scoping phase is closed and the specifications below are
settled. The application shell exists: it renders, and it holds no feature. Open decisions
are tracked as issues.""",
     """**Status: build started.** The scoping phase is closed and the specifications below are
settled. Open decisions are tracked as issues.""",
     "root README shell"),
    ("""is shadcn, and the map library is MapLibre. Decisions T7 and T8 deferred the last two; ADR
0004 and ADR 0005 replace them. The build decisions live in the ADR register in""",
     """is shadcn, and the map library is MapLibre. The build decisions live in the ADR register in""",
     "root README changelog"),
])

# ===================================================== decisions.md — T7 and T8 are dead entries
edit('docs/decisions.md', [
    ("| T7 | Frontend framework choice deferred; shadcn is adopted either way | Technical |",
     "| T7 | Frontend framework choice — **replaced by ADR 0004** | Technical |",
     "idx T7"),
    ("| T8 | Cartographic library deferred, but it must be chosen before any rendering code | Technical |",
     "| T8 | Cartographic library — **replaced by ADR 0005** | Technical |",
     "idx T8"),
    ("""### T7 — Frontend framework choice deferred

**Decision.**""",
     """### T7 — Frontend framework choice deferred

**Replaced by ADR 0004**, which chooses the framework. The consequence below is kept.
**Decision.**""",
     "body T7"),
    ("""### T8 — Cartographic library and tile path deferred

**Decision.**""",
     """### T8 — Cartographic library and tile path deferred

**Replaced by ADR 0005**, which chooses the library and the tile path.
**Decision.**""",
     "body T8"),
])
