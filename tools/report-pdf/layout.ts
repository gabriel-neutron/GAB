// The layout pass of the report PDF. Chromium runs `layout` in the printed page, before the print:
// the function must hold all its code, because Playwright sends only its text to the browser.
//
// The templates are the pages of the design. Where the notes of a page do not fit at its foot,
// the pass moves the end of the page body to the next page of the same part, line by line, so
// that each note stays whole on the page of its call. Where no next page of the same part is
// there, it first makes the notes of that page smaller (never below 7 pt), then adds a page.
// The pass also makes the links of the notes, and it reports each fault that remains.

export interface LayoutInput {
  /** The label of the added link line of a note. */
  readonly linkLabel: string;
  /** The URL of a source document for each note number, from an exact match only. */
  readonly links: Readonly<Record<string, string>>;
}

export interface LayoutResult {
  readonly faults: string[];
  readonly internalLinks: number;
  readonly textUrls: number;
  readonly addedLinks: number;
  readonly notesWithNoLink: number;
  readonly pages: number;
}

export function layout({ linkLabel, links }: LayoutInput): LayoutResult {
  const URL = /https?:\/\/[^\s<]*[^\s<.,;)]/g;
  const LINK = 'color: inherit; text-decoration: none';
  // The size and the leading of the notes, from the size of the design to 7 pt.
  const SIZES = [
    ['12px', '16px'],
    ['11px', '14.5px'],
    ['10px', '13.5px'],
    ['9.5px', '12.5px'],
  ] as const;
  // The first pages (cover, summary, contents, figures, introduction) are fixed: no text comes
  // into them from another page.
  const FIXED = 5;

  const sheets = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.sheet'));
  const columnOf = (sheet: Element): HTMLElement | undefined =>
    Array.from(sheet.querySelectorAll<HTMLElement>('div')).find(
      (div) => div.style.height === '955px',
    );
  const bodyOf = (column: HTMLElement): HTMLElement => column.children[0] as HTMLElement;
  const footOf = (column: HTMLElement): HTMLElement => column.children[1] as HTMLElement;
  const isRow = (el: Element): boolean =>
    (el as HTMLElement).style.gridTemplateColumns !== '' && el.children.length === 2;
  const rowsOf = (column: HTMLElement): HTMLElement[] =>
    Array.from(footOf(column).querySelectorAll<HTMLElement>(':scope > div > div')).filter(isRow);
  const numberOf = (row: Element): string => row.firstElementChild?.textContent.trim() ?? '';
  const over = (column: HTMLElement): boolean => column.scrollHeight > column.clientHeight;
  const folioOf = (sheet: Element): HTMLElement | null =>
    sheet.firstElementChild?.lastElementChild as HTMLElement | null;
  const isHeading = (el: Element): boolean =>
    el.matches('h1, h2, h3') || el.querySelector(':scope > h2, :scope > h3') !== null;
  const startsPart = (column: HTMLElement): boolean =>
    Array.from(bodyOf(column).children).some(
      (el) => el.matches('h2') || el.querySelector(':scope > h2'),
    );

  // 1. The links of the notes. Each URL of the text is a link, each "n. X" goes to note X, and a
  // note with no URL gets one link line when a document matches it exactly.
  let internalLinks = 0;
  let textUrls = 0;
  let addedLinks = 0;
  let notesWithNoLink = 0;
  const allRows = sheets().flatMap((sheet) => {
    const column = columnOf(sheet);
    return column ? rowsOf(column) : [];
  });
  for (const row of allRows) row.id = `note-${numberOf(row)}`;
  // The model of an empty block of notes: its box and its short rule.
  const model = allRows[0]?.parentElement ?? null;
  const wrap = (text: Text, pattern: RegExp, href: (match: string) => string | null): number => {
    let count = 0;
    let node = text;
    for (;;) {
      pattern.lastIndex = 0;
      const match = pattern.exec(node.data);
      if (!match) break;
      const target = href(match[0]);
      const rest: Text = node.splitText(match.index);
      const after = rest.splitText(match[0].length);
      if (target !== null) {
        const a = document.createElement('a');
        a.href = target;
        a.setAttribute('style', LINK);
        rest.replaceWith(a);
        a.append(rest);
        count += 1;
      }
      node = after;
    }
    return count;
  };
  const textNodes = (root: Node): Text[] => {
    const out: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) out.push(walker.currentNode as Text);
    return out;
  };
  for (const row of allRows) {
    const text = row.children[1] as HTMLElement;
    let urls = 0;
    for (const node of textNodes(text))
      urls += wrap(node, new RegExp(URL.source, 'g'), (url) => url);
    for (const node of textNodes(text))
      internalLinks += wrap(node, /\bn\. (\d+)/g, (match) => {
        const id = `note-${match.slice(3)}`;
        return document.getElementById(id) ? `#${id}` : null;
      });
    textUrls += urls;
    if (urls > 0) continue;
    const url = links[numberOf(row)];
    if (url === undefined) {
      notesWithNoLink += 1;
      continue;
    }
    const line = document.createElement('span');
    line.setAttribute('style', 'display: block');
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('style', LINK);
    a.textContent = url;
    line.append(`${linkLabel} `, a);
    text.append(line);
    addedLinks += 1;
  }

  // 2. Each note goes to the page of its call, in the order of the numbers.
  const rehome = (): void => {
    const all = sheets();
    const pageOfCall = new Map<string, HTMLElement>();
    for (const sheet of all) {
      const column = columnOf(sheet);
      if (!column) continue;
      for (const sup of Array.from(bodyOf(column).querySelectorAll('sup[data-fn]')))
        if (!pageOfCall.has(sup.getAttribute('data-fn') ?? ''))
          pageOfCall.set(sup.getAttribute('data-fn') ?? '', column);
    }
    for (const sheet of all) {
      const column = columnOf(sheet);
      if (!column) continue;
      for (const row of rowsOf(column)) {
        const home = pageOfCall.get(numberOf(row));
        if (home === undefined || home === column) continue;
        let box = footOf(home).firstElementChild as HTMLElement | null;
        if (box === null && model !== null) {
          box = model.cloneNode(false) as HTMLElement;
          const rule = model.firstElementChild;
          if (rule) box.append(rule.cloneNode(true));
          footOf(home).append(box);
        }
        const next = rowsOf(home).find((other) => Number(numberOf(other)) > Number(numberOf(row)));
        if (next) next.before(row);
        else box?.append(row);
      }
    }
    for (const sheet of all) {
      const column = columnOf(sheet);
      const box = column ? footOf(column).firstElementChild : null;
      if (column && box && rowsOf(column).length === 0) box.remove();
    }
  };

  // The start of each line of a paragraph, as a point in its text.
  const lines = (p: HTMLElement): { node: Text; offset: number }[] => {
    const out: { node: Text; offset: number }[] = [];
    let top = -Infinity;
    for (const node of textNodes(p)) {
      if (node.parentElement?.closest('sup')) continue;
      for (const word of node.data.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, word.index);
        range.setEnd(node, word.index + 1);
        const rect = range.getClientRects()[0];
        if (rect && rect.top > top + 2) {
          out.push({ node, offset: word.index });
          top = rect.top;
        }
      }
    }
    return out;
  };
  const plain = (p: Element): string => {
    const copy = p.cloneNode(true) as Element;
    copy.querySelectorAll('sup').forEach((sup) => sup.remove());
    return copy.textContent.trim();
  };
  // A paragraph that ends with no stop goes on at the top of the next page.
  const goesOn = (p: Element, next: Element | null): boolean =>
    next?.tagName === 'P' && !/[.!?:;»”"')\]…]$/.test(plain(p));

  // The pages that the pass changed.
  const touched = new Set<HTMLElement>();
  // Move the end of the body of a page to the next page: at the top of its body, or just after
  // the element `after` of its body.
  const push = (from: HTMLElement, to: HTMLElement, after: Element | null = null): boolean => {
    const body = bodyOf(from);
    const target = bodyOf(to);
    const last = body.lastElementChild as HTMLElement | null;
    if (last === null || body.children.length < 2) return false;
    touched.add(from);
    touched.add(to);
    let anchor = after ? after.nextElementSibling : target.firstElementChild;
    const put = (el: Element): void => {
      if (anchor) anchor.before(el);
      else target.append(el);
      anchor = el;
    };
    if (last.tagName === 'P') {
      const starts = lines(last);
      const head = anchor;
      const joins = head !== null && goesOn(last, head);
      // At least two lines of a paragraph stay at the foot of a page and at the top of the next.
      const moved = joins ? 1 : 2;
      if (starts.length - moved >= 2) {
        const start = starts[starts.length - moved];
        if (start === undefined) return false;
        const range = document.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(last, last.childNodes.length);
        const tail = range.extractContents();
        if (joins) head.prepend(tail, ' ');
        else {
          const p = last.cloneNode(false) as HTMLElement;
          p.append(tail);
          put(p);
        }
        return true;
      }
      if (joins) {
        head.prepend(...Array.from(last.childNodes), ' ');
        last.remove();
      } else put(last);
    } else put(last);
    // A heading stays with the text that follows it.
    while (body.lastElementChild && isHeading(body.lastElementChild) && body.children.length > 1)
      put(body.lastElementChild);
    return true;
  };

  // A new page after `sheet`: the same frame, with no body and no notes, and the next folio.
  const addPage = (sheet: HTMLElement): HTMLElement | undefined => {
    const all = sheets();
    const styles = new Map<number, string>();
    for (const other of all) {
      const folio = folioOf(other);
      const number = Number(folio?.textContent);
      if (folio && Number.isInteger(number) && number > 0)
        styles.set(number % 2, folio.getAttribute('style') ?? '');
    }
    const copy = sheet.cloneNode(true) as HTMLElement;
    const column = columnOf(copy);
    if (!column) return undefined;
    bodyOf(column).replaceChildren();
    footOf(column).replaceChildren();
    copy.setAttribute('data-added', '');
    sheet.after(copy);
    const start = all.indexOf(sheet) + 1;
    for (const other of sheets().slice(start)) {
      const folio = folioOf(other);
      const number = Number(folio?.textContent);
      if (!folio || !Number.isInteger(number) || number <= 0) continue;
      folio.textContent = String(number + 1);
      folio.setAttribute('style', styles.get((number + 1) % 2) ?? '');
    }
    return column;
  };

  const sized = (column: HTMLElement, [size, leading]: readonly [string, string]): void => {
    for (const row of rowsOf(column)) {
      row.style.fontSize = size;
      row.style.lineHeight = leading;
    }
  };

  rehome();
  const faults: string[] = [];
  for (let index = 0; index < sheets().length; index += 1) {
    const sheet = sheets()[index];
    const column = sheet ? columnOf(sheet) : undefined;
    if (!sheet || !column) continue;
    for (let step = 0; over(column) && step < 400; step += 1) {
      const next = sheets()[index + 1];
      const nextColumn = next ? columnOf(next) : undefined;
      const added = next?.hasAttribute('data-added') === true;
      // A page of the design gives its end to the next page of the same part.
      if (nextColumn && index >= FIXED && !added && !startsPart(nextColumn)) {
        if (!push(column, nextColumn)) break;
        rehome();
        continue;
      }
      // Else the notes of the page get smaller, and only then the end of the page goes to a new
      // page, a step at a time, until the page fits.
      const size = SIZES.find((candidate) => {
        sized(column, candidate);
        return !over(column);
      });
      if (size) break;
      sized(column, SIZES[0]);
      const target = added ? nextColumn : addPage(sheet);
      if (!target || !push(column, target)) break;
      rehome();
    }
  }

  // A page that the pass changed has no hole: while four lines or more are free at its foot, the
  // start of the next page of the same part comes back, a block at a time (the design fills a
  // page while four lines are free). A block that does not fit goes back, cut at a line.
  const LINE = 24;
  const free = (column: HTMLElement): number =>
    footOf(column).getBoundingClientRect().top - bodyOf(column).getBoundingClientRect().bottom;
  for (let index = FIXED; index < sheets().length - 1; index += 1) {
    const column = columnOf(sheets()[index] as HTMLElement);
    const next = sheets()[index + 1];
    const nextColumn = next ? columnOf(next) : undefined;
    if (!column || !nextColumn || !touched.has(column) || !touched.has(nextColumn)) continue;
    if (startsPart(nextColumn)) continue;
    // A figure that does not fit stays at the top of the next page, and the text after it comes
    // back before it (the rule of floats of the design).
    let figure: Element | null = null;
    for (let step = 0; step < 100 && free(column) >= 4 * LINE; step += 1) {
      const body = bodyOf(column);
      const source = bodyOf(nextColumn);
      const first = figure ? figure.nextElementSibling : source.firstElementChild;
      if (first === null) break;
      const last = body.lastElementChild;
      const joins = first.tagName === 'P' && last !== null && goesOn(last, first);
      if (joins) {
        last.append(' ', ...Array.from(first.childNodes));
        first.remove();
      } else {
        body.append(first);
        // A heading comes back with the block that follows it.
        const after = figure ? figure.nextElementSibling : source.firstElementChild;
        if (isHeading(first) && after) body.append(after);
      }
      rehome();
      if (!over(column)) continue;
      if (!joins && first.tagName === 'FIGURE' && figure === null) {
        source.prepend(first);
        rehome();
        figure = first;
        continue;
      }
      for (let back = 0; over(column) && back < 100; back += 1) {
        if (!push(column, nextColumn, figure)) break;
        rehome();
      }
      break;
    }
  }
  // A page that the pass added and that is now empty goes away.
  for (const sheet of sheets()) {
    const column = columnOf(sheet);
    if (!sheet.hasAttribute('data-added') || !column || bodyOf(column).children.length > 0)
      continue;
    const start = sheets().indexOf(sheet) + 1;
    const styles = new Map<number, string>();
    for (const other of sheets()) {
      const folio = folioOf(other);
      const number = Number(folio?.textContent);
      if (folio && Number.isInteger(number) && number > 0)
        styles.set(number % 2, folio.getAttribute('style') ?? '');
    }
    for (const other of sheets().slice(start)) {
      const folio = folioOf(other);
      const number = Number(folio?.textContent);
      if (!folio || !Number.isInteger(number) || number <= 1) continue;
      folio.textContent = String(number - 1);
      folio.setAttribute('style', styles.get((number - 1) % 2) ?? '');
    }
    sheet.remove();
  }

  // 3. The page numbers of the contents and of the list of figures.
  for (const entry of Array.from(
    document.querySelectorAll<HTMLElement>('a[href^="#sec-"], a[href^="#fig-"]'),
  )) {
    if (entry.children.length < 3) continue;
    const target = document.getElementById(entry.getAttribute('href')?.slice(1) ?? '');
    const page = target?.closest('.sheet');
    const folio = page ? folioOf(page) : null;
    let number: Element | null = entry.lastElementChild;
    while (number?.firstElementChild) number = number.firstElementChild;
    if (folio && number) number.textContent = folio.textContent;
  }

  // 4. The checks: no clipped element, each note whole and on the page of its call.
  const all = sheets();
  all.forEach((sheet, index) => {
    const page = `page ${index + 1}`;
    for (const box of [sheet, ...Array.from(sheet.querySelectorAll<HTMLElement>('*'))]) {
      if (box.closest('[aria-hidden="true"]')) continue;
      const style = getComputedStyle(box);
      if (style.overflow === 'visible' && box !== sheet) continue;
      if (box.querySelector('[aria-hidden="true"]')) {
        const frame = box.getBoundingClientRect();
        for (const inner of Array.from(box.querySelectorAll('*'))) {
          if (inner.closest('[aria-hidden="true"]')) continue;
          const rect = inner.getBoundingClientRect();
          if (rect.height > 0 && (rect.bottom > frame.bottom + 1 || rect.right > frame.right + 1))
            faults.push(`${page}: ${inner.tagName.toLowerCase()} is cut by the page`);
        }
      } else if (box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1)
        faults.push(
          `${page}: ${box.tagName.toLowerCase()} "${box.textContent.slice(0, 40)}" is cut`,
        );
    }
    const column = columnOf(sheet);
    if (!column) return;
    const bottom = column.getBoundingClientRect().bottom;
    for (const row of rowsOf(column)) {
      const number = numberOf(row);
      if (row.getBoundingClientRect().bottom > bottom + 1)
        faults.push(`${page}: note ${number} does not fit on the page`);
      const call = document.querySelector(`.sheet sup[data-fn="${number}"]`);
      if (call?.closest('.sheet') !== sheet)
        faults.push(`${page}: note ${number} is not on the page of its call`);
    }
  });
  return { faults, internalLinks, textUrls, addedLinks, notesWithNoLink, pages: all.length };
}
