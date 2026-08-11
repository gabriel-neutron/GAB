/**
 * PROTOTYPE — throwaway. Left bar B1, "Push rail".
 *
 * **The claim.** The bar is furniture. It sits beside the map, it takes its width from it, and
 * closing it gives that width back. Closed, it leaves a 44px strip that still carries the
 * colours, the counts and the switches, so the legend survives the close and only the list is
 * lost.
 *
 * **What it puts at risk.** The map is resized on every open and close, which moves what the
 * analyst was looking at. With the detail sidebar on the right as well, the map is squeezed from
 * both sides at once.
 */

import { colourOfType, countOfType, entityTypes, geoEntities } from './prototype-corpus';
import { dot, el, MONO, TRUNCATE } from './prototype-dom';
import { createHoverLabel } from './prototype-hover';
import { collapseButton, entityRow, rowsOfType, typeStrip } from './prototype-index';
import { mountMap } from './prototype-map';
import { patchMapWorkspace, readMapWorkspace } from './prototype-workspace';

export const NAME_B1 = 'Push rail';

export function mountBarB1(host: HTMLElement): () => void {
  host.style.display = 'flex';

  let open = readMapWorkspace().barOpen;

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

  // ---- the open rail ---------------------------------------------------------------------

  const search = el('input', {
    padding: '6px 8px',
    border: '0',
    borderBottom: '1px solid var(--border)',
    background: 'transparent',
    color: 'inherit',
    outline: 'none',
    fontSize: '12px',
  });
  search.placeholder = 'Filter the list';
  search.setAttribute('aria-label', 'Filter the list');
  search.addEventListener('input', () => {
    render();
  });

  const render = (): void => {
    rail.replaceChildren();
    rail.style.width = open ? '300px' : '44px';
    rail.style.flex = open ? '0 0 300px' : '0 0 44px';

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

    const header = el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px',
      borderBottom: '1px solid var(--border)',
    });
    const selected = handle.selected();
    const query = search.value;
    const drawn = entityTypes
      .filter((type) => handle.isTypeVisible(type))
      .reduce((total, type) => total + rowsOfType(type, query).length, 0);

    header.append(
      el('span', { fontWeight: '500', flex: '1' }, 'On the map'),
      el(
        'span',
        { fontFamily: MONO, fontSize: '11px', color: 'var(--muted-foreground)' },
        `${drawn} of ${geoEntities.length}`,
      ),
      collapseButton(true, toggle),
    );

    const list = el('div', { flex: '1', overflowY: 'auto' });

    for (const type of entityTypes) {
      const on = handle.isTypeVisible(type);

      // The group header is the layer entry: colour, count, switch. Reported to #36.
      const group = el('div', {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        cursor: 'pointer',
        background: 'var(--muted)',
        borderBottom: '1px solid var(--border)',
        opacity: on ? '1' : '0.5',
      });
      group.append(
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
      group.addEventListener('click', () => {
        handle.setTypeVisible(type, !on);
        render();
      });
      list.appendChild(group);

      if (!on) continue;

      for (const entity of rowsOfType(type, query)) {
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

    rail.append(header, search, list, footer);
  };

  function toggle(): void {
    open = !open;
    patchMapWorkspace({ barOpen: open });
    render();
  }

  handle.onHover((entity, x, y) => {
    if (entity === null) hover.hide();
    else hover.show(entity, x, y);
  });
  handle.onSelect(render);

  render();

  return () => {
    handle.destroy();
    host.replaceChildren();
    host.style.display = '';
  };
}
