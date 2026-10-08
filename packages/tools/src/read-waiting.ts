import { listInput, pageOutput, readQueuePage } from './review-read.ts';
import { defineTool } from './tool.ts';

export const readWaiting = defineTool({
  name: 'read_waiting',
  description:
    'Reads one page of the list "Waiting" of the review page: the units that wait for a better ' +
    'source. Each unit says the source that it needs, and comes with its acts and their cited ' +
    'passages. A unit that waits is not for a reviewer: find the source that it needs. Give ' +
    '"next" of the page as "after" to read the next page.',
  input: listInput,
  output: pageOutput,
  run: (session, input) => readQueuePage(session, { ...input, lane: 'waiting' }),
});
