import { describe, expect, it } from 'vitest';
import { parts, payUi } from './content';
import { parity, readSource, tokens } from './parity';
import { sources } from './source';

// The parts that show the final text.
const FINAL = ['summary', 'introduction', 'method-chronology', 'pay', 'ports-fleet'];
const final = parts.filter((part) => FINAL.includes(part.slug));

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

  it('quotes in each step of figure 4 the words of the pay part', () => {
    const text = final
      .find((part) => part.slug === 'pay')
      ?.blocks.map((block) => block.text)
      .join(' ');
    for (const step of payUi.f4.steps) expect(text).toContain(step.text);
  });
});
