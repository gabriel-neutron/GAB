import { useId, useState } from 'react';

import type { AttributeEdit } from '@gab/proposal/attribute-value';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

import type { RecordRow } from './dossier';
import { ENTRY_ROW } from './entry-row';
import { mintWords, readMint, type MintForm } from './mint';

export interface NewClaimProps {
  /** The claims the entity holds. A key that stands here is corrected above, and never minted. */
  readonly rows: readonly RecordRow[];
  readonly busy: boolean;
  readonly onMint: (attrs: AttributeEdit) => void;
}

const BLANK: MintForm = { key: '', text: '' };

export function NewClaim({ rows, busy, onMint }: NewClaimProps) {
  const [form, setForm] = useState<MintForm>(BLANK);
  const keyBox = useId();
  const valueBox = useId();

  const draft = readMint(rows, form);

  const onSend = (): void => {
    if (!draft.ready || busy) return;
    setForm(BLANK);
    onMint(draft.attrs);
  };

  return (
    <section aria-label="New claim about this entity" className="space-y-1 pt-2">
      <p className={ENTRY_ROW.caption}>New claim about this entity</p>

      <div className="flex items-end gap-2">
        <div className="w-64 space-y-0.5">
          <label htmlFor={keyBox} className={ENTRY_ROW.caption}>
            Key
          </label>
          {/* No list of keys is offered. A suggestion is a vocabulary by another name, and the
              free half of the model carries none. */}
          <Input
            id={keyBox}
            className={ENTRY_ROW.box}
            value={form.key}
            disabled={busy}
            onChange={(event) => {
              setForm({ ...form, key: event.target.value });
            }}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <label htmlFor={valueBox} className={ENTRY_ROW.caption}>
            Value
          </label>
          <Input
            id={valueBox}
            className={ENTRY_ROW.box}
            value={form.text}
            disabled={busy}
            onChange={(event) => {
              setForm({ ...form, text: event.target.value });
            }}
          />
        </div>

        <Button type="button" size="xs" disabled={!draft.ready || busy} onClick={onSend}>
          Add the claim
        </Button>
      </div>

      {/* Nothing stores a kind, so the kind is read from the text. The analyst reads which one
          it took, before the act leaves the browser. */}
      <p className={ENTRY_ROW.sentence}>{mintWords(draft)}</p>
    </section>
  );
}
