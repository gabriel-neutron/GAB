import { useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { loadCorpus } from '@/shared/read/corpus';
import { useScreenQuery } from '@/shared/screen-query';

interface Named {
  readonly id: string;
  readonly label: string;
}

// External constraint: the list offered to the field must be the same list at each render.
const NONE: readonly Named[] = [];

/** Offers the name of each entity to the field of the header, and opens the page of the entity
 * that the reader chooses. The graph offers its own names, so it does not draw this one. */
export function SiteSearch() {
  const router = useRouter();
  const [named, setNamed] = useState<readonly Named[]>(NONE);
  useEffect(() => {
    let live = true;
    loadCorpus().then(
      (corpus) => {
        if (live) setNamed(corpus.entities.map(({ id, label }) => ({ id, label })));
      },
      // A record that cannot be read leaves the field with no name. The page shows the fault.
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  useScreenQuery({
    named,
    choose: (id) => {
      void router.navigate({ to: '/entity/$id', params: { id }, search: { src: null } });
    },
  });
  return null;
}
