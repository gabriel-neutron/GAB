import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { DataTable } from './data-table';
import { KeyValue } from './key-value';
import { PageHeader } from './page-header';
import { PageSection } from './page-section';
import { ReadingPage } from './reading-page';
import { SourceEntry } from './source-entry';

// The specimen of a public page: each shared part in the order a record page uses them.
function Specimen() {
  return (
    <div className="h-svh">
      <ReadingPage>
        <PageHeader
          title="Ust-Luga oil terminal"
          detail={
            <span className="font-mono">facility · 45b7dba7-4e6e-41b0-9184-e4b54db83754</span>
          }
        />
        <KeyValue
          entries={[
            { key: 'Type', value: 'facility' },
            { key: 'Valid from', value: '2012-03-01', figure: true },
            { key: 'Valid to', value: null, figure: true },
          ]}
        />
        <PageSection title="Relations">
          <DataTable
            name="Relations"
            columns={[
              { key: 'type', header: 'Relation', cell: (row: { type: string }) => row.type },
            ]}
            rows={[{ id: 'r1', row: { type: 'operated by' } }]}
            empty="The release holds no relation of this entity."
          />
        </PageSection>
        <PageSection title="Sources">
          <SourceEntry
            source={{
              documentId: 'd1',
              title: 'Port authority annual report 2025',
              address: 'https://example.invalid/report-2025',
              readOn: '2026-05-11',
              passages: null,
            }}
          />
        </PageSection>
      </ReadingPage>
    </div>
  );
}

const meta = {
  component: Specimen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Specimen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OnePageTitleAndOneTitlePerSection: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await expect(canvas.getByRole('region', { name: 'Relations' })).toBeVisible();
    await expect(canvas.getByRole('region', { name: 'Sources' })).toBeVisible();
  },
};
