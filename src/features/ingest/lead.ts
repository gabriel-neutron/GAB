/** The leads on the screen. This file holds the states the dialog passes through, the sentence
 * each one reads, and the words of each lead. */

import { calm, type Said } from '@/shared/said';

import { readLeads, startLead, type Lead } from './lead-door';

export type LeadView =
  | { readonly step: 'unread' }
  | { readonly step: 'working' }
  | { readonly step: 'read'; readonly leads: readonly Lead[]; readonly started: boolean }
  | { readonly step: 'refused'; readonly refusal: string };

/** One lead as the dialog draws it. */
export interface LeadLine {
  readonly id: string;
  readonly lead: string;
  readonly state: string;
  readonly documents: readonly { readonly id: string; readonly title: string }[];
}

export interface LeadScreen {
  readonly said: Said;
  readonly canStart: boolean;
  readonly lines: readonly LeadLine[];
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

/** The sentence, the button and the lines of one state, for the text in the field. */
export function leadScreen(view: LeadView, text: string): LeadScreen {
  const filled = text.trim() !== '';
  switch (view.step) {
    case 'unread':
      return { said: calm('The leads are not read yet.'), canStart: filled, lines: [] };
    case 'working':
      return { said: calm('The write service is asked.'), canStart: false, lines: [] };
    case 'refused':
      return {
        said: calm(`The writer refused: ${view.refusal}.`),
        canStart: filled,
        lines: [],
      };
    case 'read':
      return {
        said: calm(
          view.started
            ? `The lead waits in the queue. ${countWords(view.leads.length)}`
            : countWords(view.leads.length),
        ),
        canStart: filled,
        lines: view.leads.map((lead) => ({
          id: lead.id,
          lead: lead.lead,
          state: stateWords(lead),
          documents: lead.documents,
        })),
      };
  }
}

/** Read the leads. It raises nothing. */
export async function readLeadView(started = false): Promise<LeadView> {
  const outcome = await readLeads();
  return outcome.state === 'read'
    ? { step: 'read', leads: outcome.leads, started }
    : { step: 'refused', refusal: outcome.refusal };
}

/** Start one lead, then read the leads. It raises nothing. */
export async function giveLead(text: string): Promise<LeadView> {
  const outcome = await startLead(text.trim());
  if (outcome.state === 'refused') return { step: 'refused', refusal: outcome.refusal };
  return readLeadView(true);
}
