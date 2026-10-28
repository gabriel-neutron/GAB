import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { fieldBackground } from 'asciify-engine/kit';

import { Button } from '@/shared/ui/button';

/** The 404 of the site: one full page. The numerals fill it in characters that scatter under the
 * pointer, and break apart and form again when the reader leaves. One button goes to the report.
 * The numerals are the label of the field, so a screen reader hears the fault once. */
export function AsciiNotFound() {
  const art = useRef<HTMLDivElement>(null);
  const field = useRef<ReturnType<typeof fieldBackground> | null>(null);
  const leaving = useRef(false);
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
    <div className="relative h-full min-h-96">
      <div ref={art} className="absolute inset-0" />
      <div className="absolute inset-x-0 bottom-12 flex justify-center">
        <Button
          variant="outline"
          onClick={(event) => {
            if (leaving.current) return;
            leaving.current = true;
            const from = event.currentTarget;
            void (async () => {
              // The scatter is a flourish. A field that failed must not keep the reader here.
              try {
                await field.current?.scatter(from);
              } finally {
                await navigate({ to: '/' });
              }
            })();
          }}
        >
          Go to the report
        </Button>
      </div>
    </div>
  );
}
