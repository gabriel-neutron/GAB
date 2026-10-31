import { describe, expect, it } from 'vitest';
import { parts } from './content';
import nodes from './nodes-data';

const ids = new Set(nodes.map((node) => node.node_id));

describe('report content', () => {
  it('resolves each node reference to a node of the report data', () => {
    const missing = parts.flatMap((part) =>
      part.blocks.flatMap((block) =>
        [...block.text.matchAll(/\[\[([^|\]]+)\|/g)]
          .map((match) => match[1] ?? '')
          .filter((id) => !ids.has(id))
          .map((id) => `${part.slug}: ${id}`),
      ),
    );
    expect(missing).toEqual([]);
  });

  it('gives each note marker a note in its part', () => {
    const missing = parts.flatMap((part) => {
      const notes = new Set(part.notes.map((note) => note.id));
      return part.blocks.flatMap((block) =>
        [...block.text.matchAll(/\[\^([^\]]+)\]/g)]
          .map((match) => match[1] ?? '')
          .filter((id) => !notes.has(id))
          .map((id) => `${part.slug}: ${id}`),
      );
    });
    expect(missing).toEqual([]);
  });
});
