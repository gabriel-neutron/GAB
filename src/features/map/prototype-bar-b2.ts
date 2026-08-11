/**
 * PROTOTYPE — throwaway. Left bar B2, "Overlay drawer".
 *
 * **The claim.** The map should never be resized by a panel. The bar floats over it, so the
 * camera holds still when the index opens and closes, and the map keeps its full width even
 * while the detail sidebar is open on the right. Closed, the bar is one narrow tab on the edge.
 *
 * **What it puts at risk.** An overlay hides map, and it hides exactly the part of the map the
 * bar is about — the left edge. It also needs a shadow and a solid ground, which the theme
 * permits only for a true overlay, so the bar is visually heavier than a rail.
 */

import { colourOfType, countOfType, entityTypes, geoEntities } from './prototype-corpus';
import { dot, el, MONO, PANEL, TRUNCATE } from './prototype-dom';
import { createHoverLabel } from './prototype-hover';
import { entityRow, rowsOfType, typeStrip } from './prototype-index';
import { mountMap } from './prototype-map';
import { patchMapWorkspace, readMapWorkspace } from './prototype-workspace';

export const NAME_B2 = 'Overlay drawer';

export function mountBarB2(host: HTMLElement): () => void {
  let open = readMapWorkspace().barOpen;

  const mapHost = el('div', { position: 'absolute', inset: '0' });
  host.appendChild(mapHost);

  // The drawer stands in the bottom left corner, so the attribution moves to the other one.
  const handle = mountMap(mapHost, colourOfType, 'bottom-right');
  const hover = createHoverLabel(host, 'label');

  // The drawer, and the tab that stands in for it when it is closed. Two nodes, because the
  // closed shape is not a narrow version of the open one — it is a different object.
  const drawer = el('div', {
    ...PANEL,
    position: 'absolute',
    top: '0',
    left: '0',
    bottom: '0',
    width: '340px',
    display: 'flex',
    flexDirection: 'column',
    borderTop: '0',
    borderBottom: '0',
    borderLeft: '0',
    boxShadow: '2px 0 12px rgba(0,0,0,0.45)',
    zIndex: '10',
  });

  const tab = el('div', {
    ...PANEL,
    position: 'absolute',
    top: '0',
    left: '0',
    bottom: '0',
    width: '30px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    borderTop: '0',
    borderBottom: '0',
    borderLeft: '0',
    boxShadow: '2px 0 12px rgba(0,0,0,0.45)',
    zIndex: '10',
  });

  host.append(drawer, tab);

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

  const toggle = (): void => {
    open = !open;
    patchMapWorkspace({ barOpen: open });
    render();
  };

  const renderTab = (): void => {
    tab.replaceChildren();
    const grip = el(
      'button',
      {
        width: '100%',
        flex: '1',
        border: '0',
        borderBottom: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--muted-foreground)',
        cursor: 'pointer',
        fontFamily: MONO,
        fontSize: '11px',
        letterSpacing: '0.12em',
        writingMode: 'vertical-rl',
        textTransform: 'uppercase',
      },
      'index',
    );
    grip.title = 'Open the index';
    grip.addEventListener('click', toggle);
    tab.append(grip, typeStrip(handle, render));
  };

  const renderDrawer = (): void => {
    drawer.replaceChildren();
    const selected = handle.selected();
    const query = search.value;
    const drawn = entityTypes
      .filter((type) => handle.isTypeVisible(type))
      .reduce((total, type) => total + rowsOfType(type, query).length, 0);

    const header = el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px',
      borderBottom: '1px solid var(--border)',
    });
    const close = el(
      'button',
      {
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--muted-foreground)',
        cursor: 'pointer',
        fontFamily: MONO,
        fontSize: '11px',
        padding: '0 5px',
      },
      '«',
    );
    close.title = 'Close the index';
    close.setAttribute('aria-label', 'Close the index');
    close.addEventListener('click', toggle);
    header.append(
      el('span', { fontWeight: '500', flex: '1' }, 'On the map'),
      el(
        'span',
        { fontFamily: MONO, fontSize: '11px', color: 'var(--muted-foreground)' },
        `${drawn} of ${geoEntities.length}`,
      ),
      close,
    );

    const list = el('div', { flex: '1', overflowY: 'auto' });

    for (const type of entityTypes) {
      const on = handle.isTypeVisible(type);
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

    drawer.append(header, search, list, footer);
  };

  const render = (): void => {
    drawer.style.display = open ? 'flex' : 'none';
    tab.style.display = open ? 'none' : 'flex';
    if (open) renderDrawer();
    else renderTab();
  };

  handle.onHover((entity, x, y) => {
    if (entity === null) hover.hide();
    else hover.show(entity, x, y);
  });
  handle.onSelect(render);

  render();

  return () => {
    handle.destroy();
    host.replaceChildren();
  };
}
