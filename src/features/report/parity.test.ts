import { describe, expect, it } from 'vitest';
import { parts, payUi } from './content';
import { parity, readSource, tokens } from './parity';
import { frParts } from './parts-fr';
import { rekey, sources } from './source';
import { noteTwins } from './source/note-twins';

// All parts show the final text.
const final = parts;
const FINAL = sources.en.starts.map(([slug]) => slug);

describe('parity of the report text', () => {
  it('reads the numbers, the months and the notes of a text, not the digits of a node id', () => {
    expect(tokens('In June 2025, [[N-P026|Rosneft]] fell by 5,200 or 2.6%.[^12]')).toEqual([
      'June',
      '2025',
      '5,200',
      '2.6',
      '^12',
    ]);
  });

  it('finds every part of the English text in the source', () => {
    expect(final.map((part) => part.slug)).toEqual(FINAL);
    const { body } = readSource(sources.en);
    for (const slug of FINAL) expect(body.get(slug)?.length).toBeGreaterThan(0);
  });

  it('keeps the numbers, the dates and the notes of the final English text', () => {
    expect(parity(final, sources.en)).toEqual([]);
  });

  it('holds each note of the final text once, and no other note', () => {
    const held = parts.flatMap((part) => part.notes.map((note) => note.id));
    expect(held).toEqual([...readSource(sources.en).notes.keys()]);
  });

  it('fails when one number of a block changes', () => {
    const changed = final.map((part) => ({
      ...part,
      blocks: part.blocks.map((block) => ({ ...block, text: block.text.replace('84%', '85%') })),
    }));
    expect(parity(changed, sources.en)).toEqual([
      expect.stringMatching(/^summary: body .* 85 \^1 /),
      'summary: body words differ',
    ]);
  });

  it('fails when a heading is not a subheading of its part in the source', () => {
    const changed = final.map((part) => ({
      ...part,
      blocks: part.blocks.map((block) =>
        block.kind === 'h3' && block.text === 'The buyers' ? { ...block, text: 'Buyers' } : block,
      ),
    }));
    expect(parity(changed, sources.en)).toEqual(['pay: heading "Buyers" not in source']);
  });

  it('fails when a word or a figure field changes', () => {
    const changed = final.map((part) => ({
      ...part,
      blocks: part.blocks.map((block) => ({
        ...block,
        text: block.text.replace('in roubles rose', 'in roubles fell'),
        ...(block.figure === undefined
          ? {}
          : {
              figure: {
                ...block.figure,
                sources: block.figure.sources.replace('(2026)', '(2025)'),
              },
            }),
      })),
    }));
    const issues = parity(changed, sources.en);
    expect(issues).toContain('pay: body words differ');
    expect(issues).toContain('pay: figure 3 fields differ');
  });

  it('fails when a note moves or its words change', () => {
    const [summary] = final;
    if (summary === undefined) throw new Error('No summary');
    const moved = {
      ...summary,
      blocks: summary.blocks.map((block) => ({ ...block, text: block.text.replace('[^1]', '') })),
      notes: summary.notes.map((note) => ({ ...note, text: `${note.text} ` })),
    };
    expect(parity([moved], sources.en)).toContain('summary: note 1 not cited');
    expect(parity([moved], sources.en)).toContain('summary: note 2 differs');
  });

  it('keeps the numbers, the dates and the notes of the French text (V4)', () => {
    expect(frParts.map((part) => part.slug)).toEqual(FINAL);
    expect(parity(frParts, sources.fr)).toEqual([]);
  });

  it('gives each English note one French twin, and each French note one English id', () => {
    const french = readSource(sources.fr);
    const english = readSource(sources.en);
    expect(Object.keys(noteTwins)).toEqual([...english.notes.keys()]);
    for (const [id, twin] of Object.entries(noteTwins))
      if (twin !== null) expect(french.notes.get(id)).toBeDefined();
    // The French page holds the notes of the English page that have a twin, with the same ids.
    const held = frParts.flatMap((part) => part.notes.map((note) => note.id));
    expect(new Set(held)).toEqual(
      new Set(Object.keys(noteTwins).filter((id) => noteTwins[id] !== null)),
    );
  });

  it('gives a French marker the English id of the same place, and a repeat the next id', () => {
    const text = 'a[^x] b[^x]\n\n[^x]: Note.';
    expect(rekey(text, { '1': 'x', '2': 'x', '3': null })).toBe(
      'a[^1] b[^2]\n\n[^1]: Note.\n[^2]: Note.',
    );
  });

  it('quotes in each step of figure 4 the words of the pay part', () => {
    const text = final
      .find((part) => part.slug === 'pay')
      ?.blocks.map((block) => block.text)
      .join(' ');
    for (const step of payUi.f4.steps) expect(text).toContain(step.text);
  });
});
