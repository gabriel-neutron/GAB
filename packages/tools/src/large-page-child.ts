// The child process of the memory test of a citation. A fresh process has a peak RSS that no
// earlier test moved, so the growth of the peak is the cost of the citation alone. It prints the
// growth in mebibytes, the cited passage and its context, and the result of a folded excerpt.

import { findExcerpt, pointSlice } from './excerpt.ts';

const CONTEXT_POINTS = 300;
const page = `${'a '.repeat(25_000_000)}The tanker “Nayara” left Vadinar.`;
// A concatenated string is flattened on its first search, and that copy is the page itself, not
// the cost of the citation.
page.indexOf('§');

const before = process.resourceUsage().maxRSS;
const span = findExcerpt(page, 'The tanker “Nayara” left');
if (span === null) throw new Error('the exact excerpt is not found');
const passage = pointSlice(page, span.start, span.end);
const context = pointSlice(page, span.start - CONTEXT_POINTS, span.end + CONTEXT_POINTS);
const folded = findExcerpt(page, 'The tanker "Nayara" left');
const growth = (process.resourceUsage().maxRSS - before) / 1024;
console.log(JSON.stringify({ growth, passage, context: context.length, folded }));
