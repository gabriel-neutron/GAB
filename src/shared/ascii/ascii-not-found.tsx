import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { fieldBackground } from 'asciify-engine/kit';

import { Button } from '@/shared/ui/button';

/** The 404 of the site: the numerals in characters that scatter under the pointer, and break apart
 * and form again when the reader leaves for the report. The words and the buttons stay HTML, and
 * the numerals are decoration: the heading of the page already says the fault. */
export function AsciiNotFound({ children }: { readonly children?: ReactNode }) {
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
    <div className="flex flex-col items-start gap-4">
      <div ref={art} aria-hidden="true" className="h-56 w-full max-w-3xl border border-border" />
      <div className="flex gap-2">
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
        {children}
      </div>
    </div>
  );
}
