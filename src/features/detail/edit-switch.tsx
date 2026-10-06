import { Button } from '@/shared/ui/button';

export type DetailView = 'reading' | 'writing';

interface EditSwitchProps {
  readonly view: DetailView;
  /** An act is in flight. Its sentence stands in the writing view only, so the view holds. */
  readonly busy: boolean;
  readonly onSwitch: (view: DetailView) => void;
}

export function EditSwitch({ view, busy, onSwitch }: EditSwitchProps) {
  const writing = view === 'writing';

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      aria-pressed={writing}
      disabled={busy}
      onClick={() => {
        onSwitch(writing ? 'reading' : 'writing');
      }}
    >
      Edit
    </Button>
  );
}
