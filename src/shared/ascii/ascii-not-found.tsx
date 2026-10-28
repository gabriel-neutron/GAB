import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { fieldBackground } from 'asciify-engine/kit';

import { Button } from '@/shared/ui/button';

/** The 404 of the site: the numerals in characters that scatter under the pointer, and break apart
 * and form again when the reader leaves for the home page. The words and the button stay HTML. */
export function AsciiNotFound() {
  const art = useRef<HTMLDivElement>(null);
  const home = useRef<HTMLButtonElement>(null);
  const field = useRef<ReturnType<typeof fieldBackground> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (art.current === null) return undefined;
    const lost = fieldBackground(art.current, { preset: 'notFound', text: '404' });
    field.current = lost;
    return () => {
      field.current = null;
      lost.destroy();
    };
  }, []);

  return (
    <div className="flex flex-col items-start gap-4">
      <div ref={art} className="h-56 w-full max-w-3xl border border-border" />
      <Button
        ref={home}
        variant="outline"
        onClick={() => {
          void (async () => {
            if (field.current !== null && home.current !== null)
              await field.current.scatter(home.current);
            await navigate({ to: '/' });
          })();
        }}
      >
        Go to the report
      </Button>
    </div>
  );
}
