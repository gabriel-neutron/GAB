import { expect, test } from 'vitest';

import { REFERENCE_SHAPES } from '../eslint.config.ts';

const ticket = REFERENCE_SHAPES[0];

const refuses = (text: string): boolean => {
  // External constraint: a global pattern keeps its last index from one call to the next.
  ticket.pattern.lastIndex = 0;
  return ticket.pattern.test(text);
};

test.each(['#999', '#000', '#333', 'grey #999 here', '#abc', '#2971c6', '#000000'])(
  'the ticket shape passes the colour %s',
  (colour) => {
    expect(refuses(colour)).toBe(false);
  },
);

test.each(['#89', '#1234', '# 12', '#12345', 'see #1000'])(
  'the ticket shape refuses the ticket number %s',
  (number) => {
    expect(refuses(number)).toBe(true);
  },
);
