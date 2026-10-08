import { listInput, pageOutput, readQueuePage } from './review-read.ts';
import { defineTool } from './tool.ts';

export const readDoubts = defineTool({
  name: 'read_doubts',
  description:
    'Reads one page of the list "Doubts" of the review page: the units that the rules send to a ' +
    'reviewer. Each unit comes with its acts, the cited passage of each act with the words around ' +
    'it, its faults, the reason of each dispute and of each rejection before, and the check of a ' +
    'second model. Read the cited passages before you decide a unit. Give "next" of the page as ' +
    '"after" to read the next page. The counts give the size of each list.',
  input: listInput,
  output: pageOutput,
  run: (session, input) => readQueuePage(session, { ...input, lane: 'doubt' }),
});
