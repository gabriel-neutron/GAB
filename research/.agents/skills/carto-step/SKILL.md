---
name: carto-step
description: Close one step of a research ticket. Write the comment text for the ticket - what was loaded, the proposal ids, and what stays open. Use it at the end of each step of a research ticket.
---

# Close a research step

Use this skill at the end of a step of a research ticket. The deliverable is data in Gabriel, so
the comment reports the data, and not a narrative.

## Tools

- `propose_change`: the tool whose proposal ids this comment reports. This skill calls no tool.
  It collects the ids that the other skills gave.

## Steps

1. Collect the document ids that the step stored, and the job status of each one.
2. Collect the proposal ids that the step made, with the fact that each one proposes.
3. Write the open items: each gap that the step did not close, the source to fetch next, and each
   fetch or job that failed.
4. Write the comment text in ASD-STE100 Simplified Technical English, in three parts:
   - **Loaded**: the documents, with their document ids.
   - **Proposed**: the proposal ids, one line for each, with the fact.
   - **Open**: the gaps and the next sources.
5. Give the comment text to the operator. Post it on the ticket only when the operator asks you
   to.

## Never

- Never report a fact that has no proposal id or no document id.
- Never write that a fact is true. Write that it is proposed, with its source.
- Never say that a step is done when a job failed or a gap stays open. List it under Open.
