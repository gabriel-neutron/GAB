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
  // A URL ends before a stop or a closing bracket of the sentence; a pair of brackets inside it stays.
  const URL = /https?:\/\/(?:\([^\s<()]*\)|[^\s<()])*(?:\([^\s<()]*\)|[^\s<.,;()])/g;
  const LINK = 'color: inherit; text-decoration: none';
  // The size and the leading of the notes, from the size of the design to 7 pt.
  const SIZES = [
    ['12px', '16px'],
    ['11px', '14.5px'],
    ['10px', '13.5px'],
    ['9.5px', '12.5px'],
  ] as const;
  // The size and the leading of the text of the introduction, when it must be smaller to fit on one page.
  const TEXT = [
    ['14px', '20px'],
    ['13.5px', '19px'],
    ['13px', '18.5px'],
    ['12.7px', '18px'],
  ] as const;
  // The first pages (cover, summary, contents, list of figures) are fixed: no text comes into them
  // from another page.
  const FIXED = 4;
  // A part starts on the page of the part before it when this room (in px) is free on that page.
  const JOIN = 190;

  const sheets = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.sheet'));
  const sheetAt = (index: number): HTMLElement => {
    const sheet = sheets()[index];
    if (!sheet) throw new Error(`page ${index} is missing`);
    return sheet;
  };
  const columnOf = (sheet: Element): HTMLElement | undefined =>
    Array.from(sheet.querySelectorAll<HTMLElement>('div')).find((div) => {
      const height = parseInt(div.style.height, 10);
      return height > 900 && height < 1100 && div.style.flexDirection === 'column';
    });
  const columnAt = (index: number): HTMLElement => {
    const column = columnOf(sheetAt(index));
    if (!column) throw new Error(`page ${index} has no column`);
    return column;
  };
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
      const [size = '', leading = ''] = column?.dataset['notes']?.split(' ') ?? [];
      if (column && size !== '')
        for (const row of rowsOf(column)) {
          row.style.fontSize = size;
          row.style.lineHeight = leading;
        }
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
    p.tagName === 'P' && next?.tagName === 'P' && !/[.!?:;»”"')\]…]$/.test(plain(p));

  // A new page after `sheet`: the same frame, with no body and no notes, and the next folio.
  const folioStyles = (): Map<number, string> => {
    const styles = new Map<number, string>();
    for (const other of sheets()) {
      const folio = folioOf(other);
      const number = Number(folio?.textContent);
      if (folio && Number.isInteger(number) && number > 0)
        styles.set(number % 2, folio.getAttribute('style') ?? '');
    }
    return styles;
  };
  const renumber = (from: number, step: 1 | -1, styles: Map<number, string>): void => {
    for (const other of sheets().slice(from)) {
      const folio = folioOf(other);
      const number = Number(folio?.textContent);
      if (!folio || !Number.isInteger(number) || number <= 0) continue;
      folio.textContent = String(number + step);
      folio.setAttribute('style', styles.get((number + step) % 2) ?? '');
    }
  };
  const addPage = (sheet: HTMLElement): void => {
    const styles = folioStyles();
    const copy = sheet.cloneNode(true) as HTMLElement;
    const column = columnOf(copy);
    if (!column) return;
    bodyOf(column).replaceChildren();
    footOf(column).replaceChildren();
    delete column.dataset['notes'];
    copy.setAttribute('data-added', '');
    sheet.after(copy);
    renumber(sheets().indexOf(copy), 1, styles);
  };

  // The notes of one page keep one size: the page keeps it, and each note that comes in takes it.
  const sized = (column: HTMLElement, [size, leading]: readonly [string, string]): void => {
    column.dataset['notes'] = `${size} ${leading}`;
    for (const row of rowsOf(column)) {
      row.style.fontSize = size;
      row.style.lineHeight = leading;
    }
  };

  // The edge of a page: no margin above its first block, and none below its last one.
  const style = document.createElement('style');
  style.textContent =
    '[data-body] > :first-child { margin-top: 0 !important } [data-body] > :last-child { margin-bottom: 0 !important }';
  document.head.append(style);
  for (const sheet of sheets()) {
    const column = columnOf(sheet);
    if (!column) continue;
    bodyOf(column).setAttribute('data-body', '');
    // The body holds its floats, so that its height is the height of its content.
    bodyOf(column).style.display = 'flow-root';
  }

  rehome();
  const faults: string[] = [];

  const keepNext = (el: Element): boolean =>
    isHeading(el) || (el.tagName === 'FIGURE' && getComputedStyle(el).float !== 'none');

  // The head and the tail of a paragraph, cut at the start of a line.
  const cut = (
    p: HTMLElement,
    at: { node: Text; offset: number },
  ): { head: HTMLElement; tail: HTMLElement } => {
    const index = textNodes(p).indexOf(at.node);
    const copy = (keepTail: boolean): HTMLElement => {
      const c = p.cloneNode(true) as HTMLElement;
      const node = textNodes(c)[index];
      const range = document.createRange();
      if (keepTail) {
        range.setStart(c, 0);
        range.setEnd(node ?? c, node ? at.offset : 0);
      } else {
        range.setStart(node ?? c, node ? at.offset : 0);
        range.setEnd(c, c.childNodes.length);
      }
      range.deleteContents();
      c.setAttribute('data-cut', '');
      return c;
    };
    const head = copy(false);
    const tail = copy(true);
    tail.removeAttribute('id');
    tail.style.textIndent = '0';
    return { head, tail };
  };

  // The text of one page fills the page: the blocks that fit, then the lines of the next
  // paragraph that fit (three lines at least stay at the foot, three at least go to the next page).
  const fill = (column: HTMLElement, nextColumn: HTMLElement): void => {
    const body = bodyOf(column);
    const nextBody = bodyOf(nextColumn);
    let blocks = Array.from(body.children) as HTMLElement[];
    const lead = parseFloat(getComputedStyle(body.querySelector('p') ?? body).lineHeight) || 20;
    // The figures that go to the top of the next page, with the text after them filling this page.
    let deferred: HTMLElement[] = [];
    const put = (m: number, split?: { head: HTMLElement; tail: HTMLElement }): void => {
      body.replaceChildren(...blocks.slice(0, m), ...(split ? [split.head] : []));
      nextBody.replaceChildren(
        ...deferred,
        ...(split ? [split.tail] : []),
        ...blocks.slice(m + (split ? 1 : 0)),
      );
      rehome();
    };
    const search = (): { m: number; split?: { head: HTMLElement; tail: HTMLElement } } => {
      let lo = 0;
      let hi = blocks.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        put(mid);
        if (over(column)) hi = mid - 1;
        else lo = mid;
      }
      if (lo === blocks.length) return { m: lo };
      const next = blocks[lo];
      if (next?.tagName === 'P') {
        put(lo + 1);
        const starts = lines(next);
        let low = 2;
        let high = starts.length - 3;
        let best: { head: HTMLElement; tail: HTMLElement } | undefined;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          const at = starts[mid];
          if (!at) break;
          const split = cut(next, at);
          put(lo, split);
          if (over(column)) high = mid - 1;
          else {
            low = mid;
            best = split;
          }
        }
        if (best) return { m: lo, split: best };
      }
      return { m: lo };
    };

    const gap = (): number =>
      footOf(column).getBoundingClientRect().top - body.getBoundingClientRect().bottom;
    // The best split of the blocks: a heading, or a float, stays with the block that follows it.
    const plan = (): {
      m: number;
      split?: { head: HTMLElement; tail: HTMLElement } | undefined;
      gap: number;
    } => {
      const found = search();
      const { split } = found;
      let { m } = found;
      if (!split) while (m > 0 && keepNext(blocks[m - 1] as Element)) m -= 1;
      put(m, split);
      return { m, split, gap: gap() };
    };
    let best = plan();
    // A figure that does not fit goes to the top of the next page, and the text after it comes
    // back to fill this page.
    let swapped = false;
    for (let figures = 0; figures < 3 && !best.split && best.gap >= 3 * lead; figures += 1) {
      let at = best.m;
      while (blocks[at] && keepNext(blocks[at] as Element) && blocks[at]?.tagName !== 'FIGURE')
        at += 1;
      const figure = blocks[at];
      const after = blocks[at + 1];
      if (figure?.tagName !== 'FIGURE' || !after || after.tagName === 'FIGURE') break;
      const saved = blocks;
      const kept = deferred;
      if (keepNext(figure)) {
        // A float stays beside text: it gives way to one paragraph only.
        if (after.tagName !== 'P' || swapped) break;
        swapped = true;
        blocks = [...saved.slice(0, at), after, figure, ...saved.slice(at + 2)];
      } else {
        deferred = [...kept, figure];
        blocks = saved.filter((block) => block !== figure);
      }
      const other = plan();
      if (other.gap < best.gap - lead) best = other;
      else {
        deferred = kept;
        blocks = saved;
        best = plan();
        break;
      }
    }
    if (best.m === 0 && !best.split) {
      // Nothing fits: the notes of the page get smaller, then the first block goes to the page.
      const size = SIZES.find((candidate) => {
        sized(column, candidate);
        put(1);
        return !over(column);
      });
      if (!size) sized(column, SIZES[0]);
      best = { m: 1, gap: 0 };
    }
    put(best.m, best.split);
    blocks = Array.from(nextBody.children) as HTMLElement[];
  };

  // The text of one part (from its first page to the page before the next part) flows page by
  // page, from the first page of the part.
  // With `join`, the next part follows the text of its page, and the flow goes on from there. The
  // result is the index of the last page of the flow.
  const flow = (first: number, join: boolean): number => {
    let end = first + 1;
    let starts = join ? 1 : 0;
    for (; end < sheets().length; end += 1) {
      const next = columnOf(sheetAt(end));
      if (!next) break;
      if (startsPart(next)) {
        if (starts === 0) break;
        starts -= 1;
      }
    }
    const host = bodyOf(columnAt(first));
    for (let j = first + 1; j < end; j += 1) {
      const source = bodyOf(columnAt(j));
      while (source.firstElementChild) {
        const el = source.firstElementChild;
        const last = host.lastElementChild;
        if (last && goesOn(last, el)) {
          last.append(' ', ...Array.from(el.childNodes));
          el.remove();
        } else {
          // The title of a part that follows text has some room above it.
          if (join && isHeading(el) && host.children.length > 0)
            (el as HTMLElement).style.marginTop = '40px';
          host.append(el);
        }
      }
    }
    rehome();
    for (let k = first; k < 400; k += 1) {
      const column = columnAt(k);
      if (!over(column)) break;
      if (k + 1 >= end) {
        addPage(sheetAt(k));
        end += 1;
      }
      fill(column, columnAt(k + 1));
    }
    // A page with no body goes away.
    for (let k = end - 1; k > first; k -= 1) {
      const sheet = sheetAt(k);
      const column = columnAt(k);
      if (bodyOf(column).children.length > 0) continue;
      footOf(column).replaceChildren();
      const styles = folioStyles();
      sheet.remove();
      renumber(k, -1, styles);
      end -= 1;
    }
    return end - 1;
  };

  // The notes of a fixed page get smaller when they do not fit.
  for (const sheet of sheets().slice(0, FIXED)) {
    const column = columnOf(sheet);
    if (column && over(column) && !SIZES.some((size) => (sized(column, size), !over(column))))
      sized(column, SIZES[0]);
  }

  // The introduction fits on one page when it can: first the text, then the notes, get smaller.
  const intro = document.getElementById('sec-1')?.closest('.sheet');
  const introColumn = intro ? columnOf(intro) : undefined;
  if (introColumn) {
    // The float of the introduction needs no room below it.
    const float = bodyOf(introColumn).querySelector<HTMLElement>(':scope > figure');
    if (float) float.style.marginBottom = '0';
    const paragraphs = Array.from(bodyOf(introColumn).querySelectorAll<HTMLElement>(':scope > p'));
    const fitted = [null, ...TEXT].some((step) => {
      for (const p of paragraphs) {
        if (step) [p.style.fontSize, p.style.lineHeight] = step;
      }
      return SIZES.some((candidate) => {
        sized(introColumn, candidate);
        return !over(introColumn);
      });
    });
    if (!fitted) sized(introColumn, SIZES[0]);
  }

  // The label of the running header of each part title, read before the text moves.
  const labelOf = new Map<Element, string>();
  const headerOf = (column: HTMLElement): HTMLElement | null =>
    (column.previousElementSibling?.lastElementChild as HTMLElement | null) ?? null;
  for (const sheet of sheets()) {
    const column = columnOf(sheet);
    const label = column ? headerOf(column)?.textContent : undefined;
    if (column && label !== undefined)
      for (const h2 of Array.from(bodyOf(column).querySelectorAll('h2'))) labelOf.set(h2, label);
  }
  const room = (column: HTMLElement): number =>
    footOf(column).getBoundingClientRect().top - bodyOf(column).getBoundingClientRect().bottom;
  for (let index = FIXED; index < sheets().length; index += 1) {
    const column = columnOf(sheetAt(index));
    if (!column || !startsPart(column)) continue;
    // A part that ends on a page with much room left is followed by the next part on that page.
    let last = flow(index, false);
    for (let guard = 0; guard < 10; guard += 1) {
      const lastColumn = columnAt(last);
      const next = sheets()[last + 1];
      const nextColumn = next ? columnOf(next) : undefined;
      if (!nextColumn || !startsPart(nextColumn) || room(lastColumn) < JOIN) break;
      last = flow(last, true);
    }
  }

  // The running header of a page names the part of its first text.
  let current = '';
  for (const sheet of sheets()) {
    const column = columnOf(sheet);
    if (!column) continue;
    const titles = Array.from(bodyOf(column).querySelectorAll('h2'));
    const first = bodyOf(column).firstElementChild;
    const label =
      first && titles.length > 0 && (first.matches('h2') || first.querySelector('h2'))
        ? labelOf.get(titles[0] as Element)
        : current;
    const header = headerOf(column);
    if (header && label) header.textContent = label;
    const last = titles[titles.length - 1];
    current = (last ? labelOf.get(last) : undefined) ?? label ?? current;
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
      // The ASCII picture of the cover is a decoration, cut by its frame on purpose.
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
    // A paragraph cut at the foot or at the top of a page keeps three lines at least on the page.
    const body = bodyOf(column);
    for (const [place, el] of [
      ['top', body.firstElementChild],
      ['foot', body.lastElementChild],
    ] as const)
      if (el?.tagName === 'P' && el.hasAttribute('data-cut') && lines(el as HTMLElement).length < 3)
        faults.push(`${page}: a paragraph has fewer than 3 lines at the ${place} of the page`);
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
  // Each call has one note, and each note one call.
  const calls = Array.from(document.querySelectorAll('.sheet sup[data-fn]')).map(
    (sup) => sup.getAttribute('data-fn') ?? '',
  );
  const notes = Array.from(document.querySelectorAll('.sheet [id^="note-"]')).map((row) =>
    row.id.slice('note-'.length),
  );
  for (const number of new Set([...calls, ...notes]))
    if (calls.filter((call) => call === number).length !== 1 || !notes.includes(number))
      faults.push(`note ${number} has no row, no call, or more than one call`);
  return { faults, internalLinks, textUrls, addedLinks, notesWithNoLink, pages: all.length };
}
