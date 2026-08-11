/**
 * PROTOTYPE — throwaway. Left bar B3, "Two-step rail".
 *
 * **The claim.** The bar's first job is the layer control, and the index is the second. So it
 * shows only the four type rows, and it opens one type at a time, in place. The list is one
 * click away instead of always present, and the bar is 240px instead of 300px because a row
 * never has to carry a full name at rest.
 *
 * It separates the two acts the other bars conflate. Showing and hiding a type is a control;
 * finding an entity is a search. Here the first is always at hand and the second is asked for.
 *
 * **What it puts at risk.** Every entity is now two clicks away, and an analyst who does not
 * know which type an entity is cannot find it at all without opening every group.
 */

import { colourOfType, countOfType, entityTypes } from './prototype-corpus';
import { dot, el, MONO, TRUNCATE } from './prototype-dom';
import { createHoverLabel } from './prototype-hover';
import { collapseButton, entityRow, rowsOfType, typeStrip } from './prototype-index';
import { mountMap } from './prototype-map';
import { patchMapWorkspace, readMapWorkspace } from './prototype-workspace';

export const NAME_B3 = 'Two-step rail';

export function mountBarB3(host: HTMLElement): () => void {
  host.style.display = 'flex';

  let open = readMapWorkspace().barOpen;
  // Which type is unfolded. One at a time, so the bar never becomes the full list by accident.
  // It is seeded below, from the selection the map restored out of the address: the map reads
  // `?entity=` inside its own constructor, which is before this bar can subscribe to it, so a
  // bar that only listened would open no group on a reload.
  let expanded: string | null = null;

  const rail = el('div', {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--background)',
    color: 'var(--foreground)',
    borderRight: '1px solid var(--border)',
    fontSize: '12px',
    overflow: 'hidden',
  });

  const mapHost = el('div', { flex: '1', position: 'relative', minWidth: '0' });
  host.append(rail, mapHost);

  const handle = mountMap(mapHost, colourOfType);
  const hover = createHoverLabel(mapHost, 'label');

  expanded = handle.selected()?.type ?? null;

  const toggle = (): void => {
    open = !open;
    patchMapWorkspace({ barOpen: open });
    render();
  };

  const render = (): void => {
    rail.replaceChildren();
    rail.style.width = open ? '240px' : '44px';
    rail.style.flex = open ? '0 0 240px' : '0 0 44px';

    if (!open) {
      const head = el('div', {
        display: 'flex',
        justifyContent: 'center',
        padding: '8px 0',
        borderBottom: '1px solid var(--border)',
      });
      head.appendChild(collapseButton(false, toggle));
      rail.append(head, typeStrip(handle, render));
      return;
    }

    const selected = handle.selected();

    const header = el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px',
      borderBottom: '1px solid var(--border)',
    });
    header.append(
      el('span', { fontWeight: '500', flex: '1' }, 'Layers'),
      collapseButton(true, toggle),
    );

    const list = el('div', { flex: '1', overflowY: 'auto' });

    for (const type of entityTypes) {
      const on = handle.isTypeVisible(type);
      const isOpen = expanded === type;

      const row = el('div', {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 8px',
        borderBottom: '1px solid var(--border)',
        background: isOpen ? 'var(--muted)' : 'transparent',
        opacity: on ? '1' : '0.5',
      });

      // Two targets on one row, and they are not the same act. The chevron opens the list; the
      // rest of the row switches the type. Whether that is discoverable is the thing to judge.
      const chevron = el(
        'button',
        {
          border: '0',
          background: 'transparent',
          color: 'var(--muted-foreground)',
          cursor: 'pointer',
          fontFamily: MONO,
          fontSize: '11px',
          padding: '0 2px',
          width: '14px',
        },
        isOpen ? '▾' : '▸',
      );
      chevron.title = isOpen ? `Close the ${type} list` : `Open the ${type} list`;
      chevron.addEventListener('click', () => {
        expanded = isOpen ? null : type;
        render();
      });

      const label = el('button', {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flex: '1',
        border: '0',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        font: 'inherit',
        padding: '0',
        textAlign: 'left',
      });
      label.append(
        dot(on ? colourOfType(type) : 'var(--muted-foreground)'),
        el(
          'span',
          { flex: '1', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '11px' },
          type,
        ),
        el('span', { fontFamily: MONO, fontSize: '11px' }, String(countOfType(type))),
        el(
          'span',
          { fontFamily: MONO, fontSize: '11px', color: 'var(--muted-foreground)', width: '24px' },
          on ? 'on' : 'off',
        ),
      );
      label.addEventListener('click', () => {
        handle.setTypeVisible(type, !on);
        render();
      });

      row.append(chevron, label);
      list.appendChild(row);

      if (!isOpen || !on) continue;

      // The second step. A field appears only for the type that is open, because a filter over
      // one type is a different question from a filter over the corpus.
      const search = el('input', {
        width: '100%',
        padding: '4px 8px 4px 22px',
        border: '0',
        borderBottom: '1px solid var(--border)',
        background: 'transparent',
        color: 'inherit',
        outline: 'none',
        fontSize: '11px',
      });
      search.placeholder = `Filter ${type}`;
      search.setAttribute('aria-label', `Filter ${type}`);
      search.value = queries.get(type) ?? '';
      search.addEventListener('input', () => {
        queries.set(type, search.value);
        render();
        // The field is rebuilt by `render`, so the caret has to be put back on the new node.
        const next = list.querySelector('input');
        if (next instanceof HTMLInputElement) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      });
      list.appendChild(search);

      for (const entity of rowsOfType(type, queries.get(type) ?? '')) {
        list.appendChild(
          entityRow(
            entity,
            selected !== null && selected.id === entity.id,
            () => {
              handle.select(entity);
              handle.flyTo(entity);
            },
            '22px',
          ),
        );
      }
    }

    const footer = el('div', {
      padding: '6px 8px',
      borderTop: '1px solid var(--border)',
      fontFamily: MONO,
      fontSize: '11px',
      color: 'var(--muted-foreground)',
      ...TRUNCATE,
    });
    footer.textContent = selected === null ? 'No selection' : selected.id;

    rail.append(header, list, footer);
  };

  const queries = new Map<string, string>();

  // A selection made on the map opens the group it belongs to, so the rail always agrees with
  // the map about what is being examined.
  handle.onSelect((entity) => {
    if (entity !== null) expanded = entity.type;
    render();
  });

  handle.onHover((entity, x, y) => {
    if (entity === null) hover.hide();
    else hover.show(entity, x, y);
  });

  render();

  return () => {
    handle.destroy();
    host.replaceChildren();
    host.style.display = '';
  };
}
