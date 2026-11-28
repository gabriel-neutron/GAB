import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Dialog, Popover } from 'radix-ui';
import { documentMark } from '@gab/release/party-origin';
import { cn } from '@/shared/lib/utils';
import { citeText, entryOf, keysOf, noteText, shortNoteNumbers } from './bibliography';
import { EntryText } from './entry-text';
import { useMarginScreen } from './margin-screen';
import { reportAddress } from './report-context';
import { noteDocuments } from './note-documents';
import { useContent, type ReportPath } from './use-content';

const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring';
const CAPTION = 'font-mono text-report-label uppercase text-label';
const UNDERLINE =
  'underline decoration-border underline-offset-4 hover:decoration-foreground break-all';
const EASE = [0.4, 0, 0.2, 1] as const;

interface NoteRefProps {
  readonly partSlug: string;
  readonly id: string;
  /** A small marker in place of the reference: for a figure source line or a value, whose words
   * already name the source. */
  readonly compact?: boolean;
}

// Two exports, one job: the marker links to the anchor that the notes page writes.
/** The anchor of one note on the notes page. */
export const noteAnchor = (partSlug: string, id: string): string => `note-${partSlug}-${id}`;
/** The anchor of one entry on the bibliography page. */
export const entryAnchor = (key: string): string => `ref-${key}`;

/** The note in full: the entries that it cites, its short note, its documents of the record, its
 * quote, and the way to the bibliography. A note with no document shows its entries only. */
function NoteBody({ partSlug, id }: NoteRefProps) {
  const { parts, ui } = useContent();
  const note = parts.find((part) => part.slug === partSlug)?.notes.find((one) => one.id === id);
  const held = noteDocuments(id);
  const documents = held?.documents ?? [];
  const quote = held?.quote;
  if (note === undefined) return null;
  const keys = keysOf(note.text);
  const short = noteText(note.text);
  const cite = citeText(note.text);
  return (
    <div className="space-y-3">
      {cite === '' ? null : <p className="text-report-small break-words">({cite})</p>}
      {/* The way to the bibliography comes first: a long note scrolls in its box. */}
      <Link
        to={`/${ui.paths.notes}` as ReportPath}
        hash={short === '' ? entryAnchor(keys[0] ?? '') : noteAnchor(partSlug, id)}
        className={cn('inline-flex min-h-11 items-center text-report-small', UNDERLINE, FOCUS)}
      >
        {ui.note.all}
      </Link>
      <ul className="space-y-2">
        {keys.map((key) => (
          <li key={key} className="text-report-small">
            <EntryText entry={entryOf(key)} />
          </li>
        ))}
      </ul>
      {short === '' ? null : (
        <p className="border-t border-divider pt-3 text-report-small break-words">{short}</p>
      )}
      {documents.length === 0 ? null : (
        <section className="border-t border-divider pt-3">
          <h3 className={CAPTION}>
            {ui.note.documents} · {documents.length}
          </h3>
          <ul className="mt-2 space-y-2">
            {documents.map((document) => (
              <li key={document.id} className="text-report-small">
                <span className="block font-mono text-report-label text-label">
                  {document.id} · {document.type.replaceAll('_', ' ')} · {ui.note.retrieved}{' '}
                  {document.retrievedAt}
                  {[documentMark(document.url)]
                    .filter((mark) => mark !== '')
                    .map((mark) => ` · ${mark}`)}
                </span>
                <a href={document.url} className={cn(UNDERLINE, FOCUS)}>
                  {document.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {quote === undefined ? null : (
        <blockquote className="border-l border-border pl-3 text-report-small">
          <p>{quote.text}</p>
          <footer className="mt-1 font-mono text-report-label text-label">{quote.document}</footer>
        </blockquote>
      )}
    </div>
  );
}

// The note sits beside the text block of its marker, at the height of the marker. A block with
// `data-note-block` holds more than one column of text: its notes go beside the whole block.
const besideText = (button: HTMLElement | null): DOMRect => {
  if (button === null) return new DOMRect();
  const line = button.getBoundingClientRect();
  const block = (
    button.closest('[data-note-block]') ??
    button.closest('p, li, figcaption') ??
    button
  ).getBoundingClientRect();
  return new DOMRect(block.left, line.top, block.width, line.height);
};

/** A reference of the text: the short reference in its parenthesis, a link to its first entry on
 * the bibliography page, with the number of its short note when it has one. From 1280px a click
 * opens the note in the margin beside its paragraph; under 1280px, in a bottom sheet. Escape closes
 * the note, and the focus goes back to the reference. A compact reference is a small marker. */
export function NoteRef({ partSlug, id, compact = false }: NoteRefProps) {
  const { parts, ui } = useContent();
  const note = parts.find((part) => part.slug === partSlug)?.notes.find((one) => one.id === id);
  if (note === undefined) return null;
  const number = shortNoteNumbers(parts.flatMap((part) => part.notes)).get(id);
  const cite = citeText(note.text);
  const body = <NoteBody partSlug={partSlug} id={id} />;
  if (compact)
    return (
      <Marker
        name={`${ui.note.label}: ${cite === '' ? String(number ?? '') : cite}`}
        mark={number === undefined ? ui.note.mark : String(number)}
      >
        {body}
      </Marker>
    );
  return (
    <Marker
      name={`${ui.note.label}: ${cite === '' ? String(number ?? '') : cite}`}
      inline={
        <>
          {cite === '' ? null : `(${cite})`}
          {number === undefined ? null : (
            <span className="ml-0.5 align-super font-mono text-report-label/none">{number}</span>
          )}
        </>
      }
      href={`${ui.paths.notes}#${entryAnchor(keysOf(note.text)[0] ?? '')}`}
    >
      {body}
    </Marker>
  );
}

/** The credit of one image of the page, with the note marker: the number of the image on the notes
 * page. An image with no credit shows no marker. */
export function ImageCredit({ src }: { readonly src: string }) {
  const { ui } = useContent();
  const { items } = ui.bibliography.images;
  const index = items.findIndex((item) => src.includes(item.file));
  const item = items[index];
  if (item === undefined) return null;
  const mark = String(index + 1);
  return (
    <Marker name={`${ui.note.image} ${mark}`} mark={mark}>
      <a
        href={item.href}
        // A credit is words, not a long address: it breaks between words.
        className={cn(
          'inline-flex min-h-11 items-center text-report-small',
          UNDERLINE,
          'break-normal',
          FOCUS,
        )}
      >
        {item.credit}
      </a>
    </Marker>
  );
}

/** The marker button and the note it opens: in the margin from 1280px, in a sheet under it. */
function Marker({
  name,
  mark = '',
  inline,
  href = '',
  children,
}: {
  readonly name: string;
  readonly mark?: string;
  /** The words of an in-text reference: the trigger is then a link of the text, not a marker. */
  readonly inline?: ReactNode;
  readonly href?: string;
  readonly children: ReactNode;
}) {
  const { ui } = useContent();
  const margin = useMarginScreen();
  const [open, setOpen] = useState(false);
  const marker = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  // A note that crosses 1280px closes, because the margin note and the sheet are two trees, and
  // the marker mounts again in the other one; the count asks the new marker to take the focus.
  const [shownAt, setShownAt] = useState(margin);
  const [refocus, setRefocus] = useState(0);
  if (shownAt !== margin) {
    setShownAt(margin);
    if (open) {
      setOpen(false);
      setRefocus(refocus + 1);
    }
  }
  // An adapter: the new marker takes the focus that the closed note held.
  useEffect(() => {
    if (refocus > 0) marker.current?.focus();
  }, [refocus]);
  // True when the reader closes the note from the note or its marker: only then the focus goes
  // back to the marker. A click or a Tab to another control keeps the focus there.
  const giveBack = useRef(false);
  const noteId = useId();
  const anchor = useRef({
    getBoundingClientRect: () => besideText(marker.current),
    // The scroll parents of the marker move the note with the text.
    get contextElement() {
      return marker.current ?? undefined;
    },
  });
  const reference =
    inline === undefined ? null : (
      <a
        ref={marker}
        href={reportAddress(href)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? noteId : undefined}
        // A click opens the note; a click with a modifier key opens the bibliography.
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          giveBack.current = open;
          setOpen(!open);
        }}
        className={cn(
          'note-cite text-label decoration-border underline-offset-4 hover:text-foreground hover:underline aria-expanded:text-foreground',
          'transition-colors duration-150',
          FOCUS,
        )}
      >
        {inline}
      </a>
    );
  const button = (
    <button
      ref={marker}
      type="button"
      aria-label={name}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={margin && open ? noteId : undefined}
      // The sheet trigger toggles the dialog itself; the margin note has no trigger of the kit.
      onClick={
        margin
          ? () => {
              giveBack.current = open;
              setOpen(!open);
            }
          : undefined
      }
      className={cn(
        // A comma between two markers that follow each other, so "2" and "3" do not read as "23".
        'note-ref relative ml-0.5 cursor-pointer [&:has(+.note-ref)]:after:content-[","]',
        'align-super font-mono text-report-label/none text-label',
        'transition-colors duration-150 hover:text-foreground aria-expanded:text-foreground',
        // A centred 44px box for a finger; it does not move the text.
        'before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-1/2 before:content-[""]',
        FOCUS,
      )}
    >
      {mark}
    </button>
  );
  if (margin)
    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        {/* The note anchors to its text block, not to the marker, so the marker is no trigger of
            the kit: a trigger can take the anchor back when it mounts again. */}
        {reference ?? button}
        <Popover.Anchor virtualRef={anchor} />
        <Popover.Portal>
          <Popover.Content
            side="right"
            align="start"
            sideOffset={24}
            // The bottom pad keeps the note clear of the fixed bar at the foot of the page.
            collisionPadding={{ top: 16, right: 16, bottom: 48, left: 16 }}
            id={noteId}
            aria-label={name}
            onEscapeKeyDown={() => {
              giveBack.current = true;
            }}
            onInteractOutside={(event) => {
              // A click on the marker toggles the note; it is no click outside.
              if (event.target instanceof Node && marker.current?.contains(event.target) === true)
                event.preventDefault();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (giveBack.current) marker.current?.focus();
              giveBack.current = false;
            }}
            // The margin of a 1280px screen can be narrower than the note: the note takes what is free.
            className="z-40 max-h-[70svh] w-[min(18rem,var(--radix-popper-available-width))] overflow-y-auto overscroll-contain border border-border bg-surface p-3 text-foreground outline-none"
          >
            <p className={cn(CAPTION, 'mb-2')}>{name}</p>
            {children}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* A link of the text opens the sheet itself: a trigger of the kit would follow the link. */}
      {reference ?? <Dialog.Trigger asChild>{button}</Dialog.Trigger>}
      <AnimatePresence>
        {open ? (
          <Dialog.Portal key="note" forceMount>
            <Dialog.Overlay forceMount asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-background/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              forceMount
              asChild
              aria-describedby={undefined}
              id={noteId}
              onCloseAutoFocus={(event) => {
                // The kit gives the focus back to its trigger; a link of the text is none.
                if (reference === null) return;
                event.preventDefault();
                marker.current?.focus();
              }}
            >
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85svh] flex-col border-t border-border bg-surface text-foreground outline-none"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <div className="flex items-center justify-between gap-2 py-2 pr-2 pl-4">
                  <Dialog.Title className={CAPTION}>{name}</Dialog.Title>
                  <Dialog.Close
                    className={cn(
                      'flex h-11 items-center gap-1.5 border border-input px-3 font-mono text-report-label uppercase text-label',
                      'transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground',
                      FOCUS,
                    )}
                  >
                    <X size={14} aria-hidden="true" />
                    {ui.panel.close}
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
