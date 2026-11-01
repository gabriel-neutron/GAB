import { createContext, useContext } from 'react';
import { en, type ReportPart } from './content';

// The shape of a copy: the words of the English copy are only examples of their type.
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : { readonly [K in keyof T]: Widen<T[K]> };

/** The content of the report in one locale: the parts, their notes and the words of the page. */
export type ReportContent = Omit<Widen<typeof en>, 'parts'> & {
  readonly parts: readonly ReportPart[];
};

/** The content of the page locale. A route of another locale gives its copy to the provider; the
 * root gives none, so the page reads English. */
export const ContentContext = createContext<ReportContent>(en);

/** The content of the current locale, for a part, a chart or a mark of the report. */
export const useContent = (): ReportContent => useContext(ContentContext);
