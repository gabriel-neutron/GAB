import { describe, expect, it } from 'vitest';
import { parts } from './content';
import { parseMarks } from './marks';
import { reportGraph } from './report-graph';

describe('parseMarks', () => {
  it('splits text into words, node references, notes and styles', () => {
    expect(parseMarks('**Price:** see [[N-P026|Rosneft]].[^S-8] *Title*')).toEqual([
      { kind: 'text', text: 'Price:', bold: true, italic: false },
      { kind: 'text', text: ' see ', bold: false, italic: false },
      { kind: 'node', id: 'N-P026', text: 'Rosneft', bold: false, italic: false },
      { kind: 'text', text: '.', bold: false, italic: false },
      { kind: 'note', id: 'S-8' },
      { kind: 'text', text: ' ', bold: false, italic: false },
      { kind: 'text', text: 'Title', bold: false, italic: true },
    ]);
  });

  it('keeps a text with no mark as one run', () => {
    expect(parseMarks('plain')).toEqual([
      { kind: 'text', text: 'plain', bold: false, italic: false },
    ]);
  });

  it('leaves no mark character in the text of the report', () => {
    const leftovers = parts.flatMap((part) =>
      [...part.blocks, ...part.notes]
        .flatMap((block) => parseMarks(block.text))
        .flatMap((run) =>
          run.kind !== 'note' && /\[\[|\]\]|\[\^|\*/.test(run.text)
            ? [`${part.slug}: ${run.text}`]
            : [],
        ),
    );
    expect(leftovers).toEqual([]);
  });
});

describe('reportGraph', () => {
  it('counts the documents of the nodes and the relations once each', () => {
    const { counts } = reportGraph;
    expect(counts.documents).toBeGreaterThan(0);
    expect(counts.sources).toBe(parts.reduce((sum, part) => sum + part.notes.length, 0));
  });

  it('finds each node that a part names', () => {
    const missing = parts.flatMap((part) =>
      part.nodeIds.filter((id) => reportGraph.node(id) === undefined),
    );
    expect(missing).toEqual([]);
  });
});
