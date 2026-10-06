/** The leads on the screen. This file holds the sentence each state reads and the words of each
 * lead. */

import type { Said } from '@/shared/said';
import { writeSaid, type WriteState, type WriteWords } from '@/shared/write/write-state';

import { readLeads, startLead, type Lead } from './lead-door';

interface LeadsRead {
  readonly leads: readonly Lead[];
  /** The read follows a start of a lead. */
  readonly started: boolean;
}

/** The write the dialog stands in. Idle is a list that is not read yet. */
export type LeadState = WriteState<LeadsRead>;

/** One lead as the dialog draws it. */
interface LeadLine {
  readonly id: string;
  readonly lead: string;
  readonly state: string;
  readonly documents: readonly { readonly id: string; readonly title: string }[];
}

const documentsWords = (count: number): string =>
  count === 1 ? 'It stored 1 page.' : `It stored ${String(count)} pages.`;

const stateWords = (lead: Lead): string => {
  const stored = documentsWords(lead.documents.length);
  switch (lead.status) {
    case 'queued':
      return 'Waits in the queue.';
    case 'running':
      return `Runs. ${stored}`;
    case 'done':
      return `Done. ${stored}`;
    case 'failed':
      return `Stopped: ${lead.reason ?? 'no reason was recorded'}. ${stored}`;
  }
};

const countWords = (count: number): string =>
  count === 0 ? 'No lead was given.' : `${String(count)} ${count === 1 ? 'lead' : 'leads'}.`;

const WORDS: WriteWords<LeadsRead, object> = {
  idle: 'The leads are not read yet.',
  working: () => 'The write service is asked.',
  done: ({ leads, started }) =>
    started ? `The lead waits in the queue. ${countWords(leads.length)}` : countWords(leads.length),
  unknown: () => 'The state of the leads is not known.',
};

/** The sentence, the button and the lines of one state, for the text in the field. */
export function leadScreen(
  state: LeadState,
  text: string,
): { readonly said: Said; readonly canStart: boolean; readonly lines: readonly LeadLine[] } {
  return {
    said: writeSaid(state, WORDS),
    canStart: state.step !== 'working' && text.trim() !== '',
    lines:
      state.step === 'done'
        ? state.leads.map((lead) => ({
            id: lead.id,
            lead: lead.lead,
            state: stateWords(lead),
            documents: lead.documents,
          }))
        : [],
  };
}

/** Read the leads. It raises nothing. */
export async function readLeadState(started = false): Promise<LeadState> {
  const read = await readLeads();
  return read.step === 'done' ? { step: 'done', leads: read.leads, started } : read;
}

/** Start one lead, then read the leads. It raises nothing. */
export async function giveLead(text: string): Promise<LeadState> {
  const outcome = await startLead(text.trim());
  if (outcome.step !== 'done') return outcome;
  return readLeadState(true);
}
