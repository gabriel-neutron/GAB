/** One write on a screen: nothing sent, one on the way, or what the write service answered. This
 * file holds the one state every write passes through, and the one sentence each step reads. */

import { calm, interrupt, type Said } from '@/shared/said';

/** What one write became. `done` carries what the write produced. `refused` wrote nothing, and
 * it carries the sentence of the write service. `unknown` is the write whose answer this page
 * cannot learn: it may have run whole. */
export type WriteResult<Done extends object = object> =
  | ({ readonly step: 'done' } & Readonly<Done>)
  | { readonly step: 'refused'; readonly refusal: string }
  | { readonly step: 'unknown'; readonly doubt: string };

/** The write a screen stands in. `About` names what each step that is not idle is about, so a
 * sentence never reads as the sentence of another act. */
export type WriteState<Done extends object = object, About extends object = object> =
  | { readonly step: 'idle' }
  | (Readonly<About> & ({ readonly step: 'working' } | WriteResult<Done>));

/** The words of one kind of write. The refusal is the sentence of the write service, so no kind
 * words it again. */
export interface WriteWords<Done extends object, About extends object> {
  readonly idle: string;
  readonly working: (about: Readonly<About>) => string;
  readonly done: (done: Readonly<Done & About>) => string;
  /** The write may have run whole, so the sentence states neither end. */
  readonly unknown: (about: Readonly<About>) => string;
}

/** The one sentence a write leaves on the screen. A doubt interrupts: the operator reads the
 * record again before anything else. */
export function writeSaid<Done extends object, About extends object>(
  state: WriteState<Done, About>,
  words: WriteWords<Done, About>,
): Said {
  switch (state.step) {
    case 'idle':
      return calm(words.idle);
    case 'working':
      return calm(words.working(state));
    case 'done':
      return calm(words.done(state));
    case 'refused':
      return calm(`Nothing was written. ${state.refusal}.`);
    case 'unknown':
      return interrupt(`${words.unknown(state)} ${state.doubt}`);
  }
}
