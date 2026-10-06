import { readFileSync } from 'node:fs';

import { REASON, type Tool as ModelTool, type ToolUse } from '@gab/model';
import type { Tool, ToolOutcome } from '@gab/tools/tool';

import { JobStop, ModelFailure, type Refusal } from './agents.ts';

// Departure: several exports, one job. The extractor and the lead agent offer tools to a model, and
// each turn of a tool call reads the prompt, the offer, the call and the budget the same way.

/** The text of a prompt: the one that a test gives, or the versioned file beside the agent. */
export const promptOf = (given: string | undefined, file: URL): string =>
  given ?? readFileSync(file, 'utf8');

/** The tools that one agent offers to its model: by name for the call, and as the model reads
 * them. */
export const offerOf = (
  tools: readonly Tool[],
): { readonly byName: ReadonlyMap<string, Tool>; readonly forModel: readonly ModelTool[] } => ({
  byName: new Map(tools.map((tool) => [tool.name, tool])),
  forModel: tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input: tool.input,
  })),
});

/** The answer to one tool call of the model. A tool that the agent does not offer is refused, and
 * the refusal is kept. `run` gives the answer of a tool that is offered. */
export const answerCall = async (
  byName: ReadonlyMap<string, Tool>,
  call: ToolUse,
  refusals: Refusal[],
  notOffered: string,
  run: (tool: Tool) => Promise<string>,
): Promise<string> => {
  const tool = byName.get(call.name);
  if (tool !== undefined) return run(tool);
  const reason = `the tool ${call.name} is not offered ${notOffered}`;
  refusals.push({ tool: call.name, reason });
  return reason;
};

/** What the model reads of one outcome of a tool. */
export const outcomeText = (outcome: ToolOutcome): string =>
  outcome.ok ? JSON.stringify(outcome.output) : `The tool refused the call: ${outcome.refusal}`;

/** One question to the model. A spent token budget ends the job with `spent`. */
export const withinBudget = async <T>(question: Promise<T>, spent: string): Promise<T> => {
  try {
    return await question;
  } catch (cause) {
    if (cause instanceof ModelFailure && cause.failure.kind === REASON.overCap)
      throw new JobStop(spent);
    throw cause;
  }
};
