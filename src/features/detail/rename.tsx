import { useId, useState } from 'react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

import { ENTRY_ROW } from './entry-row';
import { readRenameDraft, renameWords, type NameAndType } from './rename-draft';
import type { StructureAct } from './structure';

export interface RenameProps {
  readonly entityId: string;
  readonly stored: NameAndType;
  readonly choices: readonly { readonly key: string; readonly name: string }[];
  readonly busy: boolean;
  readonly onRename: (act: StructureAct) => void;
}

export function Rename({ entityId, stored, choices, busy, onRename }: RenameProps) {
  const [form, setForm] = useState<NameAndType>(stored);
  const nameBox = useId();
  const typeBox = useId();

  const draft = readRenameDraft(entityId, stored, form);

  const onSend = (): void => {
    if (!draft.ready || busy) return;
    onRename(draft.act);
  };

  return (
    <section aria-label="Name and type" className="space-y-1">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <label htmlFor={nameBox} className={ENTRY_ROW.caption}>
            Entity name
          </label>
          <Input
            id={nameBox}
            className={ENTRY_ROW.box}
            value={form.label}
            disabled={busy}
            onChange={(event) => {
              setForm({ ...form, label: event.target.value });
            }}
          />
        </div>

        <div className="w-48 space-y-0.5">
          <label htmlFor={typeBox} className={ENTRY_ROW.caption}>
            Entity type
          </label>
          <select
            id={typeBox}
            className={ENTRY_ROW.chooser}
            value={form.type}
            disabled={busy}
            onChange={(event) => {
              setForm({ ...form, type: event.target.value });
            }}
          >
            {choices.map((choice) => (
              <option key={choice.key} value={choice.key}>
                {choice.name}
              </option>
            ))}
          </select>
        </div>

        <Button type="button" size="xs" disabled={!draft.ready || busy} onClick={onSend}>
          Save the name and the type
        </Button>
      </div>

      <p className={ENTRY_ROW.sentence}>{renameWords(draft)}</p>
    </section>
  );
}
