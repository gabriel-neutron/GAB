import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import { MatchList, matchOptionId } from '@/shared/match-list';
import { matchesNamed, nextActive, type ScreenMatches } from '@/shared/screen-matches';
import { Input } from '@/shared/ui/input';

interface OfferedMatches extends ScreenMatches {
  readonly choose: (id: string) => void;
}

interface ScreenQueryState {
  readonly query: string;
  readonly setQuery: (query: string) => void;
  readonly setOffered: Dispatch<SetStateAction<OfferedMatches | null>>;
}

const ScreenQueryContext = createContext<ScreenQueryState | undefined>(undefined);

// Departure: the offered list has a context of its own, so a new list renders the field and
// never the screen that offered it.
const OfferedContext = createContext<OfferedMatches | null>(null);

interface HeldQuery {
  readonly path: string;
  readonly text: string;
}

// Departure: the filter belongs to one screen, so a new path clears it in the render that meets
// it. An effect would clear it one render late, and that render filters the new screen.
export function ScreenQueryProvider({ path, children }: { path: string; children: ReactNode }) {
  const [held, setHeld] = useState<HeldQuery>({ path, text: '' });
  const [offered, setOffered] = useState<OfferedMatches | null>(null);
  if (held.path !== path) setHeld({ path, text: '' });
  const query = held.path === path ? held.text : '';
  const value = useMemo<ScreenQueryState>(
    () => ({
      query,
      setQuery: (text: string) => {
        setHeld({ path, text });
      },
      setOffered,
    }),
    [query, path],
  );
  return (
    <ScreenQueryContext.Provider value={value}>
      <OfferedContext.Provider value={offered}>{children}</OfferedContext.Provider>
    </ScreenQueryContext.Provider>
  );
}

interface ScreenOffer {
  // External constraint: this list must be the same list at each render of the caller. A new
  // list at each render offers the field a new list at each render.
  readonly named: ScreenMatches['shown'];
  readonly choose: (id: string) => void;
}

// Departure: one screen offers its names, and the field under the header lists those that match.
// A choice there acts as a click on the same name in the screen does.
export function useScreenQuery(offer?: ScreenOffer): string {
  const context = useContext(ScreenQueryContext);
  const query = context?.query ?? '';
  const named = offer?.named;
  const matches = useMemo(
    () => (named === undefined ? null : matchesNamed(named, query)),
    [named, query],
  );

  // Departure: a caller may build `choose` at each render. The ref holds the choice of the last
  // render, so a new function offers no new list.
  const choose = useRef(offer?.choose);
  useEffect(() => {
    choose.current = offer?.choose;
  });

  const setOffered = context?.setOffered;
  useEffect(() => {
    if (setOffered === undefined || matches === null) return;
    const mine: OfferedMatches = {
      ...matches,
      choose: (id) => {
        choose.current?.(id);
      },
    };
    setOffered(mine);
    // Departure: a cleanup of an older offer must not drop the offer of a newer one.
    return () => {
      setOffered((current) => (current === mine ? null : current));
    };
  }, [setOffered, matches]);

  return query;
}

type Listing = { readonly open: false } | { readonly open: true; readonly row: number | null };

const CLOSED: Listing = { open: false };
const OPEN: Listing = { open: true, row: null };

export function ScreenQueryField() {
  const context = useContext(ScreenQueryContext);
  const offered = useContext(OfferedContext);
  if (context === undefined) throw new Error('ScreenQueryField must be used within its provider');
  const listId = useId();
  const [listing, setListing] = useState<Listing>(CLOSED);

  const count = offered?.shown.length ?? 0;
  const listed = listing.open && offered !== null && count > 0 ? offered : null;
  const activeRow =
    listed !== null && listing.open && listing.row !== null && listing.row < count
      ? listing.row
      : null;

  const choose = (id: string): void => {
    listed?.choose(id);
    setListing(CLOSED);
  };

  return (
    <div className="relative">
      <Input
        type="search"
        autoComplete="off"
        role="combobox"
        aria-label="Filter this screen"
        aria-autocomplete="list"
        aria-expanded={listed !== null}
        aria-controls={listed === null ? undefined : listId}
        aria-activedescendant={activeRow === null ? undefined : matchOptionId(listId, activeRow)}
        placeholder="Filter this screen"
        value={context.query}
        onChange={(event) => {
          context.setQuery(event.target.value);
          setListing(OPEN);
        }}
        onFocus={() => {
          setListing(OPEN);
        }}
        onBlur={() => {
          setListing(CLOSED);
        }}
        onKeyDown={(event) => {
          switch (event.key) {
            case 'ArrowDown':
            case 'ArrowUp': {
              event.preventDefault();
              const step = event.key === 'ArrowDown' ? 1 : -1;
              setListing({ open: true, row: nextActive(activeRow, step, count) });
              return;
            }
            case 'Enter': {
              const row = activeRow === null ? undefined : listed?.shown[activeRow];
              if (row === undefined) return;
              event.preventDefault();
              choose(row.id);
              return;
            }
            case 'Escape':
              // External constraint: Escape in a search field clears its text. An open list
              // takes the first Escape, and the second one clears the text.
              if (listed === null) return;
              event.preventDefault();
              setListing(CLOSED);
              return;
          }
        }}
        className="h-7 w-48"
      />
      {listed === null ? null : (
        <MatchList id={listId} matches={listed} active={activeRow} onChoose={choose} />
      )}
    </div>
  );
}
