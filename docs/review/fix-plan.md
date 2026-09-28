# Deep review fix plan

Part of #168. This plan puts the 354 confirmed findings of the eight review files in this folder into fix units, and gives the order to do them in.

## Contents

- [Summary](#summary)
- [Decisions of 26 September 2026](#decisions-of-26-september-2026)
- [How to use this plan](#how-to-use-this-plan)
- [How the plan was made](#how-the-plan-was-made)
- [Waves](#waves)
  - [Wave 1](#wave-1)
  - [Wave 2](#wave-2)
  - [Wave 3](#wave-3)
  - [Wave 4](#wave-4)
  - [Wave 5](#wave-5)
  - [Wave 6](#wave-6)
  - [Wave 7](#wave-7)
  - [Wave 8](#wave-8)
  - [Wave 9](#wave-9)
- [After the operator decisions](#after-the-operator-decisions)
- [Operator decisions](#operator-decisions)
- [Will not fix](#will-not-fix)
- [Already fixed](#already-fixed)
- [Critic changes](#critic-changes)
- [Coverage](#coverage)

## Summary

| Part | Units | Findings | Done at 28 September 2026 |
|---|---|---|---|
| Waves (9) | 125 | 40 major, 108 minor, 56 nit, 27 proposal | 125 / 125 |
| After the operator decisions | 17 | 5 major, 15 minor, 5 nit, 4 proposal | 17 / 17 |
| Operator decisions | 26 | 2 blocker, 33 major, 35 minor, 11 nit, 8 proposal | 19 / 26 |
| Will not fix | 4 | 1 minor, 1 nit, 3 proposal | closed by decision, not by code |
| Already fixed | 146 | see below | — |

## Decisions of 26 September 2026

A requirement debate decided the 26 operator-decision units. **This section overrides the
"Operator decisions" section below.** The debate took the 26 units as one subject, with six
agents, and not as one subject for each unit. The waves below do not yet contain the units that this section adds.

### Deferred to #25

**U-DB-09, U-WRI-09 and U-CON-14 wait for #25**, the first model process or the first agent
caller. At HEAD no process runs a model, and no agent calls `propose_change`. Ask the operator
these three questions when that caller exists.

### Code to build now

| Unit | Decision | Unblocks |
|---|---|---|
| U-CON-01 | Option (b). In `promote_proposal`, a guard compares `v` by jsonb equality, and refuses a dropped source only when `v` does not change. Correct the RAISE text in `db/apply/40_functions.sql` that says #17 is open. Add a db test for each branch. The locked S2 entry is later than #17: the `src` of an attribute backs that one value alone. | U-DET-02, U-CON-20 |
| U-WRK-01 | Option (a). Delete `packages/worker/src/main.ts`, `run-once.ts`, `run-once.test.ts`, and the `worker:layout` and `worker:reconcile` scripts. | U-WRK-07 |
| U-TST-16 | Option (a), small form. A second database, `gabriel_test`, in the same container, for the db tests, `db:load-fixture` and `db:reset`. A guard refuses a test run against `gabriel`. | none |
| U-DB-31 | Option (b). The comments say that #19 decided `rate_document`, and that it is built with the first scoring caller. #19 closed on 6 September 2026. | none |
| U-REV-07 | Option (b). Keep the three S3 routings, correct the "unstated" words, and test each branch. | U-REV-13, U-REV-16 |

### No code change

| Unit | Decision | Unblocks |
|---|---|---|
| U-WRK-02 | Option (b). The job lifecycle goes to the P6 runner (#134). When U-WRK-01 removes the dispatch, no job is claimed. | removes its gate on U-DB-29, U-DB-33 |
| U-DB-43 | Option (b). Keep the ordered migrations. Each new migration gets its number in merge order. | U-DB-34; with U-WRK-02 and U-DB-24: U-DB-29, U-DB-33 |
| U-TST-35 | Option (b). Keep `proposals_src_within`: it is the only check that a source exists (spec §2, invariant 3). | U-TST-20, U-XC-11, U-DB-23 (after the S2 amendment) |
| U-DB-40 | Option (b). Keep `merge_entities`: P2 lists it. The ELSE guard refuses it at promotion. | U-REV-23, U-DB-22 |
| U-DB-41 | Option (b). Keep `update_relation`: P4 freezes the op vocabulary. U-DB-04 binds it to `target_kind`. | U-DET-05 |
| U-CON-05 | Option (b). `''` and `[]` are known values. M9 speaks only of null, and M11 makes the shape the whole rule. | none |
| U-DB-42, U-DB-28 | Option (b). No change. | none |
| U-DB-39 | Option (a). No change. | none |

### Document amendments for the operator

The operator owns `docs/`. Write these in one sitting:

| Unit | Amendment | Unblocks |
|---|---|---|
| U-TST-35 | S2: new words for the source list of a created row. | U-TST-20, U-XC-11, U-DB-23 |
| U-DB-27 | ADR 0002 §7 names `s3:ListBucket` on `raw`. | U-WRK-04, U-DB-11 |
| U-DB-24 | ADR 0003 §6 takes the text that #95 decided. | U-DB-33, with U-WRK-02 and U-DB-43 |
| U-DB-26 | ADR 0003 §7 names the agent doors. Remove the claim that the operator secret stays out of the worker: every process loads `infra/.env`. | none |
| U-TST-32 | ADR 0006 §5 and §6 name `packages/*/src` and `.storybook`. | U-TST-28 |
| U-TST-27 | ADR 0004 §8 names `.claude/workflows/` as an exemption, with its reason. | none |
| U-TST-16 | ADR 0002 and ADR 0003 §5 name `gabriel_test`. | none |
| U-DB-25, U-DB-30, U-DB-36, U-WRK-10 | The ADR text records the code as built. | none |

### Costs accepted

- Until #25, any local process can sign as `manual`. C5 already accepts this.
- After an operator correction, an agent document stays only in `prior_value`.
- `gabriel_test` can drift from the applied schema.
- The row-level source list of a created row names documents that back only an attribute.
- `merge_entities` and `update_relation` stay in the vocabulary with no use.
- The three S3 routing branches get tests, but no data reaches them before a calibrated threshold exists.
- The database accepts a blank string that the detail page refuses.
- Until #25, the P4 "votes" text and the spec §5 "dissent = true" text stay in conflict.
- Until the P6 runner exists, the T9a sentence "lease expiry requeues it" has no caller.
- Thirteen or more migration files stay.
- An agent merge stays pending until the operator rejects it.

## How to use this plan

- Do the waves in order. Do not start a wave before the previous wave is merged.
- The units in one wave touch different files, so they can be done in parallel.
- One unit is one commit. The commit closes every finding the unit lists, and it adds the proof test.
- Line numbers in the review files were correct at the review. A fix moves code, so find the code by its symbol.
- A unit in "After the operator decisions" waits until the operator decides the units it names.

## How the plan was made

1. A script read the eight review files and gave each finding an ID: layer, dimension, number (for example `DB-COR-01` is the first correctness finding of the database file).
2. One agent for each layer grouped its findings into fix units by root cause. A test finding went into the unit of the code it tests.
3. One agent merged the units of different layers that one change closes.
4. One agent gave the "must come before" edges, with these rules: data integrity and the write path first; schema, then contracts, then writer and worker, then frontend, then tooling; a change that removes or moves code before the fixes of that code.
5. The script sorted the edges into waves. Blockers and majors go first among the units that are ready. Two units that touch one file are never in the same wave. A cycle in the edges merged its units into one.
6. One critic agent looked for fixes that add a defect, missed duplicates and order errors. The script applied its changes and built the waves again.
7. The script checked that each finding is in exactly one unit.

## Waves

### Wave 1

#### U-DB-04: A CHECK binds op to target_kind for delete_entity, delete_relation and update_relation

- Root cause: No constraint binds op to target_kind except for update_entity, and promote_proposal chooses the table from target_kind only. An agent can queue 'delete_relation' on an entity and a promotion deletes the entity.
- Closes: DB-COR-02 (major), DB-SIM-02 (major), DB-SEC-02 (minor)
- Change: schema, size S
- Files: `db/migrations/0014_op_binds_target_kind.sql`, `tools/op-target-kind.db-test.ts`
- Symbols: proposals, proposals_op_target_kind
- Regression risk: The migration fails on a database that already holds a mismatched row, and a fixture loader row with a wrong kind is refused.
- Proof test: tools/op-target-kind.db-test.ts: propose_change('delete_relation', '{}', ARRAY[doc], 'entity', id) and propose_change('delete_entity', ..., 'relation', id) and update_relation on an entity each raise 23514 with constraint proposals_op_target_kind; the pairs the writer sends still pass.

#### U-DB-12: The update_entity test shows that the row-level sources list is replaced

- Root cause: The test cites ['manual'] before and after the rename, so it cannot see whether promote_proposal replaces the list.
- Closes: DB-TST-01 (major)
- Change: test, size S
- Files: `packages/writer/src/writer.db-test.ts`
- Symbols: promote_proposal
- Regression risk: None beyond the test itself.
- Proof test: writer.db-test.ts: create the entity with a document source, rename it through the writer, assert sources = ['manual'] and prior_value.sources = the old list; the test fails if 'sources = p.src' is removed.

#### U-DB-13: Database tests prove that proposals_append_only_fn refuses each forbidden gesture

- Root cause: No test sends a DELETE, a return to pending, a frozen-column edit or an edit of a decided row to public.proposals.
- Closes: DB-TST-02 (major)
- Change: test, size S
- Files: `tools/append-only.db-test.ts`
- Symbols: proposals_append_only_fn, proposals_append_only
- Regression risk: None beyond the test itself.
- Proof test: tools/append-only.db-test.ts: four rollback-wrapped superuser gestures each raise their own message.

#### U-DB-15: Database tests make the M4 endpoint guards refuse

- Root cause: The writer checks endpoints before it proposes, so check_relation_endpoints and the delete-branch endpoint refusals are never reached by a test.
- Closes: DB-TST-06 (major)
- Change: test, size S
- Files: `tools/relation-endpoints.db-test.ts`
- Symbols: check_relation_endpoints, promote_proposal
- Regression risk: None beyond the test itself.
- Proof test: tools/relation-endpoints.db-test.ts: an INSERT with a random src_id raises 23503; a delete_entity promoted on a live endpoint raises 'is an endpoint of a relation'; same for a relation endpoint.

#### U-DB-16: A database test checks the api.neighbourhood walk

- Root cause: The only test asserts one row, which the root at hop 0 always gives.
- Closes: DB-TST-07 (major)
- Change: test, size S
- Files: `tools/neighbourhood.db-test.ts`
- Symbols: api.neighbourhood
- Regression risk: None beyond the test itself.
- Proof test: tools/neighbourhood.db-test.ts: a small graph with a relation-to-relation edge; assert the exact (entity_id, hop) set for depth 1 and 2, min hop, and no relation id.

#### U-DET-01: A note claim is edited and read in a multi-line textarea, so its line breaks stay

- Root cause: WritingField and ReadOnlyField draw the 'note' control as a single-line <input type=text>, and the browser removes LF and CR from its value, so one keystroke saves the note without its line breaks.
- Closes: DET-COR-01 (major)
- Change: frontend, size S
- Files: `src/features/detail/field.tsx`, `src/features/detail/field.stories.tsx`, `src/shared/ui/textarea.tsx`
- Symbols: WritingField, ReadOnlyField, Field
- Regression risk: The width rule (widthOf) and the disabled reading style can draw the textarea at a different size from the other controls.
- Proof test: field.stories.tsx: a stored note 'Line one\nLine two' in the writing arm; type one character; assert the draft text is 'Line one\nLine two!' and the reading arm shows the two lines.

#### U-DET-08: A pending candidate line states its origin next to its score

- Root cause: The PendingLine mapper drops proposal.authorRole, so an agent act and an unsigned operator act draw as the same 'candidate' line and PU1's 'with origin and score' is not met.
- Closes: DET-SIM-04 (major), DET-ARC-03 (minor)
- Change: frontend, size S
- Files: `src/features/detail/dossier.ts`, `src/features/detail/pending.tsx`, `src/features/detail/pending.stories.tsx`
- Symbols: PendingLine, readDossier, Pending
- Regression risk: The added word can widen the pending line in the 24 rem sidebar and break its layout.
- Proof test: pending.stories.tsx: a gabriel_agent line and a gabriel_app line show two different origin words beside 'candidate'.

#### U-DET-16: The page stories assert the address and the body of each act that the page sends

- Root cause: The fetch stub records only that a call occurs and answers SIGNED to every request, so a wrong target, address or body passes every page story.
- Closes: DET-TST-01 (major)
- Change: test, size S
- Files: `src/features/detail/detail-page.stories.tsx`
- Symbols: doorGiving, doorAnswering
- Regression risk: None: the change is in stories only.
- Proof test: TwoClicksOnOneChangeWriteOneAct, AListTakesACommaWithNoSpace, ARefusedDeletionNamesTheCount and AnUndecidedRelationDeletionSaysTheRelationStands assert the URL and JSON.parse(init.body); changing the relation delete to targetId: dossier.entityId fails them.
- Critic: The stories pin request addresses and bodies with a stub that answers SIGNED. U-WRI-02 and U-DET-19 later change the reply shape that door.ts reads. Build the stub answer from one helper, so that those units change one place.

#### U-REV-02: A deletion card always shows the documents that the deletion act cites

- Root cause: change-card.tsx shows change.sources only when change.rows is empty, but the rows of a deletion carry the sources of the destroyed values, not the sources of the act.
- Closes: REV-COR-03 (major)
- Change: frontend, size S
- Files: `src/features/review/change-card.tsx`, `src/features/review/change-card.stories.tsx`
- Symbols: ChangeCard, actSources
- Regression risk: An update card could start to show the act sources twice if the new condition is not limited to the delete kind.
- Proof test: change-card.stories.tsx ADeletionNamesTheRowItDestroys asserts that the badge of doc_9b0417 (D4) appears under 'The documents this act stands on' for the sample deletion act aa000001-...-0003.

#### U-REV-10: Move the decision state machine of the review route into a pure function in features/review and test it

- Root cause: onAct in src/routes/review.tsx holds the rules (block a second verdict, hold a verdict only when decided, refresh after a refusal, skip the refresh after a hold) and no test renders the route.
- Closes: REV-TST-02 (major)
- Change: refactor, size M, removes or moves code
- Files: `src/routes/review.tsx`, `src/features/review/verdict-flow.ts`, `src/features/review/verdict-flow.test.ts`
- Symbols: ReviewRoute, onAct, validateSearch, forgetTheSentence
- Regression risk: The move can change the order of setVerdicts and refreshCorpus, which the route depends on.
- Proof test: verdict-flow.test.ts: a 'refused' outcome for 'promoted' does not add a verdict and asks for a refresh; a 'deferred' verdict adds a verdict and asks for no refresh; a second verdict while 'deciding' is ignored.
- Critic: The pure verdict-flow function is written before U-WRI-02 adds a doubt/unknown outcome to WriteOutcome. Make the switch on the outcome exhaustive (a never check), so that tsc shows the missing branch when WRI-02 and DET-19 change the type. Also keep the order of setVerdicts and refreshCorpus.

#### U-REV-11: A review-page story asserts that a verdict names the focused act

- Root cause: review-page.stories.tsx declares onAct = fn() and never asserts a call, so the join of a verdict to current.id is untested.
- Closes: REV-TST-03 (major)
- Change: test, size S
- Files: `src/features/review/review-page.stories.tsx`
- Symbols: ReviewPage
- Regression risk: The story depends on the sample subject having two or more acts.
- Proof test: New story: focus the second line of the node pane, click Promote and 'Promote it', and assert onAct was called with { kind: 'decide', changeId: <second id>, verdict: 'promoted', reason: '' }.

#### U-TST-01: Arm 6 sees a NULL function ACL, and the function default privilege really revokes EXECUTE from PUBLIC

- Root cause: DEFINER_DOORS reads aclexplode(p.proacl), and aclexplode(NULL) gives no row, so a definer function with the built-in default ACL (EXECUTE to PUBLIC) is invisible. The per-schema ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC in migration 0001 cannot remove the global default, so new functions really get a NULL ACL, and no arm checks the function default privilege.
- Closes: TST-COR-01 (major), TST-TST-11 (minor)
- Change: schema, size S
- Files: `tools/perimeter/audit-arm.db-test.ts`, `db/migrations/0014_revoke_function_execute_from_public.sql`, `db/apply/90_grants.sql`
- Symbols: DEFINER_DOORS, ARMS, THE_DOOR_SET
- Regression risk: A function in public or api that today has a NULL ACL and is SECURITY DEFINER shows as 'to PUBLIC' and makes arm 6 fail until 90_grants.sql revokes it; the global default revoke can also remove EXECUTE from a future non-definer helper that a role calls without an explicit grant.
- Proof test: tools/perimeter/audit-arm.db-test.ts: in a rolled-back transaction, SET ROLE gabriel_owner and CREATE a SECURITY DEFINER function with SET search_path and no REVOKE; the DEFINER_DOORS query must return a 'to PUBLIC' row (it returns none before the fix). The new function default-ACL arm fails before the migration (pg_default_acl empty) and passes after it.
- Critic: There is a conflict with the recorded reason in 0001_extensions_and_roles.sql:30-33 and 90_grants.sql:25-28. Those comments refuse a blanket function revoke because it removes EXECUTE from every PostGIS function and stops the map read. A global ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC for gabriel_owner applies to every function that role creates in every schema, and that includes a later extension that it creates (pgvector, see U-DB-25). Also, PostgreSQL checks EXECUTE on a function called inside a view against the user that queries the view. So a non-definer helper that an api view or a CHECK calls can fail for gabriel_read or gabriel_agent. Before this unit merges, run the full live suite and a map read as each login role.

#### U-CON-06: The model client never waits longer than a caller-given bound, and the Retry-After date and negative paths are tested

- Root cause: maxWaitMs is optional (client.ts:37), so waitOf (client.ts:231-233) falls back to LONGEST_WAIT_MS (about 24.8 days), which is longer than the job claim lease of 900 s. afterOf's date branch and negative guard have no test.
- Closes: CON-COR-06 (minor), CON-TST-06 (minor)
- Change: service, size S
- Files: `packages/model/src/client.ts`, `packages/model/src/client.test.ts`
- Symbols: settings, AgentModel.maxWaitMs, waitOf, afterOf, LONGEST_WAIT_MS
- Regression risk: A future caller that omits maxWaitMs fails to parse its settings after the fix.
- Proof test: client.test.ts: settings without maxWaitMs are refused; a 429 with retry-after 3600 and maxWaitMs 5 waits 5 ms; a fake-timer test with an HTTP date 2 s ahead waits about 2000 ms; retry-after '-5' uses the growing wait.

#### U-CON-08: The @gab/proposal exports map loses its dead entries: ./vocabulary and the unused root index

- Root cause: packages/proposal/package.json exports ./vocabulary to a file that commit cee6200 deleted, and . to src/index.ts, whose PROPOSAL_STATUS and ProposalStatus have no importer and whose comment states a false fact.
- Closes: CON-ARC-02 (minor), CON-ARC-06 (proposal), CON-COR-08 (nit), CON-SIM-06 (proposal), CON-SIM-07 (proposal)
- Change: refactor, size S, removes or moves code
- Files: `packages/proposal/package.json`, `packages/proposal/src/index.ts`
- Symbols: exports map, PROPOSAL_STATUS, ProposalStatus
- Regression risk: A tool or import that reads the bare '@gab/proposal' entry fails to resolve after the root export is removed.
- Proof test: pnpm typecheck and the full offline suite pass; a grep for '@gab/proposal' without a subpath and for 'proposal/vocabulary' finds nothing.

#### U-DB-05: A CHECK refuses a create_entity or create_relation payload that no promotion can apply

- Root cause: The database has no shape rule for the two create ops, so an unknown key is dropped in silence at promotion and a bad label, uuid or date raises only at promotion.
- Closes: DB-COR-04 (minor), DB-SIM-05 (minor)
- Change: schema, size M
- Files: `db/migrations/0015_create_payload_shape.sql`, `tools/create-payload-shape.db-test.ts`
- Symbols: proposals, proposals_create_entity_shape, proposals_create_relation_shape
- Regression risk: A key list that is too narrow refuses a payload the writer or the fixture loader sends today.
- Proof test: tools/create-payload-shape.db-test.ts: a create_entity with no label, with a blank label or with a 'geometry' key, and a create_relation with src_id 'x' or valid_from '2024-13-01', each raise 23514 at propose_change; the payloads of payload.ts and db-load-fixture.ts still pass.
- Critic: The key lists must accept every key that proposalAct (packages/proposal/src/payload.ts) and tools/db-load-fixture.ts send today. This includes geom for create_entity (0012) and src_kind, dst_kind, valid_from, valid_to and attrs for create_relation. U-REV-01 shows that the review reads only part of these keys, so do not take the key list from the read model. Run db:load-fixture against the CHECK before the unit merges.

#### U-DB-07: api.job publishes failure_reason and finished_at

- Root cause: The view was written before fail_job existed and selects no end-state column, so the read surface shows a failed job with no reason.
- Closes: DB-ARC-13 (minor), DB-COR-05 (minor)
- Change: contract, size S
- Files: `db/apply/20_views.sql`, `src/contract/api/Job.ts`, `tools/service/job-view.db-test.ts`
- Symbols: api.job, Job
- Regression risk: The regenerated Job contract type gains two columns, and a strict parser of api.job rows must accept them.
- Proof test: tools/service/job-view.db-test.ts: inside a rollback, claim and fail a job, then read api.job as gabriel_read and assert failure_reason and finished_at.
- Critic: U-DB-42 (operator decision) can drop jobs.failure_kind and the failure-count columns. Publish only failure_reason and finished_at in api.job. Do not publish a column that DB-42 can drop, because this view is part of the read contract. Also regenerate src/contract/api/Job.ts and run the drift check.

#### U-DB-08: set_entity_layout refuses a NULL or non-array layout, with database tests of the door

- Root cause: The door has no guard and no test against the database: a SQL NULL deletes every position and commits, and the replace, rollback and finite rules are never run.
- Closes: DB-TST-08 (minor), DB-COR-06 (nit)
- Change: service, size S
- Files: `db/apply/40_functions.sql`, `packages/worker/src/layout.db-test.ts`
- Symbols: set_entity_layout, entity_layout_finite, entity_layout_entity_fkey
- Regression risk: A guard that refuses '[]' would stop the valid run that empties the layout.
- Proof test: packages/worker/src/layout.db-test.ts: set_entity_layout(NULL) raises and leaves rows; a second run replaces the first; an unknown id rolls back the whole set; NaN and infinity x raise entity_layout_finite; '[]' empties the table.

#### U-DB-10: The store policy test sends a policy that grants nothing

- Root cause: object.db-test.ts sends an anonymous-read policy to the real 'raw' bucket to prove a refusal, so a permission regression opens the bucket and nothing restores it.
- Closes: DB-SEC-04 (minor)
- Change: test, size S
- Files: `packages/store/src/object.db-test.ts`
- Symbols: OPEN_TO_ALL
- Regression risk: A Deny policy that is accepted by mistake could block the application account until a reset.
- Proof test: The existing PutBucketPolicy refusal test still expects DENIED, and a review of the sent policy shows no Allow statement.

#### U-DB-18: Database tests for rel_dates_scope and rel_dates_order

- Root cause: No test names either M6 CHECK.
- Closes: DB-TST-12 (minor)
- Change: test, size S
- Files: `tools/relation-dates.db-test.ts`
- Symbols: rel_dates_scope, rel_dates_order
- Regression risk: None beyond the test itself.
- Proof test: tools/relation-dates.db-test.ts: 'berthed_at' with valid_from and 'owns' with from > to each raise 23514 with the constraint name.

#### U-DB-19: A database test promotes an update on a relation

- Root cause: Every promoted update in the tests targets an entity, so the relation arm of the update branch never runs.
- Closes: DB-TST-14 (minor)
- Change: test, size S
- Files: `tools/relation-update.db-test.ts`
- Symbols: promote_proposal
- Regression risk: If U-DB-04 lands first, the test must use a pair that the new CHECK accepts (update_attrs with target_kind 'relation').
- Proof test: tools/relation-update.db-test.ts: promote update_attrs on a relation and assert merged attrs and prior_value.

#### U-DB-20: Database tests assert the grouped rows of api.key_usage and api.value_support

- Root cause: The views are tested only for 'returns rows' and for column shape.
- Closes: DB-TST-15 (minor)
- Change: test, size S
- Files: `tools/service/key-usage.db-test.ts`
- Symbols: api.key_usage, api.value_support
- Regression risk: None beyond the test itself.
- Proof test: tools/service/key-usage.db-test.ts: one entity key and one relation key give the exact grouped rows; the row-level value_support branch gives its row.

#### U-DET-18: A sidebar story swaps the dossier and pins the key on EntityRecord

- Root cause: Every sidebar story mounts one static dossier, so removing key={dossier.entityId} leaves the previous values in the defaultValue controls and no test fails.
- Closes: DET-TST-06 (minor)
- Change: test, size S
- Files: `src/features/detail/sidebar.stories.tsx`
- Symbols: Sidebar, EntityRecord
- Regression risk: None: the change is in stories only.
- Proof test: A story with two dossiers in state and a swap button asserts a field shows the second entity's value; removing the key fails it.

#### U-DET-21: The mark.tsx comments say that the score stands on the rail card only, and the accessible name holds the document only

- Root cause: The file header and the SourceMark comment say that the score reaches the reader through the accessible name, but by design the name carries no score.
- Closes: DET-ARC-04 (minor), XC-SIM-05 (nit)
- Change: docs, size S
- Files: `src/features/detail/mark.tsx`
- Symbols: SourceMark
- Regression risk: None: comments only. None at runtime.
- Proof test: None: comment-only; TheNameOfAMarkCarriesNoScore keeps passing. A grep of mark.tsx finds no comment that says the score is in the accessible name.
- Merged from U-XC-19: merge: The same comment lines in mark.tsx, for the same reason.

#### U-REV-14: Stories confirm a rejection and press Undo

- Root cause: decide.stories.tsx asserts only the promotion confirm and never clicks 'Reject it' or Undo.
- Closes: REV-TST-08 (minor)
- Change: test, size S
- Files: `src/features/review/decide.stories.tsx`
- Symbols: Decide
- Regression risk: None beyond story maintenance.
- Proof test: New stories: click Reject then 'Reject it' and assert onDecide('rejected',''); render a deferred decision, click Undo and assert onUndo was called once.

#### U-REV-15: The rating test isolates the letter rule and both band boundaries

- Root cause: rating.test.ts checks the letter rule with D4, which is also poor by its figure, and has no 'C3 is not poor' case.
- Closes: REV-TST-09 (minor)
- Change: test, size S
- Files: `src/shared/read/rating.test.ts`
- Symbols: readRating
- Regression risk: None.
- Proof test: Add 'D1' poor (letter alone) and 'C3' not poor; they fail when the letter clause is deleted or when the figure rule becomes digit >= 3.

#### U-REV-17: Test that the review workspace patches and never replaces

- Root cause: patchSort and patchOpenRecord share one storage key, and no test covers the patch rule or the read fallbacks.
- Closes: REV-TST-11 (minor)
- Change: test, size S
- Files: `src/features/review/workspace.test.ts`
- Symbols: patchSort, patchOpenRecord, readSort, readOpenRecord
- Regression risk: A window.localStorage stub that leaks between tests.
- Proof test: workspace.test.ts: patchSort('name') then patchOpenRecord(false) keeps both values; a stored { sort: 'bogus' } reads 'confidence'. It fails when patch becomes writeWorkspace(FEATURE, part).

#### U-REV-18: The contract test covers the layout view, and map.test covers toDomain.placement

- Root cause: VIEWS in contract.db-test.ts leaves out 'layout', and no test calls toDomain.placement.
- Closes: REV-TST-12 (minor)
- Change: test, size S
- Files: `src/shared/read/contract.db-test.ts`, `src/shared/read/map.test.ts`
- Symbols: VIEWS, toDomain.placement
- Regression risk: The refusal case must break entity_id, because x and y can be null.
- Proof test: map.test.ts: placement with x null gives position null; contract.db-test.ts parses api.layout rows. It fails when placement becomes { x: x ?? 0, y: y ?? 0 }.

#### U-REV-27: The card of a name or type change says that the new sources replace the list for name, type and location

- Root cause: columnsDifference shows the row-level sources only beside the named column, but promote_proposal replaces the whole row list, which also backs geom (S2).
- Closes: REV-SIM-05 (minor)
- Change: frontend, size S
- Files: `src/features/review/queue.ts`, `src/features/review/queue.test.ts`, `src/features/review/difference.tsx`, `src/features/review/difference.stories.tsx`
- Symbols: columnsDifference, Change
- Regression risk: The extra line can show when the source lists are equal if the comparison is wrong.
- Proof test: queue.test.ts: an update_entity label-only act citing doc_new on an entity backed by doc_geo gives a line for the sources of the name, type and location, before [doc_geo] and after [doc_new]; equal lists give no line.

#### U-TST-10: The ticket-number shape accepts a three-digit hex colour made of digits

- Root cause: The negative lookahead in the ticket shape excludes only a six-hex run, so #999, #000 and #333 are refused as ticket numbers although the comment and ADR 0006 §6 say a hex colour is not a ticket; the ADR text still describes the old 'one to three digits' method.
- Closes: TST-COR-07 (minor), TST-ARC-05 (nit)
- Change: tooling, size S
- Files: `eslint.config.ts`, `docs/adr/0006-a-comment-records-a-reason.md`
- Symbols: SHAPES
- Regression risk: A three-digit ticket number (for example #123) then passes lint, because it has the same shape as a digit-only short colour.
- Proof test: A unit test on SHAPES[0] (or a lint of a fixture comment): '#999' and '#000' do not match after the fix and match before it; '#1234' and '# 12' still match.

#### U-TST-12: Delete tools/code-identity.ts and codeOf, the one-time sweep net that has no caller and false passes

- Root cause: code-identity.ts takes its file list from `git diff --name-only` (no untracked files; git show throws on an added or renamed path), and codeOf drops a whole line that starts with a comment, so the net can report IDENTICAL on changed code. No script, hook or doc calls it; it served one finished comment sweep.
- Closes: TST-COR-09 (minor), TST-SEC-06 (minor), TST-TST-13 (minor), TST-SIM-06 (proposal)
- Change: refactor, size S, removes or moves code
- Files: `tools/code-identity.ts`, `tools/comment-budget.ts`
- Symbols: codeOf, code-identity main
- Regression risk: A future comment sweep has no automatic no-code-moved proof until the tool is restored from git history.
- Proof test: `git grep -e codeOf -e code-identity` returns nothing after the fix; `pnpm check` and `pnpm lint` stay green (comment budget rule still uses measure).

#### U-TST-17: db:reset refuses to destroy a stack that holds real data unless the operator gives an explicit flag

- Root cause: resetFromZero runs `compose down -v` on the only compose project with no check, which removes gab-db-data and gab-minio-data (the real record and the raw evidence bucket). It also waits for the database twice.
- Closes: TST-SEC-05 (minor), TST-SIM-11 (nit)
- Change: tooling, size S
- Files: `tools/db-reset.ts`
- Symbols: resetFromZero
- Regression risk: The probe must tolerate a stack that is down or a database that does not exist yet, or db:reset can no longer rebuild a broken stack.
- Proof test: A test of the guard function in tools/ (offline, with an injected row count): it refuses when a v1_id row exists and no flag is given, and allows the reset with the flag or on an empty record; before the fix no guard exists.

#### U-TST-19: One offline Node project with wide include globs, built by one helper

- Root cause: The offline projects list folders by hand with .ts-only globs, so a test file in src/routes, src/shared/vocabulary, packages/writer/src, packages/store/src, tools/corpus or any .test.tsx matches no project and never runs; fourteen project literals repeat one Node shape.
- Closes: TST-TST-03 (minor), TST-SIM-08 (proposal)
- Change: tooling, size M, removes or moves code
- Files: `vitest.config.ts`
- Symbols: projects, nodeProject, writerProject, workerProject, storeProject, schemaProject, perimeterProject, corpusProject, serviceProject, contractProject
- Regression risk: A .test.tsx that needs a DOM environment would now run under node and fail; a wide glob could also pick up a .test.ts under a folder meant for another project.
- Proof test: Add a trivial packages/writer/src/orphan.test.ts: `pnpm test` with OFFLINE=1 collects it after the fix and does not collect it before; the count of offline tests is otherwise the same.

#### U-WRI-08: Limit the size of the request body on /write/* before the writer reads it

- Root cause: Each door reads the whole body with context.req.text() and JSON.parse, and nothing compares its size with a limit, so one large POST can exhaust the heap and stop the writer.
- Closes: WRI-SEC-02 (minor)
- Change: service, size S
- Files: `packages/writer/src/routes.ts`, `packages/writer/src/admission.db-test.ts`
- Symbols: writeRoutes
- Regression risk: A limit that is too low refuses a real act with a large geometry (for example a MultiPolygon).
- Proof test: admission.db-test.ts: a POST of limit+1 bytes of JSON to /write/create-entity expects 413 before any database read; a normal body still gets its usual answer.

#### U-WRK-03: The layout reads are ordered, so one corpus gives one picture, and a test reads the runLayout write to set_entity_layout

- Root cause: layout-job.ts reads with no ORDER BY, and no test asserts the write call or its payload.
- Closes: WRK-COR-05 (minor), WRK-TST-03 (minor), XC-TST-06 (minor)
- Change: service, size S
- Files: `packages/worker/src/layout-job.ts`, `packages/worker/src/layout-job.test.ts`
- Symbols: runLayout, ENTITIES, LINKS, WRITE
- Regression risk: The stored positions change once after the fix, because the input order changes. No logic changes. None at runtime. The expected coordinates must be what entityLayout really gives for one node.
- Proof test: New packages/worker/src/layout-job.test.ts: a strict fake queryable that throws on a call it did not script. Assert that the entities read contains 'ORDER BY id' and the links read contains 'ORDER BY src_id, dst_id'. Assert that the fourth call is set_entity_layout($1::jsonb), with a JSON array of {id,x,y} that holds every entity. Rows given in two different orders, with the SQL order applied, give the same positions. The new test asserts that the last call is 'SELECT public.set_entity_layout($1::jsonb)' with a payload that holds the entity id. It fails if the write is removed or sends [].
- Merged from U-XC-05: merge: U-XC-05 is the same missing test of the runLayout write (WRK-TST-03) in layout-job.test.ts.

#### U-WRK-05: The packing test checks that the component discs do not overlap

- Root cause: layout.test.ts checks only that no two entities share an exact coordinate. It does not check the isFree bound or the resumed ring scan in packedCentres.
- Closes: WRK-TST-07 (minor)
- Change: test, size S
- Files: `packages/worker/src/layout.test.ts`
- Symbols: entityLayout, packedCentres, isFree
- Regression risk: A test-only change. The only risk is a test that is too strict for float tolerance.
- Proof test: Use 30 lone ids and 5 linked pairs. For each pair of entities in different components, assert that the distance is greater than SPACING / 2. The test fails if isFree drops radius + radii[index] from its bound.

#### U-XC-15: Remove the word 'immutable' for raw files, as T3 requires

- Root cause: T3 withdrew 'immutable' as measured false, but README.md, ADR 0002 line 6 and docs/spec.md still use it.
- Closes: XC-ARC-03 (minor), XC-SIM-03 (minor), XC-COR-08 (nit), XC-SEC-04 (nit)
- Change: docs, size S
- Files: `README.md`, `docs/adr/0002-local-runtime.md`, `docs/spec.md`
- Symbols: T3 wording
- Regression risk: None at runtime.
- Proof test: A grep for 'immutable' in README.md, docs/spec.md and docs/adr/0002-local-runtime.md finds no match.

#### U-CON-13: writeRequest and attributeEdit become module constants

- Root cause: Commit 125492b removed the vocabulary parameter but kept the factory shape, so each POST builds the whole schema again.
- Closes: CON-SIM-05 (proposal)
- Change: refactor, size S, removes or moves code
- Files: `packages/proposal/src/request.ts`, `packages/proposal/src/attribute-value.ts`, `packages/proposal/src/request.test.ts`, `packages/proposal/src/attribute-value.test.ts`, `packages/writer/src/sign.ts`
- Symbols: writeRequest, attributeEdit, WriteRequest
- Regression risk: Every call site that calls writeRequest() or attributeEdit() breaks at type check if one is missed, and it conflicts textually with the other request.ts and attribute-value.ts units.
- Proof test: pnpm typecheck and the proposal and writer suites pass with writeRequest.safeParse and z.infer<typeof writeRequest>.

#### U-DET-12: A second click on the active source mark scrolls its card back into view

- Root cause: The rail scrolls in an effect keyed on activeSource only, so a click that sets the same id changes no state and the effect does not run.
- Closes: DET-COR-11 (nit)
- Change: frontend, size S
- Files: `src/features/detail/rail.tsx`, `src/features/detail/detail-page.tsx`, `src/features/detail/rail.stories.tsx`
- Symbols: Rail, DetailPage, activeSource, onSelectSource
- Regression risk: The rail can scroll on each re-render if the counter changes on a render that is not a click.
- Proof test: rail.stories.tsx: select source 3, scroll the rail away, select source 3 again, assert scrollIntoView is called a second time.

#### U-DET-14: The rename-draft test names its refusal reason and covers the name-only branch

- Root cause: The padded-name test asserts ready === false only, and no test builds a draft with a new name and the same type.
- Closes: DET-TST-12 (nit)
- Change: test, size S
- Files: `src/features/detail/rename-draft.test.ts`
- Symbols: readRenameDraft, renameWords
- Regression risk: None: the change is in a test only.
- Proof test: rename-draft.test.ts asserts toStrictEqual({ ready: false, reason: NO_CHANGE }) for the padded name, and 'Ready to save a new name.' for a name-only change; a mutation that returns NO_NAME fails it.

#### U-DET-20: entityHref and surfaceHref get a unit test of their encoding

- Root cause: Every href assertion uses a UUID or a plain id, so removing encodeURIComponent passes every test.
- Closes: DET-TST-14 (nit)
- Change: test, size S
- Files: `src/features/detail/address.test.ts`
- Symbols: entityHref, surfaceHref
- Regression risk: None: a new test only.
- Proof test: address.test.ts: entityHref('a&b#c d', 'x?y') gives '/entity/a%26b%23c%20d?src=x%3Fy'; removing encodeURIComponent fails it.

#### U-DET-25: The relations.tsx header states M6 as dossier.ts states it

- Root cause: The header calls the retrieval date one end of the relation interval.
- Closes: DET-ARC-09 (nit)
- Change: docs, size S
- Files: `src/features/detail/relations.tsx`
- Symbols: Relations
- Regression risk: None: comments only.
- Proof test: None: comment-only.

#### U-DET-27: RecordCell loses editable, and EntityRecord chooses the Field arm from its mode

- Root cause: recordCells sets editable: drafts !== null, which always equals the page's writing mode, so EntityRecord tests writing twice.
- Closes: DET-SIM-09 (proposal)
- Change: refactor, size S, removes or moves code
- Files: `src/features/detail/draft.ts`, `src/features/detail/record.tsx`, `src/features/detail/record.stories.tsx`
- Symbols: RecordCell, recordCells, EntityRecord
- Regression risk: A caller that passes drafts with mode 'reading' keeps rendering reading, so the risk is only a missed call site at compile time.
- Proof test: None: behaviour-preserving; record.stories.tsx reading and writing stories pass.

#### U-REV-06: A failed earlier read no longer clears the promise of a later read in readOnce

- Root cause: The catch handler in readOnce sets reading = null without a check that reading still holds its own promise, so after forget() a late failure erases the next read.
- Closes: REV-COR-07 (nit)
- Change: service, size S
- Files: `src/shared/read/once.ts`, `src/shared/read/once.test.ts`
- Symbols: readOnce
- Regression risk: A wrong guard could keep a rejected promise in memory, so every later load gets the first failure.
- Proof test: New once.test.ts: start read 1, forget(), load() starts read 2, reject read 1, then load() returns the read 2 promise and the read function was called two times, not three.

#### U-REV-20: The change-mark story checks the paint or glyph of a deletion, not a tautology

- Root cause: The assertion compares two data-kind values that the selectors already chose as different.
- Closes: REV-TST-14 (nit)
- Change: test, size S
- Files: `src/features/review/change-mark.stories.tsx`
- Symbols: ADeletionDoesNotCarryTheWeightOfAModification
- Regression risk: A computed-colour assertion can be brittle across themes.
- Proof test: The story asserts that the computed colour (or the glyph class) of the delete mark differs from the edit mark; it fails when KIND_PAINT.delete is 'text-candidate'.

#### U-REV-22: Test the tailwind-merge extension for text-small

- Root cause: cn relies on extendTailwindMerge to keep text-small beside a colour class, and no test calls cn.
- Closes: REV-TST-17 (nit)
- Change: test, size S
- Files: `src/shared/lib/utils.test.ts`
- Symbols: cn
- Regression risk: None.
- Proof test: expect(cn('text-small/4', 'text-label')).toBe('text-small/4 text-label'); it fails with plain twMerge.

#### U-REV-24: The graph route comments state reasons without source paths

- Root cause: Two comments in src/routes/graph.tsx name source file paths, which ADR 0006 section 2 counts as addresses.
- Closes: REV-ARC-07 (nit)
- Change: docs, size S
- Files: `src/routes/graph.tsx`
- Symbols: graph route comments
- Regression risk: None; comments only.
- Proof test: None runtime; a grep of src/routes/graph.tsx for 'controller.ts' and '__root.tsx' finds nothing.

#### U-REV-25: The Attribute doc comment cites M7, not M8

- Root cause: model.ts line 7 gives the M7 shape rule the name M8.
- Closes: REV-ARC-08 (nit)
- Change: docs, size S
- Files: `src/shared/read/model.ts`
- Symbols: Attribute
- Regression risk: None; comment only.
- Proof test: None runtime; the comment reads M7.

#### U-REV-30: writeAttributes joins writeElement as one more case of bodyOf

- Root cause: attributes.ts is a one-function module with one caller that does the same job as writeElement.
- Closes: REV-SIM-10 (proposal)
- Change: refactor, size S, removes or moves code
- Files: `src/shared/write/elements.ts`, `src/shared/write/attributes.ts`, `src/features/detail/save.ts`
- Symbols: ElementAct, bodyOf, writeElement, writeAttributes, AttributeChange
- Regression risk: A wrong body for update_attrs makes the writer refuse every attribute save.
- Proof test: elements.test.ts (from U-REV-12) gets an update_attrs case that asserts the body { targetKind, targetId, attrs }.

#### U-REV-32: setTheme writes the shell workspace whole

- Root cause: setTheme reads the stored record to keep other fields, but the strict guard accepts only { theme }, so the read keeps nothing and the comment is false.
- Closes: REV-SIM-12 (proposal)
- Change: refactor, size S, removes or moves code
- Files: `src/shared/theme-provider.tsx`
- Symbols: setTheme
- Regression risk: None; the written bytes are the same.
- Proof test: The theme stories and storage.test.ts stay green; tsc checks `satisfies ShellWorkspace`.

#### U-TST-33: The drift-check comment states that the check writes seed rows

- Root cause: tools/db-drift.ts says 'a check writes no table', but the check calls applyRerunnableFiles, which runs 95_seed.sql inserts and an ON CONFLICT DO UPDATE on entity_type.
- Closes: TST-ARC-10 (nit)
- Change: docs, size S
- Files: `tools/db-drift.ts`
- Symbols: databaseTypeDrift
- Regression risk: None; comment only.
- Proof test: None (comment only): `pnpm check` output does not change.

#### U-TST-37: LOGIN_ROLES and the probe Identity type come from the LOGIN table of db-runtime.ts

- Root cause: db-migrate.ts LOGIN_ROLES and probe.ts Identity repeat by hand the role-to-variable table LOGIN in db-runtime.ts, so a new login added to LOGIN gets a connection string but no password.
- Closes: TST-SIM-09 (proposal)
- Change: refactor, size S, removes or moves code
- Files: `tools/db-runtime.ts`, `tools/db-migrate.ts`, `tools/probe.ts`
- Symbols: LOGIN, LOGIN_ROLES, Identity, connectionString
- Regression risk: If the filter on the superuser is wrong, db-migrate sets a password on the superuser role 'gabriel' from POSTGRES_PASSWORD, or skips a login role.
- Proof test: `pnpm typecheck` passes; `pnpm db:migrate` on a fresh stack sets the same three role passwords (the perimeter login tests stay green).

#### U-TST-38: statement and spliced lose the table and alignment parameters that one caller passes

- Root cause: seed-vocabulary.ts statement(table, columns, rows, rightAligned) and spliced(seed, table, body) each have one caller that passes 'entity_type' and 4.
- Closes: TST-SIM-10 (proposal)
- Change: refactor, size S, removes or moves code
- Files: `tools/seed-vocabulary.ts`
- Symbols: statement, spliced, vocabularyStatement, seedWithVocabulary
- Regression risk: A changed column order or alignment changes the emitted seed bytes.
- Proof test: tools/seed-vocabulary.test.ts (byte-for-byte compare with db/apply/95_seed.sql) stays green.

#### U-TST-39: bundle-guard reads each chunk once

- Root cause: bundle-guard.ts reads each emitted chunk twice, once for its text and once for its byte size.
- Closes: TST-SIM-12 (nit)
- Change: refactor, size S
- Files: `tools/bundle-guard.ts`
- Symbols: chunk map
- Regression risk: None; the text and the size are the same.
- Proof test: `pnpm build` followed by the bundle guard gives the same report before and after.

#### U-WRI-18: The pool.ts comment states the gabriel_app perimeter without a false count of doors

- Root cause: The ROLE comment in pool.ts says 'the four doors', but 90_grants.sql grants five.
- Closes: WRI-ARC-05 (nit), WRI-SIM-05 (nit), XC-ARC-05 (nit)
- Change: docs, size S
- Files: `packages/writer/src/pool.ts`
- Symbols: ROLE, address
- Regression risk: None; the change is in a comment only. None at runtime.
- Proof test: None; a comment-only change. A grep for 'four doors' in packages/writer finds no match after the fix. A grep for 'four doors' in the repository finds no match.
- Merged from U-XC-17: merge: The same comment line, for the same reason.

#### U-WRK-06: The claim live suite seeds its own queued rows and does not depend on the state of the local stack

- Root cause: claim.db-test.ts says that 'no path empties the queue' and depends on at least two queued fixture rows. Worker runs that were committed can remove those rows, so the suite fails when claim_job has no fault.
- Closes: WRK-TST-09 (nit)
- Change: test, size S
- Files: `packages/worker/src/claim.db-test.ts`
- Symbols: held, claimJob
- Regression risk: The seeded rows must pass the jobs constraints (document_id NOT NULL), or the suite fails at setup.
- Proof test: On a stack where every fixture job is already 'running', the live test 'the second worker steps over the locked row' fails before the change and passes after it.
- Critic: The seeded queued rows need document_id NOT NULL, so the suite must also create documents rows. put_document is the only door for that. The suite commits these rows permanently into the one published database, which is the defect that U-TST-16 is still open about. Remove the rows in the suite or make them clearly synthetic, and give them an identity that U-TST-16 can later move to a test database.

### Wave 2

#### U-CON-03: A position outside WGS84, with mixed arity, a Z ordinate or a degenerate shape is refused at the Zod door and by a CHECK on entities.geom

- Root cause: position in request.ts sets no range or arity rule, and entities.geom and proposals_payload_geom have no range or validity CHECK. So a bad position passes both doors and fails only at promotion.
- Closes: CON-SIM-03 (major), CON-COR-03 (minor), CON-COR-04 (minor), CON-SEC-02 (minor), CON-TST-02 (minor), DB-SIM-04 (minor), CON-SEC-03 (nit)
- Change: contract, size M
- Files: `packages/proposal/src/request.ts`, `packages/proposal/src/request.test.ts`, `db/migrations/0017_entity_geom_range.sql`, `tools/geom-range.db-test.ts`
- Symbols: position, positions, rings, surfaces, geometry, entities.geom, proposals_payload_geom, request
- Comes after: U-CON-13 (wave 1): CON-13 moves writeRequest; the position rules go in the new form. U-DB-05 (wave 1): Both constrain the create payload in proposals; the geom rule then fits the shape CHECK.
- Regression risk: A loader or fixture that sends a one-vertex ring, an unclosed ring or a ragged list today gets a 422 after the fix. The migration fails if a stored row is out of range, and a writer that sends 3 ordinates is refused.
- Proof test: request.test.ts: {type:'Point',coordinates:[451000,6640000]} is refused; {type:'LineString',coordinates:[[1,2],[3,4,5]]} and a nested ragged MultiPolygon are refused; a LineString of one position and an unclosed or 1-position ring are refused; Polygon [] and MultiPolygon [] and MultiLineString [] are refused with faultOf code too_small at the correct path. tools/geom-range.db-test.ts: a point (451000, 6640000), a one-point LineString and a Z point each raise at propose or insert; (4.05, 51.95) passes.
- Merged from U-DB-38: merge: Both units change the position schema in request.ts and request.test.ts for the same reason: coordinates outside the globe or with a bad arity get through. Two separate changes would edit the same schema twice.

#### U-DET-03: A stored list round-trips through the edit box with its element kind and its element boundaries

- Root cause: shapeOf joins a list into one text with ', ' and drops the element kind, and readList splits on every ',' and always returns string[], so a number list becomes a string list and an element with a comma becomes two elements.
- Closes: DET-COR-03 (major), DET-COR-04 (major), DET-SIM-02 (major), DET-COR-13 (proposal)
- Change: frontend, size M, removes or moves code
- Files: `src/features/detail/claims.ts`, `src/features/detail/entry.ts`, `src/features/detail/draft.ts`, `src/features/detail/field.tsx`, `src/features/detail/entry.test.ts`
- Symbols: ClaimValue, shapeOf, typedValue, readList, readEntry, typedInto, pendingEdit
- Regression risk: A list that was editable before (a comma inside an element) becomes refused, and a mixed-kind list can be refused where it was accepted.
- Proof test: entry.test.ts: a stored [2019, 2021] typed '2019, 2021, 2023' reads as [2019, 2021, 2023] (numbers); a stored ['Smith, John','J. Smith'] with an appended value is refused, not split into four elements.

#### U-REV-12: Test bodyOf: a null column never goes into the write request body

- Root cause: bodyOf in elements.ts maps null to undefined so that JSON.stringify drops the key, and no test reads the body that writeElement sends.
- Closes: REV-TST-04 (major)
- Change: test, size S
- Files: `src/shared/write/elements.test.ts`
- Symbols: bodyOf, writeElement
- Comes after: U-REV-30 (wave 1): REV-30 moves writeAttributes into bodyOf; the bodyOf test covers the final function.
- Regression risk: The test pins the exact body string, so a later harmless key order change fails it.
- Proof test: elements.test.ts with stubbed fetch: update_entity with label null sends a body without 'label', and create_relation with validFrom null sends a body without 'validFrom'. It fails when line 39 becomes `label: act.label`.

#### U-TST-18: The writer project does not run at the same time as the census projects

- Root cause: vitest.config.ts has no sequence.groupOrder, so writer.db-test.ts commits rows (an entity with no v1_id, a pending act, an unknown-typed entity) while the corpus, schema and service projects count the whole live tables, and the census can fail for a false reason.
- Closes: TST-TST-01 (major)
- Change: tooling, size S
- Files: `vitest.config.ts`
- Symbols: writerProject, corpusProject, schemaProject, serviceProject
- Comes after: U-TST-19 (wave 1): TST-19 removes and rebuilds writerProject and the census projects; the group order goes on the new projects.
- Regression risk: Group ordering makes the full live run longer, and a wrong group number can put the writer in the same group again.
- Proof test: Run `pnpm test` ten times with the writer file slowed at a committed row (a sleep before its cleanup); loaded-corpus.db-test.ts CENSUS fails at least once before the fix and never after it.

#### U-WRI-07: The writer admits only its own Host and Origin, and the admission tests cover the decision doors and normalized media types

- Root cause: turnedAway / admitOwnSiteJson read only sec-fetch-site and content-type, so a DNS-rebinding page passes. The admission tests build their door list from WRITE_OPS only and send only two media types.
- Closes: WRI-SEC-01 (major), WRI-TST-03 (major), XC-SEC-01 (major), XC-TST-04 (major), WRI-SIM-03 (minor), WRI-TST-11 (nit), XC-TST-14 (nit)
- Change: service, size S
- Files: `packages/writer/src/admission.ts`, `packages/writer/src/admission.db-test.ts`, `packages/writer/src/writer.db-test.ts`, `vite.config.ts`
- Symbols: turnedAway, admitOwnSiteJson, mediaOf, doors
- Regression risk: The vite proxy forwards Host localhost:5173 (changeOrigin not set) and Hono app.request in the tests sends no or a different Host, so a too narrow list refuses the real UI or every test request. If the allowlist omits the Host that the Vite proxy forwards, or the Host of the operator's tools, legitimate writes get 403. The '{}' body on a decision door gives 422 'the body names no act', so the positive cells must expect that status.
- Proof test: admission.db-test.ts: a POST to each door with 'host: attacker.example:5177', 'sec-fetch-site: same-origin' and application/json expects 403; the same with host 127.0.0.1:5177 and localhost:5173 is admitted. admission.db-test.ts: a request with Host evil.example:5177 and Sec-Fetch-Site same-origin gets 403 (it fails at HEAD). The door list uses [...WRITE_OPS, ...DECISION_OPS]. Media cases: 'application/json; charset=utf-8' and 'Application/JSON' are admitted, and an absent content-type gets 415. admission.db-test.ts: with doors from [...WRITE_OPS, ...DECISION_OPS], a cross-site POST to /write/promote-proposal expects 403 and text/plain expects 415; 'application/json; charset=utf-8' and 'Application/JSON' are admitted (422 on '{}').
- Merged from U-XC-07, U-WRI-17: merge: U-XC-07 is the same DNS-rebinding defect, and its test findings (XC-TST-04/14) are the U-WRI-17 matrix extension. All three change admission.ts and admission.db-test.ts for the same guard.

#### U-CON-07: The model client asks the service for JSON output

- Root cause: bodyOf (client.ts:137-143) sends no response_format, but judged runs JSON.parse on the raw text, so an answer in a Markdown fence is refused.
- Closes: CON-COR-07 (minor)
- Change: service, size S
- Files: `packages/model/src/client.ts`, `packages/model/src/client.test.ts`
- Symbols: bodyOf
- Regression risk: A model or provider that does not support response_format can refuse the request with a 400, which the client then reads as configuration.
- Proof test: client.test.ts: the body sent to the endpoint holds response_format { type: 'json_object' } (or a fenced answer parses), and the suite passes.

#### U-CON-09: @gab/proposal declares vitest in its devDependencies

- Root cause: The three test files of @gab/proposal import vitest, but packages/proposal/package.json declares only zod, so the import resolves only through the root node_modules, contrary to ADR 0001.
- Closes: CON-ARC-05 (minor)
- Change: tooling, size S
- Files: `packages/proposal/package.json`, `pnpm-lock.yaml`
- Symbols: devDependencies
- Regression risk: A lockfile change can move another package's resolved vitest if the version range differs.
- Proof test: pnpm --filter @gab/proposal exec vitest run passes with strict resolution; pnpm install --frozen-lockfile passes.

#### U-CON-12: The attribute-value tests pin the null and nested-list refusals and the key sentence

- Root cause: attribute-value.test.ts has no case for { v: null } or a nested list, and it asserts only the code of a key refusal, not the KEY_SHAPE sentence that the error callback exists to give.
- Closes: CON-TST-03 (minor), CON-TST-10 (nit)
- Change: test, size S
- Files: `packages/proposal/src/attribute-value.test.ts`
- Symbols: attributeEdit, edited, KEY_SHAPE
- Comes after: U-CON-13 (wave 1): CON-13 changes how attribute-value.test.ts builds attributeEdit; new tests are written against the constant.
- Regression risk: None; tests only.
- Proof test: New tests: { imo: { v: null } }, { port_calls: { v: [['x']] } } and { port_calls: { v: [{ n: 'x' }] } } give invalid_union; refusalOf({ 'Coal Stock': { v: 1 } }).message holds the KEY_SHAPE sentence, and a body 'x' does not. Each fails when the schema is loosened or the error option is removed.

#### U-DET-06: One source register numbers and deduplicates documents and builds the source cards for readDossier and readRelation

- Root cause: readDossier's refsOf maps ids with no deduplication while readRelation has its own copy of the numbering and the card builder that deduplicates, so a repeated id draws a duplicate React key and counts the evidence twice, and the two copies can drift.
- Closes: DET-COR-09 (minor), DET-TST-07 (minor), DET-ARC-10 (proposal), DET-COR-14 (proposal), DET-SIM-07 (proposal)
- Change: refactor, size M, removes or moves code
- Files: `src/features/detail/dossier.ts`, `src/features/detail/dossier.test.ts`, `src/features/detail/rail.stories.tsx`
- Symbols: readDossier, readRelation, refOf, refsOf, SourceCardModel, sourceRegister, cardOf
- Regression risk: The numbering order of sources can change if the register is called in a different order than today.
- Proof test: dossier.test.ts: a corpus whose claim cites ['d1','d1'] and whose relation also cites d1 gives one SourceRef for d1 in each list, one card, and number 1; rail.stories.tsx EachDocumentIsListedOnce fed from readDossier fails before the fix.

#### U-DET-09: The page keeps its busy lock until the reload after a signed act settles

- Root cause: onSave, onMint and onStructure set the result state before they await onSaved/onDeleted, so busy is false during the reload and the page offers controls on the old record; the chains also have no catch.
- Closes: DET-COR-07 (minor), DET-TST-05 (minor)
- Change: frontend, size M
- Files: `src/features/detail/detail-page.tsx`, `src/features/detail/detail-page.stories.tsx`
- Symbols: DetailPage, onSave, onMint, onStructure, busy
- Regression risk: If the reload never settles, the page stays locked and the analyst cannot act.
- Proof test: detail-page.stories.tsx: a signed delete_relation with an onSaved spy that waits; assert the relation Delete control is disabled until onSaved resolves; a signed delete_entity calls onDeleted once and onSaved never.

#### U-REV-03: The review card marks a proposed type that is not a live type as a type that will be stored as 'unknown'

- Root cause: columnsDifference and the create_entity headline show the raw proposed type word, but promote_proposal stores coalesce(v_type,'unknown') when the word is not a live entity_type. The review does not read the type vocabulary.
- Closes: REV-COR-04 (minor)
- Change: frontend, size M
- Files: `src/features/review/queue.ts`, `src/features/review/queue.test.ts`, `src/features/review/difference.tsx`, `src/routes/review.tsx`
- Symbols: readQueue, columnsDifference, changeOf, ReviewRoute loader
- Regression risk: If the vocabulary argument is required, every readQueue caller (stories, sample.ts, decided.test.ts) breaks, so it must be optional and default to 'no mark'.
- Proof test: queue.test.ts: readQueue over an update_entity act with type 'tanker' and a vocabulary without 'tanker' gives a Type row that states the promotion stores 'unknown'; a live type gives no such mark.

#### U-TST-02: Arm 1 flags a definer with no search_path entry, not only a definer with no SET at all

- Root cause: Arm 1 (and its copy in the 90_grants.sql arm text) tests `p.proconfig IS NULL`, which means 'has no SET clause', not 'has no search_path'. A definer with only SET statement_timeout passes. Arm 5 also finds only schema-qualified `public.` reads.
- Closes: TST-COR-05 (minor), TST-TST-10 (minor), TST-SEC-07 (nit)
- Change: test, size S
- Files: `tools/perimeter/audit-arm.db-test.ts`, `db/apply/90_grants.sql`
- Symbols: ARMS
- Regression risk: A wrong LIKE pattern (unescaped underscore or a quoted form such as "search_path"=...) can flag all eight doors and turn the perimeter project red.
- Proof test: tools/perimeter/audit-arm.db-test.ts arm 1: in a rolled-back transaction create a SECURITY DEFINER function with only SET statement_timeout = '5s'; the arm query returns its name after the fix and returns no row before it.

#### U-TST-11: Enable vitest/expect-expect so that a test with no assertion fails lint

- Root cause: The test-lint block comment says it catches 'a test that no assertion reaches', but no enabled rule does; vitest/expect-expect is absent.
- Closes: TST-COR-08 (minor), TST-TST-12 (minor)
- Change: tooling, size S
- Files: `eslint.config.ts`
- Symbols: vitest test-lint block
- Regression risk: Every test that asserts only through a helper (refusedGeom, and any story play function) fails lint until the helper is named in assertFunctionNames; if U-TST-15 adds a rolledBack helper that holds expect, it must be named too.
- Proof test: `pnpm lint` on a test file with `test('x', async () => { await probe('app', async () => {}) })` reports vitest/expect-expect after the fix and reports nothing before it; the existing suite lints clean.

#### U-DET-24: Row-level source lists name S2, and the empty-source sentence names no claim rule

- Root cause: sidebar.tsx and NO_SOURCE in mark.tsx cite M8 and invariant 1 (attribute rules) for entity and relation row-level lists that S2 governs.
- Closes: DET-ARC-08 (nit)
- Change: frontend, size S
- Files: `src/features/detail/sidebar.tsx`, `src/features/detail/mark.tsx`, `src/features/detail/mark.stories.tsx`
- Symbols: NO_SOURCE, SourceMark, SourceCount
- Regression risk: A story that asserts the old NO_SOURCE sentence fails until it is updated.
- Proof test: mark.stories.tsx: SourceCount with an empty row-level list shows a sentence with no 'invariant 1' and no 'claim'.

#### U-REV-21: The dark-theme review stories assert a dark colour, or their names stop claiming it

- Root cause: Each dark story asserts only that an element renders, so removing the .dark tokens passes.
- Closes: REV-TST-15 (nit)
- Change: test, size M
- Files: `src/features/review/change-card.stories.tsx`, `src/features/review/change-mark.stories.tsx`, `src/features/review/decide.stories.tsx`, `src/features/review/decided-page.stories.tsx`, `src/features/review/difference.stories.tsx`, `src/features/review/node-pane.stories.tsx`, `src/features/review/review-page.stories.tsx`, `src/features/review/sources.stories.tsx`, `src/features/review/subject-rail.stories.tsx`
- Symbols: dark-theme stories
- Regression risk: Colour assertions break on a deliberate token change.
- Proof test: Each dark story asserts one computed colour against the dark token; it fails when the .dark block is removed from index.css.

#### U-TST-36: Remove the unused --file gate of comment-report and the three unread measurement fields

- Root cause: comment-report.ts keeps a gate for an edit hook that does not exist (the ESLint comment-budget rule is the real gate), and comment-budget.ts returns Measurement.blocks, Block.chars and Open.text that nothing reads.
- Closes: TST-SIM-07 (proposal)
- Change: refactor, size S, removes or moves code
- Files: `tools/comment-report.ts`, `tools/comment-budget.ts`
- Symbols: gate, Measurement, Block, Open, measure
- Regression risk: Removing the internal blocks array instead of only the returned field breaks overBlocks and the ESLint comment-budget rule.
- Proof test: `pnpm census` output and `pnpm lint` output are the same before and after; `pnpm typecheck` passes.

### Wave 3

#### U-DET-04: A digit string that a double cannot hold exactly stays text, and the mint code loses its dead list branch

- Root cause: controlOfTyped reads every DECIMAL match as 'number' and readNumber refuses only a value that is not finite, so a 20-digit identifier is rounded and signed with no way to keep it as text.
- Closes: DET-COR-05 (major), DET-SIM-03 (major), DET-TST-09 (minor), DET-SIM-10 (proposal)
- Change: frontend, size M, removes or moves code
- Files: `src/features/detail/entry.ts`, `src/features/detail/mint.ts`, `src/features/detail/entry.test.ts`, `src/features/detail/day.test.ts`, `src/features/detail/new-claim.stories.tsx`
- Symbols: controlOfTyped, readNumber, DECIMAL, readMint, MintDraft, READS, NO_LIST
- Comes after: U-DET-03 (wave 2): Both change entry.ts; DET-03 removes and moves code first.
- Regression risk: A decimal that used to mint as a number (for example one with many fraction digits) can now mint as text.
- Proof test: entry.test.ts: controlOfTyped('40702810123456789012') is 'text' and controlOfTyped('41.5') is 'number'; day.test.ts: isDay('2024-02-29') true, isDay('1900-02-29') false, isDay('2000-02-29') true.

#### U-WRI-14: Test the 404 and M4 endpoint guards of groundOf for create_relation, update_attrs and delete_relation

- Root cause: No test sends an absent endpoint, a missing update_attrs or delete target, or a delete of a relation that is an endpoint.
- Closes: WRI-TST-01 (major), WRI-TST-05 (minor), XC-TST-10 (minor), XC-TST-11 (minor)
- Change: test, size S
- Files: `packages/writer/src/writer.db-test.ts`
- Symbols: groundOf, present, attributesOf, endpointUses, USES
- Regression risk: The new fixture relation (relation as an endpoint) must be removed in the test, or the afterAll count check fails. Test rows that are not cleaned up can change counts in other writer tests.
- Proof test: writer.db-test.ts: create-relation with an absent dstId expects [404, 'the target <id> does not exist'] and an unchanged proposal count; create-relation with srcKind 'relation' on a live relation expects 200; update-attrs on an absent id expects 404; delete-relation on a relation that another relation uses expects [409, 'the relation is an endpoint of 1 relation, and it is not deleted']. New writer.db-test cases post create-relation, update-attrs, delete-relation and delete-entity with NO_ENTITY and expect 404 with no new proposal. Another case creates R2 whose source is relation R1, posts delete-relation on R1, and expects 409 'the relation is an endpoint of 1 relation, and it is not deleted'.
- Merged from U-XC-10: merge: The same missing tests of groundOf and endpointUses in writer.db-test.ts.

#### U-CON-02: The create_relation door and the link draft refuse a day that is not in the calendar and a reversed interval

- Root cause: DAY is a shape regex only, in request.ts and in readLinkDraft, and the create_relation refine checks only the scope of the interval. So '2026-02-30' or validFrom after validTo commits a proposal that promote_proposal always refuses.
- Closes: CON-COR-02 (minor), CON-SIM-04 (minor), DET-TST-10 (minor), WRI-COR-04 (minor), DET-COR-10 (nit)
- Change: contract, size S, removes or moves code
- Files: `packages/proposal/src/request.ts`, `packages/proposal/src/request.test.ts`, `src/features/detail/link-draft.ts`, `src/features/detail/link-draft.test.ts`
- Symbols: DAY, day, writeRequest, create_relation refine, linkDraft BACKWARDS check, readLinkDraft
- Comes after: U-CON-13 (wave 1): CON-13 turns the writeRequest factory into a module constant; the day and interval refines go in the new form.
- Regression risk: A stricter day schema can refuse a day that the browser day control gives in a different form, and removing the browser copy of the order rule can change the sentence the operator reads. A browser form that reuses the schema now refuses dates it accepted before, and a timezone-sensitive calendar check can refuse a valid day. None beyond a day that the database would refuse anyway.
- Proof test: request.test.ts: create_relation with type 'owns', validFrom '2026-12-31', validTo '2026-01-01' is refused, and validFrom '2026-02-30' is refused; a valid leap day 2024-02-29 is accepted. request.test.ts: writeRequest().safeParse of a create_relation 'owns' with validFrom '2026-05-01' and validTo '2026-01-01' fails, and with validFrom '2026-02-30' fails; equal days pass. link-draft.test.ts: validFrom '2019-02-30' gives NOT_A_DAY; From 2020-01-01 and To 2010-01-01 gives BACKWARDS; To only gives an act with validFrom null.
- Merged from U-WRI-06, U-DET-11: merge: U-WRI-06 is the same finding on the same symbols (DAY, day, writeRequest). U-DET-11 is the same calendar check in link-draft.ts, which U-CON-02 already lists in its files.

#### U-CON-10: The retry-count comment in the model client names T9a

- Root cause: The comment at client.ts:9-11 says that what a job does when the chain ends is not decided, but T9a (26 September 2026) decided it and fail_job exists.
- Closes: CON-ARC-04 (minor), CON-SIM-08 (proposal)
- Change: docs, size S
- Files: `packages/model/src/client.ts`
- Symbols: NETWORK_RETRIES comment
- Regression risk: None beyond a comment that can drift again if T9a changes.
- Proof test: No behaviour test; lint (ADR 0006 comment rules) passes on the new comment.

#### U-CON-15: The refusal and bad-request tests of the model client count the calls

- Root cause: The tests 'reports a refusal of the model', 'reads the sentence when the provider gives no stable word' and 'never calls another bad request too long' assert only the failure kind, so a stop that becomes a retry passes.
- Closes: CON-TST-04 (minor)
- Change: test, size S
- Files: `packages/model/src/client.test.ts`
- Symbols: client.test.ts refusal tests
- Comes after: U-CON-06 (wave 1): CON-06 makes maxWaitMs required in settings; client tests written after use the final settings shape.
- Regression risk: None; tests only.
- Proof test: Add expect(send).toHaveBeenCalledTimes(1) and attempts: 1 to the three tests; each fails when stop becomes again.

#### U-DET-07: A borrowed position states that it is borrowed also when the parent label is not found

- Root cause: readDossier sets positionFrom from the parent label, so when read.entities does not hold the parent the point is drawn as the entity's own point.
- Closes: DET-ARC-02 (minor), DET-TST-11 (minor)
- Change: frontend, size S
- Files: `src/features/detail/dossier.ts`, `src/features/detail/dossier.test.ts`, `src/features/detail/detail-page.stories.tsx`, `src/features/detail/sidebar.stories.tsx`
- Symbols: readDossier, positionFrom, positionFromWords
- Regression risk: The fallback word can show on the page where no position line showed before.
- Proof test: dossier.test.ts: a position row with a parentId absent from read.entities gives positionFrom 'position from a parent'; stories assert [data-position-from] and 'proposed as <type>' on the page and in the sidebar.

#### U-REV-26: The queue and the history show whether an agent or the operator wrote an act

- Root cause: authorRole is read and validated but not carried on Change or DecidedRow, and confidenceOf always says 'The machine reports'.
- Closes: REV-SIM-04 (minor)
- Change: frontend, size M
- Files: `src/features/review/queue.ts`, `src/features/review/queue.test.ts`, `src/features/review/change-card.tsx`, `src/features/review/decided.ts`, `src/features/review/decided-page.tsx`, `src/features/review/decided.test.ts`
- Symbols: Change, changeOf, confidenceOf, DecidedRow, readDecided
- Regression risk: New fields on Change and DecidedRow break hand-built literals in stories and tests.
- Proof test: queue.test.ts: an act with authorRole 'gabriel_app' and confidence 1 gives an 'operator' mark and no 'The machine reports' words; decided.test.ts: a DecidedRow carries the author.

#### U-TST-03: The write-grant checks also read column-level grants

- Root cause: WRITES_OF in role-privilege.db-test.ts and audit arm 4 read only information_schema.role_table_grants (pg_class.relacl), so a column-level INSERT or UPDATE grant (pg_attribute.attacl) on an evidentiary table is invisible.
- Closes: TST-COR-03 (minor), TST-SEC-02 (minor)
- Change: test, size S
- Files: `tools/perimeter/role-privilege.db-test.ts`, `tools/perimeter/audit-arm.db-test.ts`, `db/apply/90_grants.sql`
- Symbols: WRITES_OF, ARMS
- Regression risk: column_privileges also lists the column rows implied by a table grant, so a union without DISTINCT or without the extension filter can report duplicate or PostGIS rows and make the arms fail.
- Proof test: tools/perimeter/role-privilege.db-test.ts: in a rolled-back transaction GRANT UPDATE (label) ON public.entities TO gabriel_app; the WRITES_OF query for gabriel_app returns a row after the fix and [] before it. The same check on audit arm 4.

#### U-CON-11: The attribute-value test comment no longer says the seed describes the imo key

- Root cause: attribute-value.test.ts:27-29 says the seed gives imo a shape, but commit cee6200 and migration 0010 removed every key description under M11.
- Closes: CON-ARC-03 (nit)
- Change: docs, size S
- Files: `packages/proposal/src/attribute-value.test.ts`
- Symbols: test 'breaks the shape its key is described with'
- Comes after: U-CON-13 (wave 1): Both edit attribute-value.test.ts; the refactor first avoids a rebase of the comment fix.
- Regression risk: None; the assertion stays the same.
- Proof test: The existing test passes with the new title and comment.

#### U-DET-23: The rail story comment states the real lint rule

- Root cause: rail.stories.tsx says eslint refuses any -page import from a story, but the rule covers only the map and graph canvas pages.
- Closes: DET-ARC-07 (nit)
- Change: docs, size S
- Files: `src/features/detail/rail.stories.tsx`
- Symbols: Rail stories
- Regression risk: None: comments only.
- Proof test: None: comment-only.

#### U-DET-28: The promoted proposedType word takes the label hue, not the candidate hue

- Root cause: The header draws entities.proposed_type, a promoted column, in text-candidate, the hue reserved for the unpromoted layer.
- Closes: DET-SIM-06 (nit)
- Change: frontend, size S
- Files: `src/features/detail/detail-page.tsx`
- Symbols: DetailPage
- Regression risk: None beyond a colour change.
- Proof test: detail-page.stories.tsx: the 'proposed as' span has the class text-label, not text-candidate.

#### U-TST-13: OFFLINE accepts only '1' and refuses any other non-empty value

- Root cause: vitest.config.ts treats any non-empty OFFLINE (including 0 or false) as a request for the smaller suite, which drops all eight live projects in silence.
- Closes: TST-COR-11 (nit)
- Change: tooling, size S
- Files: `vitest.config.ts`
- Symbols: offlineWasAsked
- Comes after: U-TST-19 (wave 1): TST-19 rewrites the project list that offlineWasAsked filters.
- Regression risk: A local script or shell profile that sets OFFLINE=true now stops the run with an error.
- Proof test: `OFFLINE=0 pnpm test` throws the refusal after the fix and runs only the offline projects green before it; `OFFLINE=1 pnpm test` behaves the same before and after.

#### U-TST-29: The lint config enforces that a feature is one flat folder

- Root cause: The feature element 'src/features/*' in the default folder mode matches every file under the folder, so a nested subfolder is accepted, although ADR 0001 §1 says one feature is one flat folder and the lint config is the only place that states the layout.
- Closes: TST-ARC-06 (nit)
- Change: tooling, size S
- Files: `eslint.config.ts`
- Symbols: feature element
- Regression risk: A change of mode also changes how the capture ['feature'] is taken, which can break the dependency rules that compare features.
- Proof test: Create src/features/map/nested/x.ts: `pnpm lint` reports boundaries/no-unknown-files after the fix and nothing before it.

### Wave 4

#### U-CON-04: The relation type has a length bound at the door and in the database

- Root cause: create_relation type is z.string().trim().min(1) with no .max() (request.ts:72), and relations.type has no length CHECK, but relations_type_idx is a btree that raises 54000 on a large value at promotion time.
- Closes: CON-SEC-01 (minor)
- Change: schema, size S
- Files: `packages/proposal/src/request.ts`, `packages/proposal/src/request.test.ts`, `db/migrations/0014_relation_type_length.sql`
- Symbols: writeRequest, create_relation type, relations.type CHECK, proposals payload type CHECK
- Comes after: U-CON-13 (wave 1): CON-13 moves writeRequest; the type length bound goes in the new form. U-DB-05 (wave 1): Both add CHECKs on the create_relation payload in proposals; the length rule then goes next to or into the shape CHECK.
- Regression risk: A CHECK added on relations fails the migration if a stored relation type is longer than the bound.
- Proof test: request.test.ts: create_relation with a type of 8000 characters is refused with too_big; a db-test inserts a relation with a type longer than the bound and gets a check violation.

#### U-CON-16: The validation-retry test reads the fault that is fed back and failure.detail

- Root cause: client.test.ts:261 checks only the fixed prefix of the feedback, and no test reads failure.detail, so an empty issues text passes (T9 says the fault is fed back).
- Closes: CON-TST-05 (minor)
- Change: test, size S
- Files: `packages/model/src/client.test.ts`
- Symbols: feedback, issuesOf, failureOf
- Comes after: U-CON-06 (wave 1): Same settings shape change in client.test.ts.
- Regression risk: None; tests only.
- Proof test: Assert that the second call's feedback contains the Zod path (for example 'claim:') and that failure.detail contains it; the test fails when issuesOf returns ''.

#### U-DET-10: NewClaim and NewRelation clear their form only after a signed result

- Root cause: The two forms call setForm(BLANK) before onMint/onCreate sends the act, and the parent returns void, so a refused or unknown result loses what the analyst typed.
- Closes: DET-COR-08 (minor), DET-TST-08 (minor)
- Change: frontend, size M
- Files: `src/features/detail/new-claim.tsx`, `src/features/detail/new-relation.tsx`, `src/features/detail/detail-page.tsx`, `src/features/detail/detail-page.stories.tsx`, `src/features/detail/new-claim.stories.tsx`, `src/features/detail/new-relation.stories.tsx`
- Symbols: NewClaim, NewRelation, onMint, onStructure, onCreate
- Comes after: U-DET-09 (wave 2): DET-09 restructures onMint/onStructure to await the reload; DET-10 then returns the result to the forms.
- Regression risk: A signed mint that is not detected as signed leaves the typed values in the form, and a second click sends the act twice.
- Proof test: detail-page.stories.tsx: mint coal_stock_t = 41.5 against a refusing door, assert the key and value boxes keep their text; new-claim.stories.tsx asserts onMint gets { v: true } for 'yes' and { v: false } for 'no'.

#### U-REV-08: A document address becomes a link only when it is http or https, checked where the read layer maps documents

- Root cause: documents.uri and archive_uri are copied as any string and put into <a href> with no scheme check, in the review sources and in the detail source card.
- Closes: DET-SEC-01 (minor), REV-SEC-03 (nit)
- Change: service, size S
- Files: `src/shared/read/map.ts`, `src/shared/read/map.test.ts`, `src/features/detail/dossier.ts`, `src/features/detail/source-card.tsx`, `src/features/detail/source-card.stories.tsx`
- Symbols: toDomain.document, SourceCardModel, readDossier, readRelation, SourceCard, shorten
- Comes after: U-DET-06 (wave 2): DET-06 merges the source-card builders of readDossier and readRelation; the scheme check then goes in one place.
- Regression risk: A document with a valid but relative or scheme-less address would lose its link. A stored address with no scheme (for example 'www.example.org/x') stops being a link.
- Proof test: map.test.ts: toDomain.document with uri 'data:text/html,x' and archive_uri 'javascript:alert(1)' gives null for both; 'https://registry.example/e' is kept. source-card.stories.tsx: a card with uri 'file:///etc/passwd' or 'ms-msdt:x' has no link role and shows the text; a card with https shows a link.
- Merged from U-DET-15: merge: One scheme check in toDomain.document, which feeds both surfaces, closes both findings. If you fix them separately, you add two copies of the same guard.

#### U-TST-04: Arm 3 refuses any role membership and any elevated attribute of the three login roles

- Root cause: Arm 3 reads only memberships in gabriel_owner. A login role that becomes a member of pg_write_all_data or of any other role that can write can SET ROLE to it (PostgreSQL 17 default SET option), and no arm reads other memberships or rolsuper, rolcreaterole, rolcreatedb, rolbypassrls.
- Closes: TST-SEC-03 (minor)
- Change: test, size S
- Files: `tools/perimeter/audit-arm.db-test.ts`, `db/apply/90_grants.sql`
- Symbols: ARMS
- Regression risk: If a login role today has a deliberate membership (for example a PostGIS or pg_read_all_* role granted by an init script), the new arm fails and that membership must be named as an exemption.
- Proof test: tools/perimeter/audit-arm.db-test.ts: in a rolled-back transaction GRANT pg_write_all_data TO gabriel_agent; the new membership arm returns 'gabriel_agent in pg_write_all_data' after the fix, and no arm returns a row before it.

#### U-TST-14: Remove the two open-vocabulary tests that repeat another test, and correct the comments that describe the dropped attribute_key table

- Root cause: Migration 0010 dropped attribute_key, but two tests and several comments still describe keys as described or declared.
- Closes: DB-TST-16 (minor), TST-ARC-11 (nit), TST-COR-12 (nit), TST-SIM-05 (proposal), TST-TST-14 (nit)
- Change: test, size S, removes or moves code
- Files: `tools/open-vocabulary.db-test.ts`, `tools/null-never-passes.db-test.ts`, `db/apply/40_functions.sql`, `packages/writer/src/writer.db-test.ts`
- Symbols: open-vocabulary tests, attrs_valid comment
- Regression risk: The 40_functions.sql edit is comment-only but re-applies the whole file at the next db:apply; a stray character outside the comment breaks the apply. None; the removed tests repeat the tests at lines 49 and 54.
- Proof test: No behaviour change: `pnpm test --project schema` stays green with two fewer tests, and `git grep attribute_key tools/` finds only the seed-vocabulary test that asserts the table is absent. The suite stays green with the two tests removed, and the undescribed-key tests at lines 49 and 54 remain.
- Merged from U-DB-21: merge: The same two tests in open-vocabulary.db-test.ts and the same stale comments.

#### U-REV-28: The standing pane draws its sources as cited documents, so a missing document shows as missing

- Root cause: standingRows joins the source ids into a string, and node-pane prints it, so a cited id with no row looks like a present one.
- Closes: REV-SIM-07 (nit)
- Change: frontend, size S, removes or moves code
- Files: `src/features/review/queue.ts`, `src/features/review/node-pane.tsx`, `src/features/review/node-pane.stories.tsx`
- Symbols: StandingRow, standingRows, sourceWords, NodePane
- Regression risk: The pane gets wider badges, which can change its layout.
- Proof test: node-pane.stories.tsx: a standing attribute that cites doc_0000ff renders a SourceBadge with data-band='missing'.

#### U-TST-30: src/main.tsx and src/router.tsx cannot import src/db

- Root cause: The boundaries block ignores src/main.tsx and src/router.tsx for every rule, so the base-tables refusal of ADR 0003 §8 does not reach them.
- Closes: TST-ARC-07 (nit)
- Change: tooling, size S
- Files: `eslint.config.ts`
- Symbols: boundaries block ignores, no-restricted-imports
- Regression risk: A second no-restricted-imports block for the same files replaces, not merges, an earlier one in flat config if they overlap.
- Proof test: Add `import '@/db/types'` to src/router.tsx: `pnpm lint` reports it after the fix and nothing before it.

### Wave 5

#### U-DET-17: A story pins that a key retyped during a save survives the answer

- Root cause: ADraftTypedDuringASaveSurvives retypes a key that is not in the act, so it cannot see the guard in draftsAfterSave.
- Closes: DET-TST-04 (minor)
- Change: test, size S
- Files: `src/features/detail/detail-page.stories.tsx`, `src/features/detail/draft.test.ts`
- Symbols: draftsAfterSave
- Regression risk: None: the change is in tests only.
- Proof test: Type again on Hull note before door.open() and assert the box keeps the new text; the mutation that deletes every key of the act fails it.

#### U-REV-04: The source link says whether it opens the ingest copy or the live original address

- Root cause: citedDocuments falls back from archiveUri to uri in one href, and SourceBadge labels every href 'Open the copy taken at ingest'. The doc comment also claims the archive copy cannot drift or disappear.
- Closes: REV-ARC-05 (minor), REV-COR-05 (minor)
- Change: frontend, size S
- Files: `src/features/review/queue.ts`, `src/features/review/sources.tsx`, `src/features/review/sources.stories.tsx`
- Symbols: CitedDocument, citedDocuments, SourceBadge
- Comes after: U-REV-08 (wave 4): REV-08 checks the uri scheme in the read layer; REV-04 then labels only validated hrefs.
- Regression risk: Adding a field to CitedDocument breaks the hand-built CitedDocument literals in sources.stories.tsx until they get the field.
- Proof test: sources.stories.tsx: a document with archiveUri null and uri 'https://registry.example/entry' shows the original-address label and not 'Open the copy taken at ingest'.

#### U-TST-15: One rolled-back probe helper, and the three refusal tests that commit a write run inside it

- Root cause: The BEGIN / try / finally ROLLBACK wrapper is written by hand in eleven places, and three refusal tests in role-privilege.db-test.ts (UPDATE public.jobs, INSERT INTO public.jobs, UPDATE/DELETE api.entity) do not have it, so a regressed grant makes the failing test also commit a write to the live database.
- Closes: TST-TST-06 (minor), TST-SIM-03 (proposal)
- Change: test, size M, removes or moves code
- Files: `tools/probe.ts`, `tools/perimeter/role-privilege.db-test.ts`, `tools/date-belongs-to-bytes.db-test.ts`, `tools/open-vocabulary.db-test.ts`, `tools/null-never-passes.db-test.ts`, `tools/inherited-position.db-test.ts`, `tools/applies-something.db-test.ts`, `tools/corpus/known-gap.db-test.ts`, `tools/closed-set.db-test.ts`
- Symbols: probe, rolledBack, made, gesture, oneProposal
- Comes after: U-TST-14 (wave 4): TST-14 removes two open-vocabulary tests; TST-15 then does not wrap tests that go away.
- Regression risk: A test that must see a committed row (for example a check across two connections) breaks if it is moved into the rolled-back helper by mistake.
- Proof test: tools/perimeter/role-privilege.db-test.ts: in a rolled-back setup GRANT UPDATE ON public.jobs TO gabriel_agent and run the 'agent cannot update jobs' test; it fails and the jobs rows keep their status after the fix, and they move to 'running' before it.

#### U-WRI-04: Correct the refusal map (a true 23514 sentence, no dead BY_SHAPE entries) and test it offline in refusal.test.ts, in a new writer-unit project

- Root cause: The refusal map has no offline test. BY_CODE always shadows two BY_SHAPE entries, the 23514 sentence still names the key rules that migration 0010 removed, and the pure failureFrom tests are in writer.db-test.ts, which OFFLINE=1 skips.
- Closes: WRI-COR-05 (minor), WRI-TST-08 (minor), XC-TST-08 (minor), WRI-SIM-04 (nit), WRI-SIM-06 (proposal), WRI-TST-12 (proposal), XC-COR-07 (nit), XC-TST-09 (nit)
- Change: service, size S, removes or moves code
- Files: `packages/writer/src/refusal.ts`, `packages/writer/src/refusal.test.ts`, `packages/writer/src/writer.db-test.ts`, `vitest.config.ts`
- Symbols: BY_CODE, BY_SHAPE, knownFrom, named, refusalFrom, failureFrom, writerProject, writer-unit project, failureFrom tests
- Comes after: U-TST-19 (wave 1): TST-19 rebuilds the vitest projects with wide globs; WRI-04 then needs no separate writer-unit project.
- Regression risk: A changed sentence can break a test or a UI story that matches the old 23514 text, and a deleted shape can change the answer if an error ever arrives without its code. A glob for the new offline project that matches .db-test.ts would open a socket in an OFFLINE run. A wrong include glob can make the new project also match *.db-test.ts and open a socket offline, or drop the moved tests from every run.
- Proof test: refusal.test.ts: a table over refusalFrom({code,message}) for every BY_CODE entry and every reachable BY_SHAPE entry, with 23514 expecting the new shape sentence (fails before), the order rule (an exact shape wins over the 'proposal X does not exist' regex), the named suffix for GENERIC with a proposalId, and 57P02/57P03 as doubts in failureFrom. refusal.test.ts runs under OFFLINE=1. It asserts each BY_CODE sentence, a 23503 error with the 'cites a document' message, and the ', and the act stays pending as <id>' suffix. The 23503 case fails at HEAD if the entry must win. OFFLINE=1 pnpm test --project writer-unit runs refusal.test.ts with the three failureFrom cases; before the change no writer project exists offline and the cases do not run.
- Merged from U-XC-08, U-WRI-01: merge: U-XC-08 is the same dead-entry and no-test finding. It also moves the failureFrom tests into an offline project, and that move is all of U-WRI-01. All three create refusal.test.ts and change the same symbols.

#### U-CON-17: The envelope lowercasing and the stable word at a status other than 400 are tested

- Root cause: Every refusal fixture in client.test.ts is already lower case, and context_length_exceeded is tested only at status 400, so removing toLowerCase in refusalOf or moving the RETRY_STATUS check passes the suite.
- Closes: CON-TST-07 (nit)
- Change: test, size S
- Files: `packages/model/src/client.test.ts`
- Symbols: refusalOf, CONTEXT_FULL
- Comes after: U-CON-06 (wave 1): Same settings shape change in client.test.ts.
- Regression risk: None; tests only.
- Proof test: A fixture with error_type 'Context_Length_Exceeded' gives too_long; a 429 that carries context_length_exceeded gives too_long with one call; both fail when the lowercasing is removed or the status check moves.

#### U-DB-35: The grants comment gives the correct table count

- Root cause: 90_grants.sql:32 says seven tables; the list names six.
- Closes: DB-ARC-18 (nit)
- Change: docs, size S
- Files: `db/apply/90_grants.sql`
- Symbols: grants comment
- Regression risk: None; comment only.
- Proof test: None; documentation only.

#### U-TST-07: Move the two root perimeter arms into audit-arm.db-test.ts and delete the root file

- Root cause: tools/perimeter.db-test.ts repeats the findings/foundBy/ARMS loop of tools/perimeter/audit-arm.db-test.ts and runs in the schema project, so `pnpm test:perimeter` does not run two perimeter arms.
- Closes: TST-SIM-04 (proposal)
- Change: refactor, size S, removes or moves code
- Files: `tools/perimeter.db-test.ts`, `tools/perimeter/audit-arm.db-test.ts`
- Symbols: ARMS, foundBy, findings, EXEMPT_CASCADES, WRITE_VERBS
- Regression risk: The top-level evidentiary await and EXEMPT_CASCADES must move with the arms, or the moved cascade arm gets no $2 and fails or passes vacuously.
- Proof test: `pnpm test:perimeter` lists the tests 'the perimeter carries no default privilege ...' and 'the perimeter carries no foreign key that cascades ...' after the move and does not list them before it; the full suite count of tests stays the same.

### Wave 6

#### U-DB-06: proposals_update_entity_shape trims type with the full whitespace set, and a database test reaches every half of the CHECK

- Root cause: No database test calls propose_change with update_entity, and the type test of the CHECK uses the default btrim set (spaces only).
- Closes: DB-TST-13 (minor), TST-TST-04 (minor)
- Change: schema, size S
- Files: `db/migrations/0016_update_entity_type_trim.sql`, `tools/update-entity-shape.db-test.ts`, `tools/applies-something.db-test.ts`
- Symbols: proposals_update_entity_shape
- Comes after: U-TST-15 (wave 5): TST-15 rewrites applies-something.db-test.ts to the probe helper; DB-06's new test uses it.
- Regression risk: The re-created constraint fails if a stored row has a whitespace-only type. A refusal from another CHECK (for example proposals_src_shape) with a badly built input can make a test pass for the wrong constraint unless it asserts the constraint name.
- Proof test: tools/update-entity-shape.db-test.ts: update_entity with a third key, with target_kind 'relation', with neither key, with a blank label and with type E'\t' each raise 23514 proposals_update_entity_shape; the tab case fails before the migration. The new tests pass at HEAD; if the jsonb_typeof(...) = 'string' half of the CHECK is removed in a scratch migration, the {"label":null} test fails.
- Merged from U-TST-21: merge: Both add the missing database test of the same CHECK. U-DB-06 also corrects the trim that such a test would find.

#### U-DET-22: Comments and fixtures state the M11 rule, not a dropped attribute vocabulary

- Root cause: After migration 0010 dropped attribute_key, comments and refusal fixtures in the detail feature still describe a vocabulary that declares keys and kinds.
- Closes: DET-ARC-05 (minor)
- Change: docs, size S
- Files: `src/features/detail/band.tsx`, `src/features/detail/draft.ts`, `src/features/detail/record.stories.tsx`, `src/features/detail/detail-page.stories.tsx`, `src/features/detail/save-bar.stories.tsx`
- Symbols: AnUndeclaredKeyIsWrittenLikeAnyOther, recordCells
- Regression risk: A renamed story or a changed fixture string can break an assertion that reads the old refusal text.
- Proof test: None: text-only; the existing stories pass with the new refusal fixture.

#### U-REV-19: The missing-document badge story derives its value through readQueue

- Root cause: ABSENT in sources.stories.tsx is a hand-built CitedDocument, so the missing and title paths of citedDocuments are untested in the review.
- Closes: REV-TST-13 (minor)
- Change: test, size S
- Files: `src/features/review/sources.stories.tsx`
- Symbols: citedIn, ABSENT
- Comes after: U-REV-04 (wave 5): REV-04 changes CitedDocument and SourceBadge; the story is derived through the new readQueue output.
- Regression risk: The story now depends on the sample merge act citing doc_0000ff.
- Proof test: ABSENT = citedIn(readQueue(reviewSample, null), 'doc_0000ff') with citedIn also reading change.sources; the story fails when citedDocuments sets missing: false.

#### U-TST-05: The table default-privilege arm reads the global default ACL row

- Root cause: The default-privilege arm inner-joins pg_namespace on defaclnamespace, so a global default (defaclnamespace = 0, no IN SCHEMA) is dropped before the WHERE clause, and a default that opens every future table of public to a write is not found.
- Closes: TST-COR-04 (minor)
- Change: test, size S
- Files: `tools/perimeter.db-test.ts`
- Symbols: ARMS
- Comes after: U-TST-07 (wave 5): TST-07 moves the root perimeter arms into audit-arm.db-test.ts and deletes the root file; the arm fix goes in the new place.
- Regression risk: Without the coalesce on the label, the concatenation gives NULL for a global row and the findings zod parse throws instead of reporting the fault.
- Proof test: tools/perimeter.db-test.ts: in a rolled-back transaction ALTER DEFAULT PRIVILEGES FOR ROLE gabriel_owner GRANT INSERT ON TABLES TO gabriel_app (no IN SCHEMA); the arm query returns a row after the fix and [] before it.
- Critic: The file list names tools/perimeter.db-test.ts. U-TST-07 deletes that file and moves its arms into tools/perimeter/audit-arm.db-test.ts. Write the fix in audit-arm.db-test.ts. The EXEMPT_CASCADES and top-level await move with the arms.

#### U-TST-22: The inherited-position census proves that each claimed row draws and that at least one claim exists

- Root cause: The census compares claimed <= drawable, two totals, and accepts claimed = 0, so it does not state per row that a borrowing entity has a geometry and does not state that the fixture pair loaded.
- Closes: TST-TST-07 (minor)
- Change: test, size S
- Files: `tools/inherited-position.db-test.ts`
- Symbols: CENSUS
- Comes after: U-TST-15 (wave 5): TST-15 rewrites inherited-position.db-test.ts to the probe helper; new census tests use it.
- Regression risk: On an empty database (no fixture load) claimed > 0 fails; this is the same dependency as U-TST-16.
- Proof test: Against a database with no inherited row, the census fails after the fix (claimed > 0) and passes before it.

#### U-TST-25: The database key-shape test refuses camelCase, a leading underscore and a double underscore

- Root cause: The only database key-shape test uses 'Russian Designation', which fails on the space, so a change of attrs_valid to a case-insensitive match or to [a-zA-Z] or a looser underscore rule passes every database test.
- Closes: TST-SIM-02 (minor)
- Change: test, size S
- Files: `tools/open-vocabulary.db-test.ts`
- Symbols: key-shape rejects test
- Comes after: U-TST-15 (wave 5): The new key-shape test in open-vocabulary.db-test.ts uses the shared probe helper.
- Regression risk: None; the new cases pass at HEAD.
- Proof test: The new cases pass at HEAD; with the attrs_valid operator changed to !~* in a scratch migration, the coalStock case fails.

#### U-WRI-05: reject_proposal raises 'proposal % does not exist' for an unknown id, as promote_proposal does

- Root cause: reject_proposal has one branch for an UPDATE that finds no row, so an unknown id and a decided id give the same 'a decided act is frozen' message.
- Closes: WRI-COR-06 (minor)
- Change: schema, size S
- Files: `db/apply/40_functions.sql`, `packages/writer/src/writer.db-test.ts`
- Symbols: reject_proposal
- Regression risk: A caller or test that expects the frozen sentence for an unknown id on reject-proposal changes its answer, and the apply step must run again on the local stack.
- Proof test: writer.db-test.ts: POST /write/reject-proposal {proposalId:'00000000-0000-4000-8000-000000000000'} expects [409, 'the record holds no act under that name'] (before: 'the act is decided already, and a decided act is frozen').

#### U-CON-18: The deadline test shows that timeoutMs aborts the call

- Root cause: The test at client.test.ts:421-428 asserts only that the signal is an AbortSignal, so an ignored timeoutMs passes.
- Closes: CON-TST-08 (nit)
- Change: test, size S
- Files: `packages/model/src/client.test.ts`
- Symbols: roundTrip signal
- Comes after: U-CON-06 (wave 1): Same settings shape change; the deadline test covers waitOf and timeoutMs together.
- Regression risk: A timer-based test can be flaky if the timeout is too close to the stub delay.
- Proof test: A stub send that waits for init.signal to abort, with timeoutMs 50, gives a network retry; it fails when the signal ignores timeoutMs.

#### U-REV-29: One act-words module names a subject for both the queue and the history

- Root cause: decided.ts has its own copy of short, entityWords, the relation phrase and the merge phrase from queue.ts, and both print the raw relation type.
- Closes: REV-SIM-08 (proposal)
- Change: refactor, size M, removes or moves code
- Files: `src/features/review/act-words.ts`, `src/features/review/queue.ts`, `src/features/review/decided.ts`, `src/features/review/decided.test.ts`
- Symbols: short, entityWords, relationWords, relationPhrase, payloadHeadline, subjectOf, labelOf, changeOf
- Regression risk: The wording changes from 'berthed_at' to 'berthed at', and the null-type fallback 'is linked to' must stay.
- Proof test: decided.test.ts and queue.test.ts: the same relation act gives the same phrase on both pages, with the type 'berthed at'.

#### U-TST-08: Rename TWELVE_VIEWS to a name with no count

- Root cause: The constant is named for twelve views but holds eleven, and the test title says eleven.
- Closes: TST-SIM-13 (nit), TST-TST-15 (nit)
- Change: refactor, size S, removes or moves code
- Files: `tools/perimeter/audit-arm.db-test.ts`
- Symbols: TWELVE_VIEWS
- Regression risk: None beyond a missed second reference, which typecheck finds.
- Proof test: No behaviour change: 'gabriel_read holds SELECT on the eleven api views and nothing else' stays green, and `pnpm typecheck` passes.

#### U-WRI-03: failureFrom accepts a failure as raised only when it is a pg DatabaseError

- Root cause: raisedBy reads any five-character upper-case code as a server SQLSTATE, so a Node errno such as EBADF, EINTR or EPERM that is not in DOUBTFUL is read as a refusal.
- Closes: WRI-COR-07 (nit)
- Change: service, size S
- Files: `packages/writer/src/refusal.ts`, `packages/writer/src/refusal.test.ts`
- Symbols: raisedBy, failureFrom, STATE, DOUBTFUL
- Comes after: U-WRI-04 (wave 5): WRI-04 creates refusal.test.ts and the writer-unit project and moves the failureFrom tests; WRI-03 adds its tests there.
- Regression risk: A real server refusal that does not arrive as a DatabaseError instance (for example a wrapped error) becomes a doubt, and the fixtures that pass plain objects with a code must change to DatabaseError instances.
- Proof test: refusal.test.ts: failureFrom(Object.assign(new Error('x'), {code:'EBADF'})) expects raised false; failureFrom of a DatabaseError with code '23505' expects raised true.

### Wave 7

#### U-REV-01: The review card shows every value that the promotion of a create_entity or create_relation act writes

- Root cause: payloadOf in src/shared/read/map.ts keeps only type/label/attrs for an entity act and only type/src_id/dst_id for a relation act, and changeOf in queue.ts draws only a type headline. So the label, geom, relation attrs, valid_from/valid_to and src_kind/dst_kind reach the record unseen, the link-sources hole says something false, and endpoint words ignore the endpoint kind (M4).
- Closes: REV-ARC-01 (major), REV-ARC-02 (major), REV-COR-01 (major), REV-COR-02 (major), REV-SEC-01 (major), REV-SEC-02 (major), REV-SIM-01 (major), REV-SIM-02 (major), REV-SIM-03 (major), REV-ARC-03 (minor), REV-ARC-06 (minor)
- Change: service, size L
- Files: `src/shared/read/map.ts`, `src/shared/read/model.ts`, `src/shared/read/map.test.ts`, `src/features/review/queue.ts`, `src/features/review/queue.test.ts`, `src/features/review/decided.ts`, `src/features/review/decided.test.ts`, `src/shared/committed-fixture/corpus.ts`
- Symbols: entityPayload, relationPayload, payloadOf, ProposalPayload, changeOf, labelOf, entityWords, HOLE['link-sources'], keysOf, subjectOf, relationWords
- Comes after: U-REV-29 (wave 6): REV-29 moves labelOf, entityWords and relationWords into act-words.ts; REV-01 fixes them in the new place.
- Regression risk: Adding fields to ProposalPayload and new rows on creation cards can change subject labels, the name sort and the story text that the review stories assert.
- Proof test: New queue.test.ts: readQueue over a create_entity act with label 'MV Northern Ledger' and a geom point must give a subject label and Name/Location rows with those values; over a create_relation act with attrs share_pct, valid_from 2019-04-01 and dst_kind 'relation' must give attr and date rows, no 'link-sources' hole, and no 'an entity absent from the record' words. A map.test.ts case asserts that payloadOf keeps geom and the relation keys.

#### U-WRI-02: The sign door reads each lost answer as a doubt (failureFrom), keeps the real cause past a failed ROLLBACK, and the browser shows a doubt as unknown

- Root cause: sign.ts sends each failure of the propose and promote transactions only to refusalFrom, and inTransaction awaits ROLLBACK with no catch. So a lost COMMIT is reported as a refusal, or as 'nothing was written'.
- Closes: WRI-COR-01 (major), WRI-TST-02 (major), WRI-TST-04 (major), XC-TST-05 (major), WRI-ARC-02 (minor), WRI-COR-02 (minor), WRI-COR-03 (minor), WRI-SIM-02 (minor), XC-COR-04 (minor), XC-COR-05 (minor), XC-TST-13 (minor)
- Change: service, size M
- Files: `packages/writer/src/sign.ts`, `packages/writer/src/sign.test.ts`, `packages/writer/src/decide.test.ts`, `src/shared/write/door.ts`, `src/shared/write/door.test.ts`, `packages/writer/src/doors.test.ts`, `vitest.config.ts`
- Symbols: inTransaction, sign, SignedAct, SignedRefusal, doubtfulOf, outcomeOf, WriteOutcome, decide
- Comes after: U-CON-13 (wave 1): CON-13 changes the writeRequest use in sign.ts; WRI-02 rewrites sign.ts on top of it. U-WRI-03 (wave 6): WRI-02 routes each lost answer through failureFrom; failureFrom must first classify only pg DatabaseError as raised. U-TST-19 (wave 1): TST-19 rewrites vitest.config.ts projects; WRI-02's config change goes on the new structure.
- Regression risk: A raised SQL refusal (for example 23503 at propose time) can be misread as a doubt, or the browser can show 'unknown' for a real refusal, if the reply shape that separates a doubt from a refusal is not read the same way on both sides. A new doubt outcome for the first transaction must map to a status and a client state that src/shared/write/door.ts already reads, or the screen shows the wrong message.
- Proof test: sign.test.ts: a stub Pool whose client rejects the first COMMIT (propose) and then the second COMMIT (promote) with {code:'ECONNRESET'}, and whose ROLLBACK rejects with a codeless Error, expects outcome 'undecided' with the DOUBT sentence (never 'refused', never 'nothing was written'); a stub that rejects propose_change with {code:'23503'} still expects 'refused'. decide.test.ts: a stub that rejects promote_proposal with ECONNRESET expects 'undecided' with proposalId. door.test.ts: a 409 doubt reply maps to state 'unknown'. doors.test.ts: a stub Pool whose client rejects the promotion with {code:'ECONNRESET'} gives 409, the proposalId and the DOUBT sentence. A reject on the first COMMIT gives a doubt and not a 422. A connect() that rejects gives 503 for sign and decide. These cases fail at HEAD.
- Merged from U-XC-09: merge: The same defect in the same symbols (sign, inTransaction, SignedAct), including its route-level tests.

#### U-TST-06: The cascade arm also reads ON UPDATE actions and SET NULL / SET DEFAULT

- Root cause: The foreign-key arm reads only confdeltype = 'c', so an ON UPDATE CASCADE (the fault measured on the ticket that 0003_tables.sql names) or an ON DELETE SET NULL / SET DEFAULT on an evidentiary row passes.
- Closes: TST-TST-05 (minor)
- Change: test, size S
- Files: `tools/perimeter.db-test.ts`
- Symbols: ARMS, EXEMPT_CASCADES
- Comes after: U-TST-07 (wave 5): TST-07 moves the cascade arm; the fix goes in the new place.
- Regression risk: A foreign key that today uses SET NULL or ON UPDATE CASCADE on purpose (not on an evidentiary child) makes the arm fail until it is named in EXEMPT_CASCADES.
- Proof test: tools/perimeter.db-test.ts: in a rolled-back transaction recreate entities_type_fkey with ON UPDATE CASCADE; the arm returns 'entities_type_fkey' after the fix and [] before it.
- Critic: The file list names tools/perimeter.db-test.ts, which U-TST-07 deletes. Write the fix in tools/perimeter/audit-arm.db-test.ts.

#### U-TST-09: The read-service tests cover every api view and every definer door, and tell an absent door from a door called with wrong arguments

- Root cause: tools/service/read-api.db-test.ts holds hand-written subsets (8 of 11 views, 4 of 8 doors), sends '{}' to each door, and read-api.ts keeps only code and message, so a door exposed in api with named parameters gives the same PGRST202 answer as an absent door.
- Closes: TST-COR-06 (minor), TST-SEC-04 (minor), TST-TST-09 (minor)
- Change: test, size M
- Files: `tools/service/read-api.db-test.ts`, `tools/service/read-api.ts`, `tools/perimeter/audit-arm.db-test.ts`, `tools/perimeter/role-privilege.db-test.ts`
- Symbols: VIEWS, DOORS, failureShape, ReadApiAnswer, THE_DOOR_SET
- Comes after: U-TST-08 (wave 6): TST-08 renames TWELVE_VIEWS in audit-arm.db-test.ts; TST-09 then uses the new name.
- Regression risk: api.job or api.full_graph can be empty on a fresh fixture load, so a 'non-empty rows' assertion on them can give a false failure; a shared list export can create an import cycle between test files.
- Proof test: tools/service/read-api.db-test.ts: in the 'write door is not reachable at rpc' test, POST rpc/neighbourhood with '{}' must be told apart from rpc/put_document (hint non-null for the present function); before the fix the two answers compare equal. The VIEWS loop names 11 views after the fix.
- Critic: If U-WRK-02 is chosen, it adds a complete_job door and changes the grants of the door set. Derive the DOORS list of TST-09 from THE_DOOR_SET or from the catalogue, not from a copied literal. Then the lifecycle change does not make the test stale.

#### U-WRI-13: Test the no-op resolution of groundOfColumns for a word that is not a live type, and for a label-only update

- Root cause: The only no-op test sends a live type equal to the stored type, so the 'unknown' and proposed_type branches that the comment gives as the reason for groundOfColumns are not tested.
- Closes: WRI-TST-06 (minor)
- Change: test, size S
- Files: `packages/writer/src/writer.db-test.ts`
- Symbols: groundOfColumns
- Regression risk: The test adds accepted proposals to the ledger until U-WRI-10 is settled.
- Proof test: writer.db-test.ts: retype an entity to 'tanker' (not live, so type 'unknown', proposed_type 'tanker'), then post {targetId, type:'tanker'} and expect [422, UNCHANGED]; a naive request.type !== held.type check fails it.

#### U-CON-19: The log of the raw cause and sentenceOf are tested

- Root cause: client.test.ts replaces console.error with a no-op and never reads the spy, and sentenceOf has no test, so the only diagnostic of a transport fault can disappear.
- Closes: CON-TST-09 (nit)
- Change: test, size S
- Files: `packages/model/src/client.test.ts`
- Symbols: failureOf, sentenceOf
- Comes after: U-CON-06 (wave 1): Same settings shape change in client.test.ts.
- Regression risk: None; tests only.
- Proof test: A send that rejects with new Error('fetch failed', { cause: new Error('ECONNREFUSED') }) makes the console.error spy receive kind 'network' and a cause that contains 'ECONNREFUSED'.

#### U-DET-26: RecordRow drops its unused kind and key, Dossier drops claimCount, and the typeWords alias goes

- Root cause: RecordRow carries a one-member kind and a key that no code reads, claimCount always equals rows.length, and typeWords only renames relationTypeWords.
- Closes: DET-ARC-11 (proposal), DET-SIM-08 (proposal)
- Change: refactor, size S, removes or moves code
- Files: `src/features/detail/dossier.ts`, `src/features/detail/detail-page.tsx`, `src/features/detail/sidebar.tsx`, `src/features/detail/detail-page.stories.tsx`, `src/features/detail/sidebar.stories.tsx`
- Symbols: RecordRow, Dossier, claimCount, typeWords, readDossier
- Regression risk: A consumer outside src/features/detail that reads claimCount or RecordRow.key breaks at compile time.
- Proof test: None: behaviour-preserving; pnpm typecheck and the existing detail and sidebar stories pass.

#### U-TST-23: The tie-break test names which parent wins

- Root cause: The tie-break test reads DRAWN twice in one snapshot and compares the two reads, which are equal with or without the ancestor_id term in the view's ORDER BY, so the identifier tie-break is not pinned.
- Closes: TST-TST-08 (nit)
- Change: test, size S
- Files: `tools/inherited-position.db-test.ts`
- Symbols: tie-break test
- Comes after: U-TST-15 (wave 5): Same file and helper as TST-22.
- Regression risk: If the comparison of uuids in JS differs from the uuid ordering in PostgreSQL, the test gives a false failure; compare the uuid strings in lower case, which sorts the same as uuid order.
- Proof test: Remove w.ancestor_id from the view's ORDER BY in a scratch apply: the new assertion fails for a parent pair where the plan returns the larger uuid; the old test passes.

### Wave 8

#### U-DET-19: The hint after a refused deletion reads the refusal kind, not an English word

- Root cause: refusedWords selects the next step with refusal.includes('endpoint') because door.ts drops the 409/blocked status from the refused outcome.
- Closes: DET-ARC-06 (minor), DET-TST-13 (nit)
- Change: contract, size M
- Files: `src/shared/write/door.ts`, `src/features/detail/structure.ts`, `src/features/detail/save.ts`, `src/features/detail/detail-page.stories.tsx`
- Symbols: WriteOutcome, doubtfulOf, refusedWords, structureSaid, NEXT
- Comes after: U-WRI-02 (wave 7): Both change WriteOutcome and doubtfulOf in door.ts; the writer-side outcome goes first. U-REV-30 (wave 1): REV-30 changes the save.ts call site; DET-19 then edits save.ts on the new form.
- Regression risk: Every other reader of WriteOutcome (save, creation, review) must accept the new field, and a wrong status map drops the hint on the real endpoint refusal.
- Proof test: detail-page.stories.tsx: a 409 blocked delete_relation shows NEXT.delete_relation; a 422 refusal that contains the word 'endpoint' shows no hint.

#### U-REV-05: The history names a promoted relation deletion from the prior row that the act keeps

- Root cause: subjectOf in decided.ts returns relationWords for a relation delete before it reads act.priorValue, and relationWords only looks in the live corpus, where the deleted relation no longer is.
- Closes: REV-COR-06 (minor), REV-SIM-06 (nit)
- Change: frontend, size S
- Files: `src/features/review/decided.ts`, `src/features/review/decided.test.ts`
- Symbols: subjectOf, relationWords, destroyedLabel
- Comes after: U-REV-29 (wave 6): REV-29 moves subjectOf and relationWords; REV-05 fixes them in the new place.
- Regression risk: A prior row with a missing type or end must still fall back to the id words and not throw.
- Proof test: decided.test.ts: a promoted delete_relation whose target is absent from the corpus and whose priorValue row holds type 'owns', src_id A, dst_id B gives the subject 'A owns B', not 'A relation absent from the record'.

#### U-WRI-15: Read back confidence and dissent of an operator act in the writer tests

- Root cause: The helper decided selects only status, author_role and prior_value, so a regression that gives an operator act a machine score or a dissent flag stays green.
- Closes: WRI-TST-07 (minor)
- Change: test, size S
- Files: `packages/writer/src/writer.db-test.ts`
- Symbols: decided
- Regression risk: A wrong column name in the select fails the whole five-gestures test.
- Proof test: writer.db-test.ts: 'the five gestures reach the evidentiary layer' expects confidence null and dissent false on each act; it fails if sign.ts sends 1 or true.

#### U-WRI-16: Offline route tests for the 503 unavailable outcome and for a body that is not a JSON object

- Root cause: No test gives a pool that cannot connect, and no test sends a body that is not JSON or is JSON but not an object, so the 503 mapping, the no-leak rule and the 'not a JSON object' refusal are not proved.
- Closes: WRI-TST-09 (minor), WRI-TST-10 (nit)
- Change: test, size S
- Files: `packages/writer/src/routes.test.ts`
- Symbols: writeRoutes, sign, decide
- Comes after: U-WRI-02 (wave 7): WRI-02 changes the sign/decide outcomes; the 503 route tests pin the final mapping. U-WRI-08 (wave 1): WRI-08 changes how writeRoutes reads the body; the not-a-JSON-object test is written against the new read.
- Regression risk: None on the product code; the test file must stay in the offline writer-unit project of U-WRI-01.
- Proof test: routes.test.ts: writeRoutes with a stub pool whose connect() rejects with ECONNREFUSED expects 503 and a refusal that does not contain '127.0.0.1'; bodies 'x', '[]', 'null' and '"x"' to a write door and 'x' to a decision door expect 422 'the body is not a JSON object' (or 'the body names no act' for a parsable non-object on a decision door).

#### U-REV-31: Delete the dead 'every row is remove' branch of kindOf

- Root cause: Only a delete payload produces remove rows, and it is already stated as 'delete', so the check in the 'edit' path can never return.
- Closes: REV-SIM-11 (proposal)
- Change: refactor, size S, removes or moves code
- Files: `src/features/review/queue.ts`
- Symbols: kindOf
- Regression risk: None for reachable inputs.
- Proof test: The queue.test.ts cases of U-REV-13 stay green.

#### U-TST-24: The fixture-walk test sorts both sides with one comparator

- Root cause: The expected side is sorted with localeCompare (ICU) and the actual side with SQL ORDER BY under glibc en_US.utf8, so labels that the two collations order differently give a false failure.
- Closes: TST-COR-10 (nit)
- Change: test, size S
- Files: `tools/inherited-position.db-test.ts`
- Symbols: fixture-walk test
- Comes after: U-TST-15 (wave 5): Same file and helper as TST-22.
- Regression risk: Very low: only the order of two arrays that hold the same rows changes.
- Proof test: With a fixture pair labelled 'BA' and 'B-Unit', the test fails before the fix and passes after it.

### Wave 9

#### U-REV-09: Test sendVerdict: each verdict goes to its own door, and a hold sends nothing

- Root cause: No test imports sendVerdict, so a swap in the DOOR map or in the outcome mapping passes the suite.
- Closes: REV-TST-01 (major)
- Change: test, size S
- Files: `src/features/review/decision.test.ts`
- Symbols: sendVerdict, DOOR
- Comes after: U-DET-19 (wave 8): REV-09 pins the mapping from sendVerdict to the outcome. U-WRI-02 adds a doubt/unknown outcome and U-DET-19 adds a field to WriteOutcome in door.ts. If REV-09 runs in wave 1, its test is written against a WriteOutcome that changes two times after it. REV-09 must run after U-DET-19, which already runs after U-WRI-02.
- Regression risk: A fetch stub that does not match the door module can make the test pass for the wrong reason.
- Proof test: decision.test.ts with a stubbed fetch: 'promoted' calls /write/promote-proposal, 'rejected' calls /write/reject-proposal, 'deferred' calls fetch zero times, and an unknown outcome gives step 'unknown'. It fails when DOOR.promoted is set to 'reject_proposal'.

## After the operator decisions

#### U-WRK-04: Test the reconcileCorpus mismatch lists and the disagreement report

- Root cause: The only reconcile test uses an empty bucket and zero rows, so the set-difference filters never get data.
- Closes: WRK-TST-01 (major), XC-TST-03 (major)
- Change: test, size S
- Files: `packages/worker/src/reconcile.test.ts`
- Symbols: reconcileCorpus
- Comes after: U-DB-27 (not in a wave): reconcileCorpus depends on listKeys; the listing decision sets what the reconcile test covers.
- Regression risk: A test-only change, so it can break nothing in production. None at runtime. The test can break if the RawStore fake shape changes.
- Proof test: New packages/worker/src/reconcile.test.ts: a fake store with keys ['a','b'] and rows [{id:X, s3_key:'b'},{id:Y, s3_key:'c'}]. Assert objectsWithNoRow = ['a'] and rowsWithNoObject = [{documentId:Y, key:'c'}]. The test fails against a stub that always returns two empty lists. A store fake lists keys a and b, the rows cite b and c, and the test asserts objectsWithNoRow ['a'] and rowsWithNoObject [{documentId, key 'c'}]. It fails if the filters are swapped or return empty lists.
- Merged from U-XC-04: merge: The same missing test in reconcile.test.ts.
- Waits for: U-DB-27

#### U-DET-02: pendingEdit compares the parsed value with the stored value, and draft.ts gets its unit test

- Root cause: pendingEdit skips a draft only when the raw typed text equals the stored text, before readEntry normalizes it, so a format-only change ('41.50', 'Acme ', 'a,b') is sent and the writer adds 'manual' to an unchanged claim.
- Closes: DET-COR-02 (major), DET-TST-02 (major)
- Change: frontend, size S
- Files: `src/features/detail/draft.ts`, `src/features/detail/draft.test.ts`
- Symbols: pendingEdit, PendingEdit
- Comes after: U-CON-01 (not in a wave): CON-01 changes how the writer merges sources and edits pendingEdit; DET-02 compares parsed values against the new rule. U-DET-03 (wave 2): DET-03 changes readEntry and typedValue; pendingEdit then compares the new parsed value.
- Regression risk: A wrong equality test for lists or booleans can hide a real change so that Save stays disabled.
- Proof test: draft.test.ts: stored 41.5 with draft '41.50' gives { ready: false, reason: NOTHING_CHANGED }; one refused draft plus one valid draft gives ONE_IS_REFUSED; a draft typed back to the stored text is skipped.
- Waits for: U-CON-01

#### U-DET-05: The Pending band counts every pending act on a relation that touches the entity

- Root cause: names() resolves the target relation and tests touches() only for update_relation, so delete_relation and update_attrs with targetKind 'relation' return false and the empty state says 'none was dropped'.
- Closes: DET-TST-03 (major), DET-ARC-01 (minor), DET-COR-06 (minor), DET-SIM-05 (minor)
- Change: frontend, size M
- Files: `src/features/detail/dossier.ts`, `src/features/detail/dossier.test.ts`
- Symbols: readDossier, names, PendingLine
- Comes after: U-DB-41 (not in a wave): names() in dossier.ts resolves the relation for update_relation only; the fix must be written against the op set that the decision keeps.
- Regression risk: A pending act on a relation can now show on both end entities, which changes the pending counts in stories that derive them from DOSSIER.
- Proof test: dossier.test.ts: a literal corpus with a pending delete_relation and a pending update_attrs on a relation of entity E gives pending.length 2 for E; the update_relation, merge_ids, status filter, null-confidence and typeChoicesOf cases have exact expected values.
- Waits for: U-DB-41

#### U-DB-11: Offline store tests cover the listKeys page loop and the fault wrap

- Root cause: No test gives a store response with a continuation token or a rejected send, so the pagination loop, the REFUSED wrap and the key trim are unguarded.
- Closes: DB-TST-09 (minor), DB-TST-10 (minor)
- Change: test, size S
- Files: `packages/store/src/store.test.ts`, `vitest.config.ts`
- Symbols: listKeys, putObject, named
- Comes after: U-DB-27 (not in a wave): If the store account may not list the bucket, listKeys and its page loop change or go; test it after the decision. U-TST-19 (wave 1): TST-19 rewrites vitest.config.ts; the store offline tests are then picked up by the wide globs.
- Regression risk: A new vitest project with a wrong include pattern runs the db tests without a database.
- Proof test: packages/store/src/store.test.ts: a two-page stub returns keys of both pages; a rejecting stub makes putObject and listKeys throw the fixed REFUSED sentence with the fault as cause; a key with outer spaces is written and returned trimmed.
- Waits for: U-DB-27

#### U-DB-29: Correct the comments that describe a schema that no longer exists

- Root cause: Comments still describe attribute_key and a 'declared' column (dropped in 0010), say #86 is open (S2 decides it), and say no path writes 'failed' or holds the claim door.
- Closes: DB-ARC-10 (minor), DB-ARC-16 (nit), DB-SIM-11 (proposal)
- Change: docs, size S
- Files: `db/apply/40_functions.sql`, `db/apply/20_views.sql`, `db/migrations/0004_jobs.sql`
- Symbols: api.entity COMMENT, promote_proposal comments
- Comes after: U-DB-43 (not in a wave): The squash removes and rewrites 0004_jobs.sql; the comment fix must go in the file that survives. U-WRK-02 (not in a wave): The comments state which path writes 'failed' and who holds the claim door; the lifecycle decision changes these facts. U-TST-14 (wave 4): This edge replaces U-DB-29 -> U-TST-14. Both units correct the attribute_key comments in 40_functions.sql. If TST-14 goes first, DB-29 changes only the comments that remain. TST-14 then does not wait for the squash decision (U-DB-43) or for U-WRK-02.
- Regression risk: None; comments and one COMMENT ON VIEW string.
- Proof test: None; a grep for 'attribute_key` IS NOW' and 'open on #86' finds nothing.
- Waits for: U-DB-43, U-WRK-02

#### U-REV-13: Add a Node test for the queue derivation: subject kinds, labels, holes, sort order and the own-property guard

- Root cause: queue.ts has no test file. filingOf, labelOf, the holes, sortSubjects, weakestFirst and the Object.hasOwn guard have no assertion.
- Closes: REV-TST-05 (minor), REV-TST-06 (minor), REV-TST-16 (nit)
- Change: test, size M
- Files: `src/features/review/queue.test.ts`
- Symbols: readQueue, filingOf, labelOf, sortSubjects, weakestFirst, differenceOf
- Comes after: U-REV-29 (wave 6): The new queue test covers labelOf after it moves. U-REV-07 (not in a wave): The queue derivation test must not cover routing branches that the decision may remove.
- Regression risk: Label and hole text assertions must follow the wording that U-REV-01 sets, so this unit must run after it.
- Proof test: queue.test.ts: one act of each payload kind plus an update and a delete on an absent target assert subject.kind, label and hole kinds; subjects with weakest 0.4, null, 0.7 sort to [0.4, 0.7, null] under 'confidence', and 'oldest' and 'name' orders hold; an update_attrs on key 'constructor' gives op 'add' and standing null.
- Waits for: U-REV-07

#### U-REV-16: Subject-rail stories assert literal counts, the rule hue, the settled fill and the row and sort presses

- Root cause: The rail story compares the row count to the same derivation it draws, and no story reads data-count, data-rule, settledFill, onSelect or onSort.
- Closes: REV-TST-10 (minor)
- Change: test, size S
- Files: `src/features/review/subject-rail.stories.tsx`
- Symbols: SubjectRail, railRows
- Comes after: U-REV-07 (not in a wave): The rail stories assert the rule hue; the decision sets which routing hues exist.
- Regression risk: Literal counts must follow any change to the review sample.
- Proof test: The story asserts the literal subject count of the sample, data-count per kind on the TERMINAL row, data-rule='delete' on the VESSEL row, and onSort('oldest') after a click on 'oldest first'. It fails when KIND_ORDER puts 'edit' before 'delete'.
- Waits for: U-REV-07

#### U-REV-23: A merge act gets no Promote and no 'no door takes it back' text until M12 has its write path

- Root cause: Decide gets no op, so a merge act gets Promote and the irreversibility text, but promote_proposal always refuses a merge and M12 says a merge is reversible.
- Closes: REV-ARC-04 (minor)
- Change: frontend, size S
- Files: `src/features/review/decide.tsx`, `src/features/review/decision.ts`, `src/features/review/review-page.tsx`, `src/features/review/decide.stories.tsx`, `src/features/review/review-page.stories.tsx`
- Symbols: Decide, QUESTIONS, DONE, ReviewPage
- Comes after: U-DB-40 (not in a wave): The Decide rule for a merge act depends on whether a merge act can exist at all.
- Regression risk: A wrong op check can disable Promote on non-merge acts.
- Proof test: decide.stories.tsx: a merge act renders Promote disabled with a reason and no 'no door takes it back' text; a non-merge act keeps Promote enabled.
- Waits for: U-DB-40

#### U-TST-20: The creating-citation test knows that an update_entity promotion replaces the row-level sources

- Root cause: known-gap.db-test.ts expects every entity's sources to equal the src of its creating act and excludes only update_attrs from the untouched CTE, but since migration 0013 an accepted update_entity sets sources = p.src (revised S2). The first accepted rename that cites another document turns the test red, and the test cannot find a promotion that forgets to replace the list.
- Closes: TST-TST-02 (minor)
- Change: test, size S
- Files: `tools/corpus/known-gap.db-test.ts`
- Symbols: known-gap CENSUS, untouched CTE
- Comes after: U-TST-35 (not in a wave): TST-35 changes the known-gap expectation of the row-level sources of a created row. U-TST-15 (wave 5): TST-15 rewrites known-gap.db-test.ts to the probe helper.
- Regression risk: If the latest-update comparison uses decided_at ties or pending acts, it can report a false row.
- Proof test: tools/corpus/known-gap.db-test.ts: in a rolled-back transaction promote an update_entity rename that cites a document outside the creating src; rows_that_leave_the_creating_citation stays 0 after the fix and is 1 before it; a promotion that leaves the old sources is reported after the fix.
- Waits for: U-TST-35

#### U-TST-28: The reference rule also refuses a path from the root to a source file, and the 13 such comments get a reason instead

- Root cause: SHAPES catches a path only when it starts with ./ or ../ or ends in .md, so a comment that names src/index.css or features/map/adapter.ts passes, although ADR 0006 §2 says a path is an address.
- Closes: TST-ARC-04 (minor)
- Change: tooling, size M
- Files: `eslint.config.ts`, `src/routes/graph.tsx`, `src/routes/map.tsx`, `src/features/detail/relation-sidebar.stories.tsx`, `src/features/graph/controller.ts`, `src/features/graph/model.ts`, `src/features/map/adapter.ts`, `src/features/detail/field.stories.tsx`, `src/features/detail/pending.stories.tsx`, `.storybook/preview.ts`
- Symbols: SHAPES, local/no-reference-in-comment
- Comes after: U-TST-10 (wave 1): Both change SHAPES in eslint.config.ts; the smaller fix first. U-TST-32 (not in a wave): The scope of the reference rule (src, packages, .storybook) decides which comments TST-28 must rewrite. U-REV-24 (wave 1): REV-24 removes the source paths from graph.tsx comments; TST-28 then has one fewer file and no duplicate fix.
- Regression risk: A path shape that is too wide can refuse a URL, a MIME type or a phrase such as 'and/or' in a comment and fail lint on many files.
- Proof test: `pnpm lint` reports local/no-reference-in-comment on src/routes/graph.tsx:15 after the rule change and passes after the 13 comments are rewritten; before the change it reports nothing.
- Waits for: U-TST-32

#### U-XC-11: The writer tests read back geom, the attributes and the row-level sources after a promoted create-entity

- Root cause: The create-entity and five-gestures tests send a geom but no test reads entities.geom (or the attribute and sources) after a promotion.
- Closes: DB-TST-11 (minor), XC-TST-12 (minor)
- Change: test, size S
- Files: `packages/writer/src/writer.db-test.ts`
- Symbols: sign, proposalAct, promote_proposal
- Comes after: U-TST-35 (not in a wave): XC-11 reads back the row-level sources after a promoted create-entity; the expected value depends on the decision.
- Regression risk: None at runtime. None beyond the test itself.
- Proof test: Right after the create, read ST_AsGeoJSON(geom), attrs and sources::text[] and assert with toStrictEqual: Point [4.05, 51.95], {berth_count:{v:2,src:['manual']}} and ['manual']. The test fails if the writer drops geom or the manual source. writer.db-test.ts: SELECT ST_SRID(geom), ST_AsText(geom) asserts 4326 and POINT(4.05 51.95).
- Merged from U-DB-17: merge: Both add the same read-back of the promoted geometry in packages/writer/src/writer.db-test.ts.
- Waits for: U-TST-35

#### U-DB-22: A database test shows that a merge_entities act is refused at promotion and stays pending

- Root cause: No test promotes a merge act and asserts the refusal and no row change.
- Closes: DB-TST-17 (nit)
- Change: test, size S
- Files: `tools/merge-refused.db-test.ts`
- Symbols: promote_proposal
- Comes after: U-DB-40 (not in a wave): U-DB-40 edits tools/merge-refused.db-test.ts; if merge_entities leaves the op CHECK, the 'refused at promotion' test changes or goes.
- Regression risk: The test breaks if U-DB-40 is accepted and not updated with it.
- Proof test: tools/merge-refused.db-test.ts: propose merge_entities, promote, assert 'has no write path yet', status pending and unchanged entities.
- Waits for: U-DB-40

#### U-DB-23: Drop proposals_value_not_reserved and attrs_cites_reserved, which the other two rules imply

- Root cause: proposals_src_within plus proposals_machine_not_reserved imply the value-level rule, so it can never refuse a row alone.
- Closes: DB-TST-18 (proposal)
- Change: schema, size S, removes or moves code
- Files: `db/migrations/0018_drop_value_not_reserved.sql`, `src/db/public/attrs_cites_reserved.ts`
- Symbols: proposals_value_not_reserved, attrs_cites_reserved
- Comes after: U-TST-35 (not in a wave): DB-23 drops proposals_value_not_reserved because proposals_src_within implies it; TST-35 may change proposals_src_within.
- Regression risk: A later loosening of proposals_src_within must restore a value-level rule, or an agent can hide a reserved id in a value.
- Proof test: tools/perimeter/role-privilege.db-test.ts: an agent value that cites 'manual' is still refused (by proposals_src_within or proposals_machine_not_reserved) after the drop.
- Waits for: U-TST-35

#### U-DB-34: The attrs_valid header labels the flat-list rule M7, not M9

- Root cause: 0002_types.sql:32 gives the depth rule the M9 identifier.
- Closes: DB-ARC-17 (nit)
- Change: docs, size S
- Files: `db/migrations/0002_types.sql`
- Symbols: attrs_valid
- Comes after: U-DB-43 (not in a wave): The squash removes and rewrites 0002_types.sql; the comment fix must go in the file that survives.
- Regression risk: None; a comment in an applied migration.
- Proof test: None; documentation only.
- Waits for: U-DB-43

#### U-CON-20: The two-column update_entity test compares the full act

- Root cause: payload.test.ts:28-31 uses toMatchObject, so an extra payload key or a wrong src, targetKind or targetId passes.
- Closes: CON-TST-11 (nit)
- Change: test, size S
- Files: `packages/proposal/src/payload.test.ts`
- Symbols: proposalAct update_entity test
- Comes after: U-CON-01 (not in a wave): CON-01 changes the act that proposalAct builds; the full-act comparison test must pin the new act.
- Regression risk: None; tests only.
- Proof test: Replace toMatchObject with toStrictEqual on the full act; it fails when the update_entity branch spreads ...request into the payload.
- Waits for: U-CON-01

#### U-WRK-07: Declare the Queryable type alias once in the worker package

- Root cause: type Queryable = Pick<Pool, 'query'> is declared separately in each worker module.
- Closes: WRK-SIM-05 (proposal), XC-SIM-07 (proposal)
- Change: refactor, size S, removes or moves code
- Files: `packages/worker/src/claim.ts`, `packages/worker/src/layout-job.ts`, `packages/worker/src/reconcile.ts`, `packages/worker/src/queryable.ts`, `packages/worker/src/run-once.ts`, `packages/worker/src/run-once.test.ts`
- Symbols: Queryable
- Comes after: U-WRK-01 (not in a wave): WRK-07 edits run-once.ts and run-once.test.ts, which WRK-01 removes.
- Regression risk: A type-only change. At most it can cause an import cycle or a type-check failure. An import path error breaks the typecheck. Nothing changes at runtime.
- Proof test: pnpm typecheck passes, and a grep finds exactly one declaration of 'type Queryable' in packages/worker/src. pnpm typecheck and pnpm lint pass, and a grep finds one declaration of Queryable in packages/worker/src.
- Merged from U-XC-06: merge: The same refactor of the same symbol. Do it after U-WRK-01, which deletes run-once.ts.
- Waits for: U-WRK-01

#### U-DB-33: SQL comments stop naming a closed ticket as the owner of an open question

- Root cause: Comments name #43, #42, #95, #41 and #31 as owners after they closed.
- Closes: DB-ARC-15 (minor)
- Change: docs, size S
- Files: `db/apply/60_triggers.sql`, `db/apply/90_grants.sql`, `db/apply/40_functions.sql`, `db/apply/20_views.sql`
- Symbols: comments
- Comes after: U-DB-29 (not in a wave): Both rewrite the same stale comments in 40_functions.sql and 20_views.sql; one order prevents a duplicate fix. U-DB-24 (not in a wave): The #95 comment in 20_views.sql must state the operator decision; DB-33 then does not rewrite it twice.
- Regression risk: None; comments only.
- Proof test: None; a grep for the five ticket numbers in db/apply finds only open owners.
- Waits for: U-DB-24, U-DB-43, U-WRK-02

## Operator decisions

#### U-DB-09: [operator_decision vs ADR 0002 §7] Each process loads only the secrets it needs

- Root cause: Each entry point starts with --env-file=infra/.env, so the worker holds the gabriel_app, superuser and MinIO root secrets, contrary to the premise in 90_grants.sql.
- Closes: DB-SEC-01 (major), XC-SEC-02 (minor)
- Change: tooling, size M
- Files: `package.json`, `infra/.env.example`, `infra/worker.env.example`, `infra/writer.env.example`, `db/apply/90_grants.sql`, `docs/adr/0002-local-runtime.md`, `tools/db-runtime.ts`
- Symbols: worker:layout, worker:reconcile, writer, layout, reconcile
- Comes after: U-WRK-01 (not in a wave): WRK-01 removes the worker:layout and worker:reconcile scripts in package.json that DB-09 would give their own env file.
- Regression risk: A script that loses a variable it reads fails at start. A process that loses a variable it reads (for example, RAW_STORE keys for reconcile) fails at start.
- Proof test: A test that starts the worker env and asserts that GABRIEL_APP_PASSWORD, POSTGRES_PASSWORD and MINIO_ROOT_PASSWORD are absent from process.env. A tooling test starts each worker entry point with its env file and asserts that process.env has no GABRIEL_APP_PASSWORD, POSTGRES_PASSWORD or MINIO_ROOT_PASSWORD. The test fails at HEAD.
- Merged from U-XC-13: merge: The same finding, with the same scripts and env example files.
- Conflicts with: ADR 0002 §7
- Why the operator must decide: ADR 0002 §7 decides that every entry point loads the environment file whole and that the account bounds the client, not the process. One env file per process reverses that decision.

#### U-DB-24: Amend ADR 0003 §6 as #95 decided, then make the views comment state the decision

- Root cause: #95 decided that no view carries security_invoker, but ADR 0003 §6 still asks for it and the SQL comment names #95 as pending.
- Closes: DB-ARC-04 (minor)
- Change: docs, size S
- Files: `docs/adr/0003-schema-pipeline-and-read-contract.md`, `db/apply/20_views.sql`
- Symbols: api views header comment
- Regression risk: None; text only.
- Proof test: None; documentation only.
- Conflicts with: ADR 0003 §6
- Why the operator must decide: The operator owns docs/ and must write the ADR amendment that #95 drafted. Only then can the 20_views.sql comment change.

#### U-DB-25: Record why the first migration does not create pgvector

- Root cause: ADR 0002 §2 says the first migration creates PostGIS and pgvector; 0001 creates no pgvector and says nothing.
- Closes: DB-ARC-05 (minor)
- Change: docs, size S
- Files: `docs/adr/0002-local-runtime.md`, `db/migrations/0001_extensions_and_roles.sql`
- Symbols: CREATE EXTENSION
- Regression risk: An edit of the applied 0001 does not reach a running database.
- Proof test: None; documentation only.
- Conflicts with: ADR 0002 §2
- Why the operator must decide: The fix is an amendment to ADR 0002 §2 (pgvector comes with the first vector column) or a new migration. The operator chooses.

#### U-DB-26: [operator_decision vs ADR 0003 §7] Record that gabriel_agent holds the layout, claim and fail doors, including the entity_layout write through set_entity_layout

- Root cause: ADR 0003 §7 limits gabriel_agent to the candidate layer, but the role holds doors that write jobs and entity_layout, and no decision records the exception.
- Closes: DB-ARC-06 (minor), TST-ARC-02 (minor), WRK-ARC-04 (minor)
- Change: docs, size S
- Files: `docs/adr/0003-schema-pipeline-and-read-contract.md`, `docs/adr/0004-graph-layout.md`, `docs/decisions.md`, `docs/adr/0004-frontend-stack.md`, `db/apply/90_grants.sql`
- Symbols: gabriel_agent, ADR 0003 §7, set_entity_layout, entity_layout, THE_DOOR_SET
- Comes after: U-WRK-02 (not in a wave): The record of gabriel_agent doors must list the door set after the lifecycle change of the grants.
- Regression risk: None; text only. A docs-only change, so there is no runtime risk. If the operator moves the door to gabriel_app instead, the worker's layout job loses its write and the perimeter tests must change.
- Proof test: None; documentation only. None, because this is a docs change. Check: the ADR 0003 §7 row for gabriel_agent names entity_layout as a derived presentation layer that the role writes through set_entity_layout. No behaviour change if the grant stays: the perimeter suite stays green, and a grep of docs/ finds set_entity_layout in a decision entry.
- Merged from U-WRK-09, U-TST-26: merge: All three amend the same ADR 0003 §7 row for the same grant set.
- Conflicts with: ADR 0003 §7
- Why the operator must decide: The code is intended; the ADR text is behind. The operator must amend ADR 0003 §7 and close the 'open' sentence of ADR 0004 §4.

#### U-DB-27: [operator_decision vs ADR 0002 §7] Decide whether the store account may list the bucket, then make ADR 0002 §7 and the raw-write policy agree

- Root cause: Commit 1e73ee4 added s3:ListBucket to policy-raw-write.json for reconcile, but ADR 0002 §7 still says the account has PutObject only and cannot list the bucket.
- Closes: DB-ARC-07 (minor), WRK-ARC-03 (minor), XC-SEC-03 (minor), XC-COR-09 (nit)
- Change: docs, size S
- Files: `docs/adr/0002-local-runtime.md`, `infra/minio/policy-raw-write.json`, `infra/docker-compose.yml`, `packages/store/src/bucket.ts`
- Symbols: openStore, policy-raw-write, ADR 0002 §7, ADR 0002 section 7
- Regression risk: A second account changes the env files that U-DB-09 also changes. A docs-only change, so there is no runtime risk. None at runtime.
- Proof test: None if the ADR is amended; else a store db test that the ingestion account is refused a listing. None, because this is a docs change. Check: ADR 0002 §7 names s3:ListBucket on raw and the reconcile run as its reason. A grep of docs/adr/0002-local-runtime.md finds no 'cannot list the bucket' and finds the dated ListBucket amendment.
- Merged from U-WRK-08, U-XC-14: merge: All three are about the same disagreement between the policy and ADR 0002 §7. U-WRK-08 and U-XC-14 are the 'keep the grant' result of the decision in U-DB-27.
- Conflicts with: ADR 0002 §7
- Why the operator must decide: Two options: amend ADR 0002 §7, or give reconciliation a second account. The operator chooses.

#### U-DB-28: Build the one ingestion door of P6 that writes the object and then the row

- Root cause: putObject has no caller and put_document trusts any key, so the P6 order is held by nothing.
- Closes: DB-ARC-08 (minor)
- Change: service, size L
- Files: `packages/store/src/object.ts`, `packages/writer/src/main.ts`
- Symbols: putObject, put_document
- Regression risk: A door that writes the row before the object leaves a dead reference.
- Proof test: A db test that ingests one file and asserts the object exists before the documents row and the job.
- Conflicts with: P6
- Why the operator must decide: No ingestion caller exists yet. Building the door is new scope behind the ingestion seam.

#### U-DB-30: Add the seed data-file row to ADR 0003 §3 and state that the type vocabulary is declared in TypeScript

- Root cause: 95_seed.sql asks for a third row in the ADR 0003 §3 table, and #40 closed without it.
- Closes: DB-ARC-11 (minor)
- Change: docs, size S
- Files: `docs/adr/0003-schema-pipeline-and-read-contract.md`, `db/apply/95_seed.sql`
- Symbols: 95_seed.sql header
- Regression risk: None; text only.
- Proof test: None; documentation only.
- Conflicts with: ADR 0003 §3
- Why the operator must decide: ADR 0003 has produced code, so the change is an explicit amendment that the operator writes.

#### U-DB-31: Build the rate_document write path that #19 decided, or name an open owner

- Root cause: No door writes documents.admiralty, and the comments name the closed #19 as owner.
- Closes: DB-ARC-12 (minor)
- Change: schema, size L
- Files: `db/apply/40_functions.sql`, `db/migrations/0003_tables.sql`
- Symbols: put_document, documents.admiralty
- Regression risk: A new op widens proposals_op_check, which U-DB-04, U-DB-40 and U-DB-41 also rebuild.
- Proof test: A db test that promotes a rate_document act and reads documents.admiralty.
- Conflicts with: S1, S4
- Why the operator must decide: Building rate_document adds an op to the proposal contract and a promotion branch, which is new scope.

#### U-DB-36: [operator_decision vs ADR 0001 §1] ADR 0001 §1 records the pnpm workspace that §6 permitted

- Root cause: The repository became a pnpm workspace ('.' and 'packages/*'), but §1 still says one package.
- Closes: XC-ARC-04 (minor), DB-ARC-19 (nit), TST-ARC-08 (nit), WRK-ARC-06 (nit), XC-SIM-04 (nit)
- Change: docs, size S
- Files: `docs/adr/0001-repository-conventions.md`
- Symbols: ADR 0001, ADR 0001 §1, ADR 0001 section 1
- Regression risk: None; text only. A docs-only change, so there is no runtime risk. None at runtime. None in code.
- Proof test: None; documentation only. None, because this is a docs change. Check: ADR 0001 §1 describes the workspace packages ('.' and 'packages/*') or has a dated amendment note that points to §6. ADR 0001 section 1 names packages/*/src and the conversion date, and it no longer says 'declares no package'. None (documentation only): ADR 0001 §1 names packages/* after the change.
- Merged from U-WRK-11, U-XC-16, U-TST-31: merge: Four copies of the same finding against the same ADR paragraph.
- Conflicts with: ADR 0001 §1
- Why the operator must decide: The operator owns the ADR; a housekeeping amendment.

#### U-DB-39: The audit trail does not record who decided, does not split a human from a script and does not cover documents, jobs or TRUNCATE

- Root cause: These are the accepted consequences of M5 (no modification history) and C5 (no auth).
- Closes: DB-SIM-06 (minor)
- Change: docs, size S
- Files: not given
- Symbols: not given
- Regression risk: None.
- Proof test: None.
- Conflicts with: M5, C5
- Why the operator must decide: Informational finding with no fix; only the operator can reopen M5 or C5.

#### U-DB-40: Remove merge_entities from the op CHECK until M12 builds its write path

- Root cause: The CHECK accepts an op that promotion always refuses.
- Closes: DB-SIM-07 (proposal)
- Change: schema, size M, removes or moves code
- Files: `db/migrations/0019_merge_deferred.sql`, `db/apply/40_functions.sql`, `src/shared/read/closed-set.ts`, `src/shared/read/map.test.ts`, `tools/merge-refused.db-test.ts`
- Symbols: proposals_op_check, promote_proposal, CLOSED_SET
- Regression risk: The ELSE guard must stay, or an unmatched op commits as accepted; closed-set.db-test fails if closed-set.ts is not changed with the CHECK.
- Proof test: tools/closed-set.db-test.ts passes, and propose_change('merge_entities', ...) raises 23514.
- Conflicts with: P2, M12
- Why the operator must decide: P2 lists merge as an operation kind and a rejected false alarm said the op is deliberate. The change narrows the op vocabulary.

#### U-DB-41: Remove update_relation, a second name for update_attrs

- Root cause: Promotion treats update_relation and update_attrs the same, and no writer emits update_relation.
- Closes: DB-SIM-08 (proposal)
- Change: schema, size M, removes or moves code
- Files: `db/migrations/0020_no_update_relation.sql`, `db/apply/40_functions.sql`, `src/shared/read/closed-set.ts`, `src/shared/read/model.ts`, `src/shared/read/map.ts`, `src/features/detail/dossier.ts`, `src/features/review/decided.ts`, `src/features/review/queue.ts`, `tools/applies-something.db-test.ts`
- Symbols: proposals_op_check, proposals_update_names_attrs, proposals_prior_value_shape, promote_proposal, ProposalOp
- Regression risk: Must be ordered after U-DB-04, whose CHECK names update_relation.
- Proof test: tools/closed-set.db-test.ts passes and propose_change('update_relation', ...) raises 23514.
- Conflicts with: P4
- Why the operator must decide: P4 freezes the proposal contract, and the op vocabulary is part of it.

#### U-DB-42: Drop the job failure-count columns that no path writes

- Root cause: network_failures, rejected_failures and failure_kind and their three constraints are never written.
- Closes: DB-SIM-09 (proposal)
- Change: schema, size S, removes or moves code
- Files: `db/migrations/0021_drop_job_failure_counts.sql`, `src/db/public/Jobs.ts`, `docs/decisions.md`
- Symbols: jobs.network_failures, jobs.rejected_failures, jobs.failure_kind
- Regression risk: Must land after U-DB-01 and U-DB-02, which write the jobs table.
- Proof test: pnpm db:reset and pnpm db:drift pass.
- Conflicts with: T9
- Why the operator must decide: T9's consequence keeps these columns for a retry history; the operator must edit that sentence.

#### U-DB-43: Squash the thirteen migrations into one baseline

- Root cause: Half the history creates objects that later files remove, and db/apply keeps cleanup DROPs for them.
- Closes: DB-SIM-10 (proposal)
- Change: schema, size L, removes or moves code
- Files: `db/migrations/0001_extensions_and_roles.sql`, `db/migrations/0002_types.sql`, `db/migrations/0003_tables.sql`, `db/migrations/0004_jobs.sql`, `db/migrations/0005_entity_layout.sql`, `db/migrations/0006_parameter.sql`, `db/migrations/0007_update_names_attrs.sql`, `db/migrations/0008_null_guards_stated.sql`, `db/migrations/0009_reserved_documents.sql`, `db/migrations/0010_no_attribute_key.sql`, `db/migrations/0011_retrieved_with_bytes.sql`, `db/migrations/0012_proposal_geometry.sql`, `db/migrations/0013_update_entity.sql`, `db/apply/40_functions.sql`, `db/apply/60_triggers.sql`
- Symbols: all migrations
- Regression risk: Every local database needs pnpm db:reset, and every open schema unit must be rebased on the baseline.
- Proof test: pnpm db:reset then the full db test suite passes.
- Critic: Several units in waves 1-4 add new migrations whose numbers collide: 0014 is used by U-TST-01, U-CON-04, U-DB-04, U-CON-05, U-CON-14 and U-TST-35, and the plan also adds 0015, 0016, 0017 and 0018. Give each migration its number when it merges, in merge order, not the number in the plan. If the operator chooses the squash, it must also absorb every migration that is merged before it. Decide the squash early, or apply it last, and never while schema units are still open.
- Conflicts with: ADR 0003 §3
- Why the operator must decide: The migration convention (ADR 0003, and the 0008-0010 statement that an applied file is the record) is a decision; a squash also rewrites every file the other schema units add.

#### U-CON-01: [operator_decision vs #17, S2] A changed attribute value cites only its new sources. The no-drop guard applies only to an unchanged value, states the settled rule and has a database test.

- Root cause: sourcedAttributes (payload.ts) always joins the prior src of a key with 'manual' and does not compare the new v with the prior v. The v_lost guard in promote_proposal refuses any write that drops a document, and its RAISE text and comment still say that #17 is open.
- Closes: CON-SIM-01 (blocker), XC-SIM-01 (blocker), CON-ARC-01 (major), CON-COR-01 (major), DB-SIM-01 (major), DB-TST-05 (major), DET-SIM-01 (major), WRI-SIM-01 (major), CON-TST-01 (minor), DB-ARC-09 (minor)
- Change: service, size M
- Files: `packages/proposal/src/payload.ts`, `packages/proposal/src/payload.test.ts`, `db/apply/40_functions.sql`, `packages/writer/src/writer.db-test.ts`, `packages/writer/src/refusal.ts`, `tools/drop-source.db-test.ts`, `src/features/detail/draft.ts`, `src/features/detail/save.ts`, `src/features/detail/mint.ts`, `src/features/detail/detail-page.stories.tsx`
- Symbols: sourcedAttributes, citedBy, proposalAct, promote_proposal, v_lost guard, BY_SHAPE, payload, pendingEdit, saveSaid, READS, refusal
- Comes after: U-WRI-04 (wave 5): WRI-04 removes dead BY_SHAPE entries and moves failureFrom tests; CON-01 edits refusal.ts after the cleanup.
- Regression risk: If the DB guard relaxes too far, a write that keeps the same value could drop a document and lose corroboration, and the writer refusal sentence for the guard can become stale. A value change that drops a source by mistake loses corroboration; it must land after U-DB-14. A corroborating document is lost when the operator saves the same value in a different JSON form (for example 41200 vs 41200.0), and the writer.db-test.ts assertion at lines 254-256 must change. If the database guard is loosened too far, an update that keeps v but drops a corroborating document can pass and lose corroboration. A refusal blocks every correction of an agent-written value until #17 closes; a sentence change can break stories that assert 'The value is signed manual.'. If refusal.ts is not updated with the new text, the writer shows a raw database message.
- Proof test: payload.test.ts: update_attrs with prior { imo: { v: '9482137', src: ['doc_A'] } } and edit { imo: { v: '9482138' } } expects src ['manual']; with an unchanged v expects ['doc_A','manual']; a prior that does not parse expects the UNREADABLE refusal. writer.db-test.ts:255 changes to expect coal_stock_t { v: 43500, src: ['manual'] } and the promotion succeeds. tools/drop-source.db-test.ts: a changed v with a new src replaces the list; an unchanged v that drops a source still raises. writer.db-test.ts: update-attrs {coal_stock_t:{v:43500}} on a key that holds {v:41200, src:['doc_8f2a41']} expects the row {v:43500, src:['manual']} (before: ['doc_8f2a41','manual']); the same v keeps the union. writer.db-test.ts line 255: when the analyst corrects coal_stock_t from 41200 (doc_8f2a41) to 43500, the test expects {v:43500, src:['manual']}, and prior_value keeps the old claim. A write that keeps the value unchanged still unions the sources. The test fails at HEAD. detail-page.stories.tsx: correct a claim backed by doc_A and assert either the refusal or a sentence that names doc_A as still cited. tools/drop-source.db-test.ts: set src ['doc_a'], propose an update_attrs that cites only 'doc_b', promote in a second transaction, assert the new message and unchanged attrs.
- Merged from U-DB-37, U-WRI-11, U-XC-12, U-DET-29, U-DB-14: merge: All six units describe one defect: a corrected value keeps the documents of the old value. U-DET-29 is how the detail page shows it. They change the same symbols (sourcedAttributes and the v_lost guard in promote_proposal) and the same test file (tools/drop-source.db-test.ts). U-DB-14 rewrites the RAISE text and adds the refusal test of that same guard, and this change rewrites the guard. Two separate fixes would conflict.
- Conflicts with: #17, S2
- Why the operator must decide: #17 closed with the rule 'sources accumulate; only an explicit act removes one'. The fix changes that settled rule.

#### U-CON-05: An attribute value of an empty string or an empty list is refused, or is accepted as a known value

- Root cause: scalar and edited (attribute-value.ts:3,7) and attrs_valid (0002_types.sql:53-57) set no minimum on a string or a list, while the detail page refuses a blank as 'unknown'.
- Closes: CON-COR-05 (minor)
- Change: contract, size S
- Files: `packages/proposal/src/attribute-value.ts`, `packages/proposal/src/attribute-value.test.ts`, `db/migrations/0014_attrs_valid_non_blank.sql`
- Symbols: scalar, edited, attrs_valid
- Comes after: U-CON-13 (wave 1): CON-13 moves attributeEdit/edited; the non-blank decision goes in the new form.
- Regression risk: A stored attribute that holds '' or [] makes the new CHECK fail, and an empty list that states a known zero is refused.
- Proof test: attribute-value.test.ts: { imo: { v: '' } } and { imo: { v: '   ' } } are refused; a db-test gives attrs_valid false for the same values.
- Conflicts with: M9, M11
- Why the operator must decide: The code at HEAD accepts '' and []. But the same claim was rejected as a false alarm in the simplification dimension: M9 speaks only of null, an empty list can state a known zero, and attribute-value.ts:24-26 records under M11 that the shape is the whole rule. The fix adds a value rule to both tiers and changes the reading of M9 and M11, so the operator must decide (at most a non-blank string rule, not a list rule).

#### U-CON-14: [operator_decision vs P4] A machine proposal holds the P4 contract (confidence, emitting agent, dissenting votes), or decisions.md records the departure

- Root cause: The proposals table has author_role and a dissent flag, but not the emitting agent and votes that P4 freezes.
- Closes: CON-SIM-02 (major), DB-ARC-14 (minor)
- Change: schema, size L
- Files: `packages/proposal/src/machine.ts`, `packages/proposal/src/machine.test.ts`, `packages/proposal/package.json`, `db/migrations/0014_machine_proposal.sql`, `db/apply/40_functions.sql`, `docs/decisions.md`, `db/migrations/0003_tables.sql`
- Symbols: machineProposal, propose_change, proposals.confidence, proposals.agent, proposals.dissent, proposals
- Comes after: U-CON-08 (wave 1): CON-08 cleans the exports map of packages/proposal/package.json; CON-14 adds a machine export to the clean map.
- Regression risk: A new CHECK on proposals refuses any existing agent row with no confidence, and a change of propose_change breaks its callers and grants. None if text only.
- Proof test: A db-test: propose_change as gabriel_agent with p_confidence NULL is refused; machine.test.ts refuses a proposal with no agent or with confidence out of [0,1]. None; documentation only.
- Merged from U-DB-32: merge: Both are about the same P4 gap on the proposals table. U-DB-32 is the 'record the departure' result of the decision that U-CON-14 asks for.
- Conflicts with: P4, S4, PU1, T6
- Why the operator must decide: Present at HEAD but latent: no worker calls propose_change yet. Building to P4 adds a new schema, an agent column and a T6 CHECK, which is a scope change before the first agent. The shape of 'dissenting votes' contradicts spec.md:159/166, which reads dissent as a boolean, so the operator must choose between the P4 wording and the spec.

#### U-WRI-09: A process credential between the dev proxy and the writer, so a local machine process cannot sign as the operator

- Root cause: The writer admits a request with no sec-fetch-site header and no credential, and signs and promotes it as gabriel_app with the reserved manual source.
- Closes: WRI-ARC-01 (major)
- Change: service, size M
- Files: `packages/writer/src/admission.ts`, `packages/writer/src/admission.db-test.ts`, `packages/writer/src/writer.db-test.ts`, `packages/writer/src/main.ts`, `vite.config.ts`, `infra/.env.example`
- Symbols: turnedAway, admitOwnSiteJson
- Comes after: U-WRI-07 (wave 2): Both change turnedAway/admitOwnSiteJson; the Host/Origin fix goes first and the credential decision builds on it.
- Regression risk: The operator's own tooling and every test that posts to the writer without the secret get 403.
- Proof test: admission.db-test.ts: a POST with no sec-fetch-site header and no process secret expects 403; the same POST with the secret is admitted.
- Conflicts with: C5
- Why the operator must decide: The DNS-rebinding part of this finding is closed by U-WRI-07. What stays is the local-process part, and its fix is a shared secret that the proxy adds and the writer requires. A rejected candidate (false alarm 1) and the verify check of WRI-SIM-03 show that ADR 0002 section 7 accepts that every entry point loads infra/.env whole, so a local process can already read GABRIEL_APP_PASSWORD and the same secret file. C5 trusts the operator's machine. The operator must decide if a process credential is in scope before agents write at volume.

#### U-WRK-01: Remove the queue dispatch: the layout and reconcile runs stop claiming per-document ingestion jobs

- Root cause: runOnce claims the oldest job row, which is always the ingestion job of one document from put_document. It ignores documentId, spends the row on corpus-wide layout or reconcile work and never ends the row. layout-main.ts and reconcile-main.ts already run the same work by hand.
- Closes: WRK-ARC-01 (major), WRK-COR-01 (major), WRK-SEC-01 (major), WRK-SIM-01 (major), XC-ARC-01 (major), XC-COR-03 (major), XC-SIM-02 (major), XC-TST-01 (major), WRK-ARC-02 (minor), WRK-COR-04 (minor), WRK-TST-04 (minor), WRK-TST-05 (minor), WRK-TST-06 (minor), XC-COR-06 (minor), XC-TST-07 (minor), WRK-ARC-07 (nit), WRK-ARC-08 (proposal), WRK-SIM-03 (proposal), WRK-SIM-04 (proposal), WRK-TST-08 (nit), XC-TST-15 (nit)
- Change: refactor, size M, removes or moves code
- Files: `packages/worker/src/main.ts`, `packages/worker/src/run-once.ts`, `packages/worker/src/run-once.test.ts`, `packages/worker/src/backoff.ts`, `packages/worker/src/backoff.test.ts`, `packages/worker/package.json`, `package.json`, `docs/decisions.md`
- Symbols: runOnce, runAs, JOB_KIND, JobKind, JOB_RETRY_LIMIT, FAIL, wait, backoffMs, BASE_DELAY_MS, MAX_DELAY_MS, worker:layout script, worker:reconcile script, @gab/worker exports, T9a, worker:layout, worker:reconcile
- Regression risk: A file or script that imports runOnce, backoffMs or the @gab/worker main export breaks (a grep shows none today), and fail_job then has no TypeScript caller until a per-document runner exists. If you delete main.ts, the @gab/worker exports entry points to a missing file, and claim.ts and backoff.ts lose their only caller. Knip or lint can then report them.
- Proof test: After the change, pnpm worker:layout no longer exists. A live check (for example in claim.db-test.ts, or by hand on the stack): queue a document through put_document, run pnpm layout and pnpm reconcile, and assert that the document's job row is still 'queued' with attempts = 0. Before the change, the same check with pnpm worker:layout finds the row 'running' with attempts = 1. A db-test queues one document job, runs the layout path and the reconcile path, and then asserts that the job row is still 'queued' with attempts 0. The test fails at HEAD, because the worker:layout path claims the row.
- Merged from U-XC-01: merge: Same defect, same symbols (runOnce, runAs, JOB_KIND, JOB_RETRY_LIMIT, the worker:* scripts) and the same removal in the same files.
- Conflicts with: T9a
- Why the operator must decide: Two fixes are possible. (a) Delete main.ts, run-once.ts and run-once.test.ts and the worker:layout and worker:reconcile scripts, and keep the by-hand entry points. (b) Add a kind column before the worker routes jobs by kind. Option (a) removes the only caller of fail_job, which T9a (26 September 2026) gave to 'the worker'. Option (b) is a schema change. The operator must choose. COR-06, TST-01, TST-07 and TST-15 are defects and test gaps in run-once.ts: option (a) closes them by deletion. Option (b) must fix them (guard the fail_job call so the original fault is thrown again, and add tests for attempt 2, for a success and for a fail_job that throws).

#### U-WRK-02: [operator_decision vs T9a] Complete the job lifecycle in the database: a door that writes 'done', a caller for release_expired_claims, fail_job bound to the current claim, the attempt limit held in the database, and live tests of the doors

- Root cause: The T9a lifecycle is incomplete in the database. No door writes jobs.status = 'done'. No code calls release_expired_claims, and only gabriel_app holds it. fail_job matches only id and status = 'running' and reads no attempt count. The limit of 3 exists only as JOB_RETRY_LIMIT in run-once.ts. No db-test claims a row and then fails or releases it.
- Closes: DB-ARC-01 (major), DB-ARC-02 (major), DB-COR-01 (major), DB-TST-03 (major), DB-TST-04 (major), WRK-COR-02 (major), WRK-COR-03 (major), WRK-SIM-02 (major), WRK-TST-02 (major), XC-ARC-02 (major), XC-COR-01 (major), XC-COR-02 (major), XC-TST-02 (major), DB-ARC-03 (minor), DB-COR-03 (minor), DB-SEC-03 (minor), DB-SIM-03 (minor), WRK-SEC-02 (minor)
- Change: schema, size L, removes or moves code
- Files: `db/apply/40_functions.sql`, `db/apply/90_grants.sql`, `src/db/public/fail_job.ts`, `src/db/public/complete_job.ts`, `src/db/public/release_expired_claims.ts`, `packages/worker/src/claim.db-test.ts`, `tools/perimeter/role-privilege.db-test.ts`, `tools/perimeter/audit-arm.db-test.ts`, `db/migrations/0004_jobs.sql`, `docs/decisions.md`, `packages/worker/src/run-once.ts`, `packages/worker/src/run-once.test.ts`, `packages/worker/src/job-doors.db-test.ts`, `src/db/public/finish_job.ts`, `db/apply/95_seed.sql`, `packages/writer/src/main.ts`, `package.json`
- Symbols: fail_job, complete_job, release_expired_claims, claim_job, public.jobs, T9a, finish_job, runOnce, jobs_finished_pairs, JOB_RETRY_LIMIT, parameter.job_attempt_limit, stamp_claimed_by, claimJob
- Comes after: U-WRK-01 (not in a wave): WRK-01 removes runOnce and run-once.ts; WRK-02 must not edit code that is about to be deleted. U-WRK-06 (wave 1): WRK-02 adds lifecycle tests to claim.db-test.ts; a suite that seeds its own rows makes these tests simpler and stable.
- Regression risk: A changed fail_job signature or new grants can break the perimeter privilege probes and the generated types, and a release caller that is too eager can requeue a job that is still running. The perimeter door-set tests list each door by hand, so they fail until they name the new door; a worker that calls finish_job after the lease was released can raise 'not running'. The fail_job signature changes to (uuid, int, text), so the grant, the perimeter lists and the worker call must change in the same commit; release that marks an exhausted row 'failed' must still satisfy jobs_failed_carries_reason and jobs_finished_pairs. A release caller that runs before U-DB-01 lands requeues every successful job and runs it again. A new done door or an automatic release can requeue or close a row that a live worker still holds, if the lease and the end write do not check status = 'running'. A test that does not roll back can leave a failed row in the shared fixture queue.
- Proof test: New live tests in packages/worker/src/claim.db-test.ts, inside the rolled-back held helper: claim a row, call fail_job(id, attempt, 'x'), and read back status = 'failed', failure_reason = 'x' and finished_at IS NOT NULL. A second fail_job on the same row rejects. fail_job with a stale attempt count rejects. complete_job writes 'done' and finished_at. packages/worker/src/job-doors.db-test.ts: claim a job, call finish_job, assert status 'done' and finished_at set, then move claimed_at past the lease, call release_expired_claims and assert the row stays 'done'; plus a run-once.test.ts case that asserts the finish call after a successful run. packages/worker/src/job-doors.db-test.ts: (a) fail_job with a stale attempt number raises and the live claim stays running; (b) fail_job on attempt 1 raises; (c) fail_job on attempt 3 writes failed, failure_reason, finished_at; (d) blank reason raises; (e) release requeues an expired row below the limit, keeps attempts, clears claimed_by; (f) a row inside the lease stays running; (g) an expired row at the limit becomes failed; (h) a missing lease row raises. A db test that fails a job on attempt 1, lets the lease expire, runs the chosen release path and asserts that the next claim_job gets the row with attempts = 2. A db-test claims a job, moves claimed_at back past the lease, runs the new release caller, and asserts that the row is 'queued'. A second case claims a job, calls the end door, and asserts status 'done' with finished_at set. Both fail at HEAD. New claim.db-test cases: (1) claim, call fail_job, and read status 'failed', failure_reason and finished_at; (2) call fail_job on a queued row and expect 'job % is not running'; (3) move claimed_at back past the lease, call release_expired_claims, and expect 'queued'. The cases fail if the fail_job UPDATE or its status filter is removed.
- Merged from U-DB-01, U-DB-02, U-DB-03, U-XC-02, U-XC-03: merge: U-WRK-02 already covers the done door (U-DB-01, U-XC-02), the release caller (U-DB-03, U-XC-02) and the claim binding of fail_job (U-DB-02). U-XC-03 is the same live test as DB-TST-03/04 in U-DB-02. All units change fail_job, release_expired_claims and the new done door in 40_functions.sql and 90_grants.sql for the same reason, so one change closes them. Do this unit after U-WRK-01: U-DB-01 asks runOnce to call the done door, but U-WRK-01 removes runOnce and JOB_RETRY_LIMIT.
- Conflicts with: T9a
- Why the operator must decide: At HEAD, db/apply/40_functions.sql has no door that writes 'done', release_expired_claims has no caller, and fail_job (about line 527) matches WHERE id = p_id AND status = 'running' only. After U-WRK-01, no worker claims a job, so these defects cannot occur until a per-document runner exists. The fix adds a complete_job door, changes the fail_job signature to take the attempt, and names who calls the lease release, with a new grant. T9a says 'the existing lease expiry requeues it' but names no caller, and the 0004_jobs.sql header puts the done door with the ingestion-seam work. So the operator must amend T9a and decide the scope (now, or with the P6 runner). The live fail_job test (TST-02) goes here so that it is written once, against the final fail_job signature.

#### U-WRK-10: ADR 0004 §4 states where the precomputed positions are stored

- Root cause: #35 closed the storage question (the entity_layout table, a full replacement per run, pnpm layout run by hand), but ADR 0004 §4 still says the question is open and on the tracker.
- Closes: WRK-ARC-05 (nit)
- Change: docs, size S
- Files: `docs/adr/0004-frontend-stack.md`
- Symbols: ADR 0004 §4
- Regression risk: A docs-only change, so there is no runtime risk.
- Proof test: None, because this is a docs change. Check: ADR 0004 §4 no longer says 'Where they are stored is open', and it names entity_layout.
- Conflicts with: ADR 0004
- Why the operator must decide: Spec §6 requires that an ADR records a settled build decision. The amendment records the decision that was made and does not reverse it, but the ADR text belongs to the operator.

#### U-REV-07: Decide the fate of the threshold routing: remove the dead branches, or fix the 'unstated' words and test the branches

- Root cause: readQueue takes a threshold that is always null, so routingOf only gives 'dissent' or 'unstated'. The other branches are untested, and the 'unstated' words are false when a threshold exists and the act states no confidence.
- Closes: REV-TST-07 (minor), REV-COR-08 (nit), REV-SIM-09 (proposal)
- Change: frontend, size M, removes or moves code
- Files: `src/features/review/queue.ts`, `src/features/review/queue.test.ts`, `src/features/review/change-card.tsx`, `src/routes/review.tsx`, `src/features/review/sample.ts`, `src/features/review/decided.test.ts`, `src/features/review/review-page.stories.tsx`, `src/features/review/review-surface.stories.tsx`, `src/features/review/subject-rail.stories.tsx`, `src/features/review/sources.stories.tsx`
- Symbols: routingOf, Routing, ROUTING_WORDS, ROUTING_SHORT, ROUTING_GLYPH, ROUTING_PAINT, readQueue, THRESHOLD
- Regression risk: The removal path changes the readQueue signature for every caller; the fix path can change the routing of an act with no confidence once a threshold arrives.
- Proof test: Fix path: queue.test.ts readQueue(corpus, 0.5) with confidence 0.4/0.9 and dissent true/false gives 'low-confidence', 'both', 'dissent', 'neither', and confidence null with a threshold gives words that do not say the screen holds no threshold. Removal path: tsc and the review stories stay green with Routing = 'dissent' | 'unstated'.
- Conflicts with: S3
- Why the operator must decide: SIM-09 proposes to remove the threshold and three routings; COR-08 and TST-07 propose to fix and test them. S3 says the operator intervenes on dissent or on confidence below threshold, so removing the low-confidence routing changes how the UI supports S3. The operator must choose one path; both paths close all three findings.

#### U-TST-16: [operator_decision vs ADR 0002, ADR 0003 §5, PU1] The live tests, including the writer db tests, run against a separate test database, not the published record

- Root cause: There is one database. The fixture loader and pnpm test:writer write invented and fixture acts permanently into the append-only record that api.proposal publishes.
- Closes: TST-COR-02 (major), TST-SEC-01 (major), TST-ARC-01 (minor), WRI-ARC-03 (minor), WRI-SEC-03 (minor)
- Change: tooling, size L
- Files: `tools/db-runtime.ts`, `tools/db-load-fixture.ts`, `tools/db-reset.ts`, `vitest.config.ts`, `tools/corpus/loaded-corpus.db-test.ts`, `tools/corpus/known-gap.db-test.ts`, `tools/service/read-api.db-test.ts`, `src/shared/read/corpus.db-test.ts`, `tools/inherited-position.db-test.ts`, `infra/docker-compose.yml`, `package.json`, `docs/adr/0003-schema-pipeline-and-read-contract.md`, `docs/adr/0002-datastore.md`, `packages/writer/src/pool.ts`, `packages/writer/src/writer.db-test.ts`, `infra/.env.example`
- Symbols: connectionString, compose, PROJECT, DATABASE, main (db-load-fixture), CENSUS, resetFromZero, openPool, address, writerProject
- Regression risk: A second compose project needs its own ports, volumes and credentials, and every db test, the drift check and CI must point at the right one; a wrong default sends tests or the fixture load to the operator's record again. The writer can point at the wrong database in production if the environment variable is absent or wrong, and the test database can drift from the applied schema.
- Proof test: After an operator act on the live record (promote one entity with no v1_id), `pnpm test` stays green; before the fix loaded-corpus.db-test.ts 'the record holds the committed fixture whole' fails. A test that reads current_database() from the writer test pool expects the test database name (before: 'gabriel'); after a full pnpm test:writer, SELECT count(*) FROM public.proposals in 'gabriel' is unchanged.
- Merged from U-WRI-10: merge: U-WRI-10 is the writer part of the same decision: DATABASE = 'gabriel' is fixed in pool.ts, and the change is the same (a disposable test database in compose, vitest.config.ts and the env files).
- Conflicts with: ADR 0002; ADR 0003 §5; PU1
- Why the operator must decide: Still present at HEAD: tools/db-runtime.ts fixes PROJECT 'gab' and DATABASE 'gabriel'; loaded-corpus.db-test.ts asserts entities_outside_the_corpus: fixtureSize.entities; db-load-fixture.ts promotes every fixture row with DECIDED_BY 'fixture-loader'. The fix needs a choice: (a) a separate test compose project or database (for example gab-test) for db tests, the fixture load and db:reset, which changes the single-datastore statement of ADR 0002 and the procedure of ADR 0003 §5; or (b) keep one database and change the census assertions to invariants, amend §5 to add `pnpm db:load-fixture`, and accept the invented rows in the live record against PU1. Both change an ADR. Also fix the stale comment at tools/inherited-position.db-test.ts:3 in the same change.

#### U-TST-27: Decide the lint and format exemption of .claude/workflows

- Root cause: eslint.config.ts ignores '.claude/workflows/**' by folder pattern and .prettierignore excludes '.claude', but ADR 0004 §8 allows only routeTree.gen.ts by name, and the folder holds tracked, hand-written scripts.
- Closes: TST-ARC-03 (minor)
- Change: tooling, size S
- Files: `eslint.config.ts`, `.prettierignore`, `docs/adr/0004-frontend-stack.md`
- Symbols: ignores .claude/workflows
- Regression risk: If the files become linted, the workflow scripts can fail lint and block `pnpm check` until they are corrected.
- Proof test: If linted: `pnpm lint` reports on .claude/workflows/*.js after the change. If amended: the ADR names the exemption and the lint output does not change.
- Conflicts with: ADR 0004 §8
- Why the operator must decide: Still present at HEAD (eslint.config.ts:282). The finding's alternative (globalReturn) does not work because the files use top-level await. The options are: amend ADR 0004 §8 to name .claude/workflows/ as a harness-run exemption with its reason, or lint the files by another method (wrap each in an async function before parse). Either needs the operator.

#### U-TST-32: Amend ADR 0006 §5 and §6 to name packages/*/src and .storybook as the scope of the reference rule

- Root cause: The rule block runs on src/, packages/*/src and .storybook, but ADR 0006 §5 and §6 say it reaches src/ only and nothing else; the .storybook glob also omits mts and cts although the comment says both blocks name the same extensions.
- Closes: TST-ARC-09 (nit)
- Change: docs, size S
- Files: `docs/adr/0006-a-comment-records-a-reason.md`, `docs/agents/commit.md`, `docs/README.md`, `eslint.config.ts`
- Symbols: local/no-reference-in-comment files
- Regression risk: Adding mts/cts to the .storybook glob changes nothing today (only main.ts and preview.ts exist).
- Proof test: None (documentation only): `pnpm lint` output does not change.
- Conflicts with: ADR 0006 §5; ADR 0006 §6
- Why the operator must decide: Still present at HEAD: eslint.config.ts:650-654. The verify agent says keep the wider scope and amend the ADR text (and docs/agents/commit.md, docs/README.md). This is a docs/ADR change. The small .storybook glob correction can go with it.

#### U-TST-35: The row-level source list of a created row holds only the documents that back its typed columns

- Root cause: proposals_src_within forces a proposal's src to contain every attribute source, and the create branch of promote_proposal copies that union into entities.sources / relations.sources, so the published row list names documents that back no typed column, against revised S2. The loader's citedDocuments makes this visible, and known-gap.db-test.ts:81 locks the union in as expected.
- Closes: TST-SIM-01 (major)
- Change: schema, size L, removes or moves code
- Files: `tools/db-load-fixture.ts`, `db/migrations/0014_row_sources_back_typed_columns.sql`, `db/apply/40_functions.sql`, `db/apply/20_views.sql`, `tools/corpus/known-gap.db-test.ts`, `docs/decisions.md`
- Symbols: citedDocuments, proposals_src_within, attrs_src_within, promote_proposal, api.entity
- Regression risk: Removing proposals_src_within also removes the premise of the db-layer finding that proposals_value_not_reserved is redundant, so M8 enforcement for agent value sources can open unless a value-level rule stays.
- Proof test: After `pnpm db:load-fixture`, api.entity sources for 'Meridian Bulk Carriers Ltd' is ['doc_3c1104'] after the fix and also holds doc_5e7730 before it; known-gap.db-test.ts asserts the new rule.
- Conflicts with: S2; P4
- Why the operator must decide: Still present at HEAD (tools/db-load-fixture.ts:61 citedDocuments; proposals_src_within in 0003_tables.sql:153). The root cause is in the db layer. Options: (a) replace proposals_src_within with a direct existence check of each value source against documents and let a create act's src hold only the column sources; (b) reword S2 so the creation list is 'every document the creating act cited' and stop presenting it as the source of label, type and geom. The verify agent says P4 need not reopen, but either option changes S2 or its enforcement. Coordinate with docs/review/01-database.md, which proposes dropping proposals_value_not_reserved on the premise that proposals_src_within stands.

## Will not fix

- **U-WRI-12** (WRI-ARC-04 (minor)): groundOfColumns keeps a TypeScript copy of the type resolution in promote_proposal. Reason: The two copies agree today, and T6 in docs/decisions.md accepts 'one rule expressed twice, to be kept in sync' between the application tier and the database tier. The proposed fix changes promote_proposal, the core promotion transaction, which costs more than a drift risk. A rejected candidate (false alarm 4) shows the other simplification breaks the outcome contract. The drift is held by the regression test of U-WRI-13.
- **U-DET-13** (DET-COR-12 (proposal), DET-SIM-11 (proposal)): Keep the two ready branches of readRenameDraft. Reason: The finding is wrong: the two branches narrow `label` to string, then `type` to string, so each literal matches one member of the update_entity union in src/shared/write/elements.ts:15-18. A merged test gives { label: string|null; type: string|null }, which tsc refuses. The same proposal was rejected as a false alarm in the architecture dimension of this report.
- **U-TST-34** (TST-ARC-12 (nit)): The loader cannot load a candidate relation that ends on a relation. Reason: The failure is loud (the loader throws), the fixture holds no such candidate, and M4 says nothing uses a relation end yet. A fix must first add an end kind to the read-model payload type (src/shared/read/model.ts) and its contract, which costs more than the defect. Reopen when a candidate on a relation end is added to the fixture.
- **U-XC-18** (XC-SIM-06 (proposal)): Share one database address module between the writer and the worker. Reason: The duplicate is about ten lines of constants that the compose file pins. A shared module needs a new workspace package (not @gab/store, which is the S3 layer), a new dependency for the writer, and new eslint boundary entries. It must also not expose the superuser entry. The fix costs more than the defect.

## Already fixed

An audit on 28 September 2026 checked every unit in this plan against the commits made
since it was written, and against the live code. 146 of 168 units (all of Waves 1-9, and
all 17 of the "after the operator decisions" units) are done. The four sections above
still give the plan's shape; read this section for the true state.

**Waves 1-9: all 125 units done.** Wave 1, the gate for Wave 2, closed before Wave 2 work
began. Do not restart wave work; move to the units still open below.

**After the operator decisions: 17 of 17 done.** U-TST-28 is now built: `eslint.config.ts`
adds a shape for a bare path with no `./` and no `.md` suffix, and an overlap check so a
match inside an already-matched link gives one report and not two. Eleven comments across
eight files (`.storybook/preview.ts`, `src/features/detail/field.stories.tsx`,
`src/features/detail/pending.stories.tsx`, `src/features/detail/relation-sidebar.stories.tsx`,
`src/features/graph/controller.ts`, `src/features/graph/model.ts`,
`src/features/map/adapter.ts`, `src/routes/map.tsx`) were rewritten to state a reason
instead of a path. `src/routes/graph.tsx`, one of the plan's original nine files, needed no
change: U-REV-24 had already removed its source-path comments. `pnpm lint` confirms.

**Operator decisions: 16 of 26 done** after a second pass on 28 September 2026 (a
requirement debate, run in seven grouped batches, checked each unit against the code and
against `docs/decisions.md`'s own 26 September ruling, which the "Decisions of 26
September 2026" section above already answered for most of these units without anyone
applying the answer).

U-CON-01, U-WRK-01, U-REV-07 and U-TST-16 were already done before this pass.

Eight more are done now — the ADR/decisions text was written to catch code that was
already built: **U-DB-24, U-DB-25, U-DB-27, U-DB-30, U-DB-36, U-WRK-10, U-TST-27,
U-TST-32**. U-TST-32 unblocks U-TST-28 (in "after the operator decisions"): that unit is
now buildable, but not yet built.

Four more are done by the 26 September ruling standing as the answer, with no file to
write: **U-DB-40, U-DB-41** (keep both ops in `proposals_op_check`, no code change),
**U-DB-43** (no squash; the repository already assigns each new migration its number in
merge order), **U-DB-39** (informational only, no fix exists, filed as accepted).

Seven wait on a named gate that does not exist yet, exactly as the 26 September section
already said — no new decision, no action until the gate opens:

- **#25, the first agent/model caller**: U-DB-09, U-WRI-09, U-CON-14
- **#134, the P6 ingestion runner**: U-WRK-02, U-DB-28, U-DB-31
- **U-WRK-02 itself** (the door set may still change): U-DB-26

The last three were decided and built on 28 September 2026, after the debate above
correctly declined to invent an answer:

- **U-CON-05: built.** A bare string value that is empty or all whitespace is refused,
  at both tiers (migration 0021, `packages/proposal/src/attribute-value.ts`). An empty
  list stays valid, unchanged: M11 already covers it, and it can state a known "none".
  `docs/decisions.md` records the amendment under M9.
- **U-TST-35: built.** S2 already decided that the row-level list backs a row's typed
  columns alone — the code did not implement that split. Migration 0022 adds
  `payload.sources`, the act's own citation for a created row, checked against `src`;
  `promote_proposal` publishes it instead of the whole citation set. The real writer
  always gives `['manual']` (label/type/geom are typed by hand); the fixture loader gives
  its own `entity.sources` / `relation.sources`, already distinct from attribute sources.
  A create candidate that gives no `sources` (no agent proposes a create yet, #25) keeps
  the old, wider behaviour. `tools/corpus/known-gap.db-test.ts` is rewritten: the
  "untouched row omits a value source" gap is gone, because it was never a real
  invariant once the split is correct.
- **U-DB-42: decided to keep.** On inspection this is not dead code: T9's own
  consequence already reserves the three columns for a job-level retry history, with a
  full design rationale (two counts, not one total; the `failure_kind` taxonomy) tied to
  #25's still-open growing-wait proposal. Dropping them now would discard completed
  design work only to redo it identically once #25 or the P6 runner lands. No file
  changed.

All three were run against the live database (`pnpm db:reset`, `pnpm db:migrate`, the
full test suite, `pnpm check`): 747 live tests and 416 offline tests pass, drift is
clean.

Two units closed by a route other than the one the plan states, and count as done:

- **U-TST-17**: `tools/db-reset.ts` now hardcodes its drop target to `gabriel_test`, so no
  flag can ever point it at the real `gabriel` database. The plan asked for a guard flag;
  the code makes the guard unconditional instead.
- **U-DB-29, U-DB-34**: the plan held both behind the migration squash (U-DB-43, still
  open). Commit `d301424` fixed the comments directly in the unsquashed files instead.

## Critic changes

- U-TST-01: note. There is a conflict with the recorded reason in 0001_extensions_and_roles.sql:30-33 and 90_grants.sql:25-28. Those comments refuse a blanket function revoke because it removes EXECUTE from every PostGIS function and stops the map read. A global ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC for gabriel_owner applies to every function that role creates in every schema, and that includes a later extension that it creates (pgvector, see U-DB-25). Also, PostgreSQL checks EXECUTE on a function called inside a view against the user that queries the view. So a non-definer helper that an api view or a CHECK calls can fail for gabriel_read or gabriel_agent. Before this unit merges, run the full live suite and a map read as each login role.
- U-DB-43: note. Several units in waves 1-4 add new migrations whose numbers collide: 0014 is used by U-TST-01, U-CON-04, U-DB-04, U-CON-05, U-CON-14 and U-TST-35, and the plan also adds 0015, 0016, 0017 and 0018. Give each migration its number when it merges, in merge order, not the number in the plan. If the operator chooses the squash, it must also absorb every migration that is merged before it. Decide the squash early, or apply it last, and never while schema units are still open.
- U-WRK-06: note. The seeded queued rows need document_id NOT NULL, so the suite must also create documents rows. put_document is the only door for that. The suite commits these rows permanently into the one published database, which is the defect that U-TST-16 is still open about. Remove the rows in the suite or make them clearly synthetic, and give them an identity that U-TST-16 can later move to a test database.
- U-TST-05: note. The file list names tools/perimeter.db-test.ts. U-TST-07 deletes that file and moves its arms into tools/perimeter/audit-arm.db-test.ts. Write the fix in audit-arm.db-test.ts. The EXEMPT_CASCADES and top-level await move with the arms.
- U-TST-06: note. The file list names tools/perimeter.db-test.ts, which U-TST-07 deletes. Write the fix in tools/perimeter/audit-arm.db-test.ts.
- U-REV-10: note. The pure verdict-flow function is written before U-WRI-02 adds a doubt/unknown outcome to WriteOutcome. Make the switch on the outcome exhaustive (a never check), so that tsc shows the missing branch when WRI-02 and DET-19 change the type. Also keep the order of setVerdicts and refreshCorpus.
- U-DET-16: note. The stories pin request addresses and bodies with a stub that answers SIGNED. U-WRI-02 and U-DET-19 later change the reply shape that door.ts reads. Build the stub answer from one helper, so that those units change one place.
- U-TST-34: note. Part of the wont_fix reason becomes false after U-REV-01. REV-01 adds src_kind/dst_kind to the read-model ProposalPayload in src/shared/read/model.ts. That is the prerequisite this reason says costs too much. After REV-01, check this unit again. candidatePayload can then read the end kind at a low cost.
- U-DB-07: note. U-DB-42 (operator decision) can drop jobs.failure_kind and the failure-count columns. Publish only failure_reason and finished_at in api.job. Do not publish a column that DB-42 can drop, because this view is part of the read contract. Also regenerate src/contract/api/Job.ts and run the drift check.
- U-TST-09: note. If U-WRK-02 is chosen, it adds a complete_job door and changes the grants of the door set. Derive the DOORS list of TST-09 from THE_DOOR_SET or from the catalogue, not from a copied literal. Then the lifecycle change does not make the test stale.
- U-DB-05: note. The key lists must accept every key that proposalAct (packages/proposal/src/payload.ts) and tools/db-load-fixture.ts send today. This includes geom for create_entity (0012) and src_kind, dst_kind, valid_from, valid_to and attrs for create_relation. U-REV-01 shows that the review reads only part of these keys, so do not take the key list from the read model. Run db:load-fixture against the CHECK before the unit merges.
- Edge removed U-DB-41 -> U-DB-04. U-DB-04 is the data-integrity fix: at this time, an agent can queue delete_relation on an entity, and the promotion then deletes the entity. The CHECK can bind delete_entity, delete_relation and update_relation to target_kind now. If U-DB-41 later removes update_relation, that migration also drops the update_relation clause. An operator decision about a synonym must not block a fix of the write path that agents will use at volume.
- Edge removed U-DB-41 -> U-DB-19. The relation-update test can promote update_attrs on a relation. That op stays after either result of U-DB-41, so the test does not depend on the decision.
- Edge removed U-DB-29 -> U-TST-14. The new edge U-TST-14 -> U-DB-29 replaces this edge. Through TST-14 -> TST-15, this edge put TST-15 (the rolled-back probe helper that stops failing refusal tests from committing writes to the live database), TST-20, TST-22 to TST-25 and DB-06 (a CHECK on the update_entity write path) behind the squash decision and the T9a lifecycle decision. None of those units depends on those decisions.
- Edge added U-TST-14 -> U-DB-29. This edge replaces U-DB-29 -> U-TST-14. Both units correct the attribute_key comments in 40_functions.sql. If TST-14 goes first, DB-29 changes only the comments that remain. TST-14 then does not wait for the squash decision (U-DB-43) or for U-WRK-02.
- Edge added U-DET-19 -> U-REV-09. REV-09 pins the mapping from sendVerdict to the outcome. U-WRI-02 adds a doubt/unknown outcome and U-DET-19 adds a field to WriteOutcome in door.ts. If REV-09 runs in wave 1, its test is written against a WriteOutcome that changes two times after it. REV-09 must run after U-DET-19, which already runs after U-WRI-02.

## Coverage

354 findings, 172 units. Each finding is in exactly one unit: yes.
