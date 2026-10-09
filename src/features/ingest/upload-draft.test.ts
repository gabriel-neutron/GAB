import { expect, test } from 'vitest';

import { BLANK_UPLOAD, readUploadDraft } from './upload-draft';

const file = new File(['the annual return'], 'mgt-7.pdf');

const FILLED = {
  file,
  title: ' MGT-7 ',
  uri: 'https://www.mca.gov.in/x',
  retrievedAt: '2026-10-01',
  providerId: 'mca21',
  cost: '12.5',
};

test('a filled form is read into the request, trimmed', () => {
  expect(readUploadDraft(FILLED)).toStrictEqual({
    ready: true,
    file,
    fields: {
      title: 'MGT-7',
      retrievedAt: '2026-10-01',
      uri: 'https://www.mca.gov.in/x',
      providerId: 'mca21',
      costEur: 12.5,
    },
  });
});

test('the provider and the cost may stay blank', () => {
  const draft = readUploadDraft({ ...FILLED, providerId: '', cost: ' ' });
  expect(draft.ready && draft.fields).toMatchObject({ providerId: null, costEur: null });
});

// PU1, the ruling of 9 October 2026 after #403: a file of the operator comes from the Internet.
test('a blank address gives no request, and the sentence asks where the file comes from', () => {
  for (const uri of ['', '   ']) {
    const draft = readUploadDraft({ ...FILLED, uri });
    expect(draft.ready ? 'ready' : draft.reason).toMatch(/address where the file comes from/u);
  }
});

test('each missing or wrong box gives its own sentence, and no request', () => {
  const reasons = [
    BLANK_UPLOAD,
    { ...FILLED, file: new File([], 'empty.pdf') },
    { ...FILLED, title: '  ' },
    { ...FILLED, retrievedAt: '' },
    { ...FILLED, uri: 'ftp://example.org/a' },
    { ...FILLED, cost: '-3' },
    { ...FILLED, cost: '1.005' },
    { ...FILLED, cost: 'twelve' },
  ].map((form) => {
    const draft = readUploadDraft(form);
    return draft.ready ? 'ready' : draft.reason;
  });
  expect(reasons).not.toContain('ready');
  expect(reasons[3]).toMatch(/day the file was retrieved/);
});
