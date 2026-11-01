import { cn } from '@/shared/lib/utils';
import { reportAddress } from './report-context';
import { useContent } from './use-content';

/** The address of `path` in the other locale, at the same anchor: `anchor` is a part slug or a
 * location hash, with or without its `#`. */
export const switchAddress = (path: string, anchor: string): string => {
  const id = anchor.replace(/^#/, '');
  return `${reportAddress(path)}${id === '' ? '' : `#${id}`}`;
};

interface LanguageSwitchProps {
  /** The page of the other locale: the report or its notes. */
  readonly page: 'report' | 'notes';
  /** The anchor to keep. With none, the switch keeps the hash of the address at the click. */
  readonly anchor?: string | undefined;
  readonly className?: string;
}

/** A text link to the same place in the other locale. It loads the other page, which sets its own
 * language. */
export function LanguageSwitch({ page, anchor, className }: LanguageSwitchProps) {
  const target = useContent().ui.switch;
  const path = target[page];
  return (
    <a
      href={switchAddress(path, anchor ?? '')}
      hrefLang={target.lang}
      lang={target.lang}
      // The name starts with the visible text, so a voice command that says it finds the link.
      aria-label={`${target.text}, ${target.label}`}
      onClick={(event) => {
        if (anchor === undefined)
          event.currentTarget.href = switchAddress(path, window.location.hash);
      }}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center font-mono text-report-label tracking-[0.08em] text-label underline decoration-border underline-offset-4 outline-none hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      {target.text}
    </a>
  );
}
