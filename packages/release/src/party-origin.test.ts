import { describe, expect, it } from 'vitest';

import { documentMark, documentParty, partyLabel, partyMark, partyOrigin } from './party-origin.ts';

const GUR = 'https://war-sanctions.gur.gov.ua/en/transport/ships/123';
const STAFF = 'https://t.me/GeneralStaffZSU/4567';
const KREMLIN = 'http://kremlin.ru/acts/news/1';
const OFAC = 'https://sanctionslistservice.ofac.treas.gov/changes/1';

describe('the party origin of a fact', () => {
  it('finds the publisher from the host, its subdomains, a t.me channel and an archive copy', () => {
    expect(documentParty(GUR)).toBe('UA');
    expect(documentParty(STAFF)).toBe('UA');
    expect(documentParty('https://t.me/s/generalstaffzsu?before=9')).toBe('UA');
    expect(documentParty(`https://web.archive.org/web/20240101000000id_/${GUR}`)).toBe('UA');
    expect(documentParty(KREMLIN)).toBe('RU');
  });

  it('gives no party for another publisher, a shared host or a look-alike host', () => {
    expect(documentParty(OFAC)).toBe('');
    expect(documentParty('https://t.me/astrapress/1')).toBe('');
    expect(documentParty('https://notgur.gov.ua.example.com/a')).toBe('');
    expect(documentParty('https://egrul.nalog.ru/x')).toBe('');
    expect(documentParty('not an address')).toBe('');
  });

  it('needs each cited document to be of one party', () => {
    expect(partyOrigin([GUR, STAFF])).toBe('UA');
    expect(partyOrigin([GUR, OFAC])).toBe('');
    expect(partyOrigin([GUR, KREMLIN])).toBe('');
    expect(partyOrigin([GUR, ''])).toBe('');
    expect(partyOrigin([])).toBe('');
  });

  it('states the origin and rates nothing', () => {
    expect(partyLabel([GUR])).toBe(
      'Cited source: GUR, the military intelligence of Ukraine. Ukraine is a party to the conflict. GAB cites no other source for this fact.',
    );
    expect(partyLabel([GUR, STAFF])).toBe(
      'Cited sources: state bodies of Ukraine. Ukraine is a party to the conflict. GAB cites no other source for this fact.',
    );
    expect(partyLabel([GUR, OFAC])).toBe('');
    expect(partyMark('RU')).toBe('Party source (Russia)');
    expect(documentMark(GUR)).toBe('Party source (Ukraine)');
    expect(documentMark(OFAC)).toBe('');
  });
});
