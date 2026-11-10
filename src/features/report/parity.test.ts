import { describe, expect, it } from 'vitest';
import { parts, payUi } from './content';
import { parity, readSource, tokens } from './parity';
import { sources } from './source';

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

  it('fails when a frame field drops a part of its caption', () => {
    const edits = [
      { number: 4, field: 'period', to: '2023' },
      { number: 12, field: 'title', to: 'Who owns oil' },
      { number: 10, field: 'sources', to: 'Central Bank of Russia (2026).' },
    ] as const;
    for (const { number, field, to } of edits) {
      const changed = final.map((part) => ({
        ...part,
        blocks: part.blocks.map((block) =>
          block.figure?.number === number
            ? { ...block, figure: { ...block.figure, [field]: to } }
            : block,
        ),
      }));
      expect(parity(changed, sources.en)).toEqual([
        expect.stringMatching(new RegExp(`figure ${String(number)} fields differ$`)),
      ]);
    }
  });

  it('fails when a figure moves to another part', () => {
    const figure = final
      .find((part) => part.slug === 'fight')
      ?.blocks.find((block) => block.figure?.number === 11);
    if (figure === undefined) throw new Error('No figure 11');
    const changed = final.map((part) => ({
      ...part,
      blocks:
        part.slug === 'fight'
          ? part.blocks.filter((block) => block !== figure)
          : part.slug === 'ownership'
            ? [...part.blocks, figure]
            : part.blocks,
      notes:
        part.slug === 'fight'
          ? part.notes.filter((note) => note.id !== '85')
          : part.slug === 'ownership'
            ? [
                ...part.notes,
                ...(final.find((one) => one.slug === 'fight')?.notes ?? []).filter(
                  (note) => note.id === '85',
                ),
              ]
            : part.notes,
    }));
    expect(parity(changed, sources.en)).toContain('ownership: figure 11 not in its source part');
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

  it('quotes in each step of figure 4 the words of the pay part', () => {
    const text = final
      .find((part) => part.slug === 'pay')
      ?.blocks.map((block) => block.text)
      .join(' ');
    for (const step of payUi.f4.steps) expect(text).toContain(step.text);
  });
});
