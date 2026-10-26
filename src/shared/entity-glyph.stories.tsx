import type { Meta, StoryObj } from '@storybook/react-vite';

import { EntityGlyph } from '@/shared/entity-glyph';
import { RelationLine, type RelationLineFamily } from '@/shared/relation-line';

const TYPES = [
  'vessel',
  'port',
  'facility',
  'company',
  'bank',
  'person',
  'state_body',
  'legal_act',
  'military_unit',
  'event',
  'unknown',
];
const FAMILIES: readonly RelationLineFamily[] = [
  'ownership',
  'designation',
  'operation',
  'transfer',
  'other',
];

const meta = {
  title: 'Shared/Data marks',
  component: EntityGlyph,
  args: { type: 'vessel' },
} satisfies Meta<typeof EntityGlyph>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The eleven shapes, filled (promoted) then hollow (candidate), and the five line samples. */
export const Marks: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-6">
      {[false, true].map((candidate) => (
        <div key={String(candidate)} className="flex items-center gap-3">
          {TYPES.map((type) => (
            <EntityGlyph key={type} type={type} candidate={candidate} size={20} />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-3">
        {FAMILIES.map((family) => (
          <RelationLine key={family} family={family} />
        ))}
      </div>
    </div>
  ),
};
