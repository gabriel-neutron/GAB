/**
 * PROTOTYPE — throwaway. Variant B, "Left rail index".
 *
 * **The claim.** An analyst cannot search for a name they have not read yet. The corpus is
 * finite and small, so the honest control is the whole list, grouped by type, always visible.
 * The group header **is** the layer entry: it carries the colour, the count and the visibility.
 * There is no separate layer panel and no separate filter, because after the operator removed
 * presentation settings and editing, nothing was left for a second control to hold.
 *
 * **What it puts at risk.** The rail takes 300px of a screen whose whole point is the map, and
 * a real corpus of 10k entities does not fit in a list.
 */

import {
  colourOfType,
  countOfType,
  entityTypes,
  geoEntities,
  type GeoEntity,
} from './prototype-corpus';
import { dot, el, MONO, TRUNCATE } from './prototype-dom';
import { createHoverLabel } from './prototype-hover';
import { mountMap } from './prototype-map';

export const NAME_B = 'Left rail index';

export function mountVariantB(host: HTMLElement): () => void {
  // The shell gives the stage `position: absolute; inset: 0`, so it already fills the screen and
  // is already a positioned ancestor for the overlays below. Do **not** set `position` here: a
  // `relative` on this node drops the `inset`, the stage collapses to no height, and the chrome
  // still looks correct over a map that is one pixel tall.
  host.style.display = 'flex';

  // ---- the rail --------------------------------------------------------------------------

  const rail = el('div', {
    width: '300px',
    flex: '0 0 300px',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--background)',
    color: 'var(--foreground)',
    borderRight: '1px solid var(--border)',
    fontSize: '12px',
    zIndex: '10',
  });

  const header = el('div', {
    padding: '8px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  });
  header.append(
    el('span', { fontWeight: '500' }, 'On the map'),
    el(
      'span',
      { fontFamily: MONO, fontSize: '11px', color: 'var(--muted-foreground)' },
      `${geoEntities.length} of ${geoEntities.length}`,
    ),
  );

  const search = el('input', {
    margin: '0',
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

  const list = el('div', { flex: '1', overflowY: 'auto' });

  const footer = el('div', {
    padding: '6px 8px',
    borderTop: '1px solid var(--border)',
    fontFamily: MONO,
    fontSize: '11px',
    color: 'var(--muted-foreground)',
    minHeight: '20px',
    ...TRUNCATE,
  });
  footer.textContent = 'No selection';

  rail.append(header, search, list, footer);

  const mapHost = el('div', { flex: '1', position: 'relative' });
  host.append(rail, mapHost);

  const handle = mountMap(mapHost, colourOfType);
  const hover = createHoverLabel(mapHost, 'label');

  // ---- rendering -------------------------------------------------------------------------

  const visibleRows = (type: string): GeoEntity[] => {
    const query = search.value.trim().toLowerCase();
    return geoEntities.filter(
      (entity) =>
        entity.type === type && (query === '' || entity.label.toLowerCase().includes(query)),
    );
  };

  const render = (): void => {
    list.replaceChildren();
    const selected = handle.selected();
    let counted = 0;

    for (const type of entityTypes) {
      const on = handle.isTypeVisible(type);
      const rows = visibleRows(type);
      if (on) counted += rows.length;

      // The group header. Colour, count and visibility on one row — this is the layer entry.
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
          { fontFamily: MONO, fontSize: '11px', color: 'var(--muted-foreground)', width: '28px' },
          on ? 'on' : 'off',
        ),
      );
      group.addEventListener('click', () => {
        handle.setTypeVisible(type, !on);
        render();
      });
      list.appendChild(group);

      if (!on) continue;

      for (const entity of rows) {
        const chosen = selected !== null && selected.id === entity.id;
        const row = el('div', {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 8px 4px 22px',
          cursor: 'pointer',
          background: chosen ? 'var(--accent)' : 'transparent',
        });
        row.append(
          el('span', { ...TRUNCATE, flex: '1' }, entity.label),
          el(
            'span',
            { fontFamily: MONO, fontSize: '11px', color: 'var(--muted-foreground)' },
            entity.lat.toFixed(1),
          ),
        );
        row.addEventListener('click', () => {
          handle.select(entity);
          handle.flyTo(entity);
        });
        list.appendChild(row);
      }
    }

    const tally = header.lastElementChild;
    if (tally !== null) tally.textContent = `${counted} of ${geoEntities.length}`;
  };

  // ---- wiring ----------------------------------------------------------------------------

  search.addEventListener('input', render);

  handle.onHover((entity, x, y) => {
    if (entity === null) hover.hide();
    else hover.show(entity, x, y);
  });

  handle.onSelect((entity) => {
    footer.textContent = entity === null ? 'No selection' : entity.id;
    render();
  });

  render();

  return () => {
    handle.destroy();
    host.replaceChildren();
    host.style.display = '';
  };
}
