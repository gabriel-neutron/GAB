// A red-team file for the audit bound of the format cells. The audit pipeline is not built yet, so
// no test here calls it. Each test measures one fact of the method with an independent Wilson
// function and invented counts, and each `test.todo` names a line that the builder must turn into
// a test against the real door. A todo is an open attack, never a passed one.

import { describe, expect, test } from 'vitest';

const Z = 1.959964;

const wilson = (errors: number, n: number, side: 1 | -1): number => {
  const share = errors / n;
  const z2 = Z * Z;
  const centre = share + z2 / (2 * n);
  const spread = Z * Math.sqrt((share * (1 - share)) / n + z2 / (4 * n * n));
  return (centre + side * spread) / (1 + z2 / n);
};
const upper = (errors: number, n: number): number => wilson(errors, n, 1);
const lower = (errors: number, n: number): number => wilson(errors, n, -1);

const LIMIT = 0.02;

// A small seeded generator, so a run gives the same figures every time.
const generator = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

// The share of simulated cells that pass the limit at least once. `lookEvery` is the number of
// checks between two readings of the bound; a reading never happens before `firstLook`.
const everOpenShare = (
  trueError: number,
  lastCheck: number,
  lookEvery: number,
  cells: number,
  seed: number,
): number => {
  const next = generator(seed);
  let opened = 0;
  for (let cell = 0; cell < cells; cell++) {
    let errors = 0;
    for (let n = 1; n <= lastCheck; n++) {
      if (next() < trueError) errors++;
      if (n >= 100 && n % lookEvery === 0 && upper(errors, n) <= LIMIT) {
        opened++;
        break;
      }
    }
  }
  return opened / cells;
};

describe('the bound rule keeps its stated numbers', () => {
  test('zero errors need 189 checks, one error 280, two errors 361', () => {
    expect(upper(0, 189)).toBeLessThanOrEqual(LIMIT);
    expect(upper(0, 188)).toBeGreaterThan(LIMIT);
    expect(upper(1, 280)).toBeLessThanOrEqual(LIMIT);
    expect(upper(1, 279)).toBeGreaterThan(LIMIT);
    expect(upper(2, 361)).toBeLessThanOrEqual(LIMIT);
    expect(upper(2, 360)).toBeGreaterThan(LIMIT);
  });

  test('50 checks and 20 checks with no error stay far above the limit', () => {
    expect(upper(0, 50)).toBeCloseTo(0.071, 3);
    expect(upper(0, 20)).toBeCloseTo(0.161, 3);
  });
});

describe('attack: 210 settled and 190 unsettled candidates, all settled correct', () => {
  test('the settled-only bound passes while the whole batch cannot', () => {
    expect(upper(0, 210)).toBeLessThanOrEqual(LIMIT);
    // Worst case: every unsettled candidate is a false accept.
    expect(upper(190, 400)).toBeGreaterThan(0.4);
    // Even a 10 percent error share among the unsettled candidates breaks the limit.
    expect(upper(19, 400)).toBeGreaterThan(LIMIT);
  });

  test.todo('the audit view reports the share of cannot-settle labels next to the bound');
  test.todo('a cell with more than a stated share of cannot-settle labels does not open');
});

describe('attack: agent-sorted batch, easy items first', () => {
  test('190 easy items with no error say nothing about a population with 10 percent hard items', () => {
    // The hard items hold all the errors. A sample of easy items shows none of them.
    const hardShare = 0.1;
    const errorInHard = 0.2;
    const populationError = hardShare * errorInHard;
    expect(populationError).toBeGreaterThan(LIMIT);
    expect(upper(0, 190)).toBeLessThanOrEqual(LIMIT);
  });

  test.todo('only items drawn by code with a stored seed enter n, and an agent order never does');
  test.todo('a check that was not drawn from the stored sample is refused by the check door');
});

describe('attack: 190 candidates from 6 origin pairs of one event', () => {
  test('the independent units are 6, and 6 checks leave the bound above 35 percent', () => {
    expect(upper(0, 190)).toBeLessThanOrEqual(LIMIT);
    expect(upper(0, 6)).toBeGreaterThan(0.35);
  });

  test.todo('n counts one unit for each distinct pair of origin groups and event, not each claim');
});

describe('attack: one post with 22 extracted facts', () => {
  test('22 facts of one document are one reading, and one reading leaves the bound near 79 percent', () => {
    expect(upper(0, 22)).toBeGreaterThan(LIMIT);
    expect(upper(0, 1)).toBeGreaterThan(0.7);
  });

  test.todo('n counts one unit for each source document in a cell');
});

describe('attack: bound read after every check over 20 cells at true error 2.5 percent', () => {
  // Origin: invented seed. The figures hold for any seed, within the noise of 2,000 cells.
  const cells = 2000;
  const oneLook = everOpenShare(0.025, 190, 190, cells, 7);
  const everyCheck = everOpenShare(0.025, 1000, 1, cells, 7);

  test('reading the bound after every check opens more bad cells than one reading at 190', () => {
    expect(everyCheck).toBeGreaterThan(oneLook * 2);
  });

  test('over 20 cells, the chance that at least one bad cell opens is above 25 percent', () => {
    expect(1 - (1 - everyCheck) ** 20).toBeGreaterThan(0.25);
  });

  test.todo('the open decision uses a bound that holds for repeated reading, or a fixed look plan');
});

describe('attack: 39 of 40 on the path (b) gold set', () => {
  test('39 of 40 passes the letter B band, so a rule of 40 of 40 and the band disagree', () => {
    expect(lower(40, 40)).toBeGreaterThan(0.85);
    expect(lower(39, 40)).toBeGreaterThanOrEqual(0.85);
    expect(lower(38, 40)).toBeLessThan(0.85);
  });

  test('the path (b) gate has no 2 percent bound, only a lower bound on the true share', () => {
    // 39 of 40 correct leaves an upper bound of about 13 percent for false accepts.
    expect(upper(1, 40)).toBeGreaterThan(0.1);
  });

  test.todo('one wrong label in the 40 either keeps path (b) closed or the rule says so in a test');
});

describe('attack: one EN plus RU claim counted in two cells', () => {
  test('one check cannot move two cells to the limit by itself', () => {
    // A cell at 188 checks needs one more. One shared check opens two cells at the same time.
    expect(upper(0, 188)).toBeGreaterThan(LIMIT);
    expect(upper(0, 188 + 1)).toBeLessThanOrEqual(LIMIT);
  });

  test.todo('a check that two legs share adds to n of a cell only if that leg was the one read');
  test.todo('an RU cell and an EN cell that share all checks cannot open on the same 189 checks');
});

describe('attack: reader model name change after opening', () => {
  test.todo('the cell key holds the reader and extractor version, or a change closes the cell');
  test.todo('a changed served model name makes gate_cell_open false until new checks pass');
});

describe('attack: operator labels decoy items correct when tired', () => {
  test('a miss rate of 50 percent on wrong items hides a 4 percent true error', () => {
    const trueError = 0.04;
    const missRate = 0.5;
    const seenError = trueError * (1 - missRate);
    expect(seenError).toBeCloseTo(LIMIT, 5);
  });

  test.todo('code seeds known-wrong decoys into a batch and a missed decoy closes the batch');
  test.todo('a decoy never reaches a public view and never counts in n');
});

describe('attack: canary row sharing a hash with a real document', () => {
  test.todo('a canary document with the bytes of a real document gets its own row or is refused');
  test.todo('the display guard never hides a real document because a canary names the same hash');
});

describe('attack: late contradicting record on an ACCEPTED claim', () => {
  test.todo('an issuer record that contradicts an accepted claim enters its cell as a wrong label');
  test.todo('that wrong label fires the brake with no operator click');
});

describe('attack: brake with 40 accepted claims in the cell', () => {
  test.todo('the 40 accepted claims of a braked cell show as ATTRIBUTED at read time');
  test.todo('a second hit removes the parameter row, and 40 claims stay ATTRIBUTED after it');
});
