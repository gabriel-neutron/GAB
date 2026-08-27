import { useId, useState } from 'react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

import type { LinkChoices } from './dossier';
import { linkWords, readLinkDraft, type LinkForm } from './link-draft';
import type { StructureAct } from './structure';

export interface NewRelationProps {
  /** The entity the address names. It is always the source end, so the direction is never a
   * question the analyst answers twice. */
  readonly srcId: string;
  readonly choices: LinkChoices;
  readonly busy: boolean;
  readonly onCreate: (act: StructureAct) => void;
}

const BLANK: LinkForm = { type: '', dstId: '', validFrom: '', validTo: '' };

const BOX = 'h-6 rounded-none px-1.5 py-0 text-xs md:text-xs';
const CAPTION = 'block text-small/4 tracking-caps text-label uppercase';
const SENTENCE = 'block text-small/4 text-label';

// The kit has no native select, and the edge of a control comes from `input` and never `border`.
// The `focus-visible` recipe is the kit's own, copied whole: `ring` alone paints `currentcolor`.
const CHOOSER =
  'h-6 w-full min-w-0 rounded-none border border-input bg-transparent px-1.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50';

export function NewRelation({ srcId, choices, busy, onCreate }: NewRelationProps) {
  // A half-typed relation dies with the view, exactly as a half-typed claim does.
  const [form, setForm] = useState<LinkForm>(BLANK);
  const typeBox = useId();
  const typeList = useId();
  const targetBox = useId();
  const fromBox = useId();
  const toBox = useId();

  const draft = readLinkDraft(srcId, form);

  const onSend = (): void => {
    if (!draft.ready || busy) return;
    setForm(BLANK);
    onCreate(draft.act);
  };

  return (
    <section aria-label="New relation from this entity" className="space-y-1 pt-2">
      <p className="text-small/4 tracking-caps text-label uppercase">
        New relation from this entity
      </p>

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <label htmlFor={typeBox} className={CAPTION}>
            Type
          </label>
          {/* The record holds no table of relation types, so the list is what the corpus already
              carries and never a closed set. A word outside it is written and accepted. */}
          <Input
            id={typeBox}
            list={typeList}
            className={BOX}
            value={form.type}
            disabled={busy}
            onChange={(event) => {
              setForm({ ...form, type: event.target.value });
            }}
          />
          <datalist id={typeList}>
            {choices.types.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <label htmlFor={targetBox} className={CAPTION}>
            Other end
          </label>
          <select
            id={targetBox}
            className={CHOOSER}
            value={form.dstId}
            disabled={busy}
            onChange={(event) => {
              setForm({ ...form, dstId: event.target.value });
            }}
          >
            <option value="" />
            {choices.targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-32 space-y-0.5">
          <label htmlFor={fromBox} className={CAPTION}>
            From
          </label>
          <Input
            id={fromBox}
            type="date"
            className={BOX}
            value={form.validFrom}
            disabled={busy}
            onChange={(event) => {
              setForm({ ...form, validFrom: event.target.value });
            }}
          />
        </div>

        <div className="w-32 space-y-0.5">
          <label htmlFor={toBox} className={CAPTION}>
            To
          </label>
          <Input
            id={toBox}
            type="date"
            className={BOX}
            value={form.validTo}
            disabled={busy}
            onChange={(event) => {
              setForm({ ...form, validTo: event.target.value });
            }}
          />
        </div>

        <Button type="button" size="xs" disabled={!draft.ready || busy} onClick={onSend}>
          Make the relation
        </Button>
      </div>

      <p className={SENTENCE}>{linkWords(draft)}</p>
    </section>
  );
}
