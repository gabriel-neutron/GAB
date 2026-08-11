/**
 * PROTOTYPE — throwaway. Variant C, "Bare map, legend, keyboard".
 *
 * **The claim.** The map is the interface. No list and no search field: the analyst cycles the
 * corpus from the keyboard, and the camera does the finding. The only permanent chrome is a
 * legend, which is the layer panel reduced to what it has left — a colour, a count and a
 * switch. Rule 19 of the theme says keyboard first, and this variant takes that literally.
 *
 * **What it puts at risk.** Cycling is a walk, not a search. It is fast at 27 entities and
 * useless at 10k, and the hover is the only place a name is ever written.
 */

import {
  colourOfType,
  countOfType,
  entityTypes,
  geoEntities,
  type GeoEntity,
} from './prototype-corpus';
import { dot, el, MONO, PANEL, TRUNCATE } from './prototype-dom';
import { createHoverLabel } from './prototype-hover';
import { mountMap } from './prototype-map';

export const NAME_C = 'Bare map, legend, keyboard';

export function mountVariantC(host: HTMLElement): () => void {
  // The shell gives the stage `position: absolute; inset: 0`, so it already fills the screen and
  // is already a positioned ancestor for the overlays below. Do **not** set `position` here: a
  // `relative` on this node drops the `inset`, the stage collapses to no height, and the chrome
  // still looks correct over a map that is one pixel tall.

  const mapHost = el('div', { position: 'absolute', inset: '0' });
  host.appendChild(mapHost);

  const handle = mountMap(mapHost, colourOfType);
  // No list anywhere, so the hover has to carry the type, the coordinate and the source count.
  const hover = createHoverLabel(host, 'card');

  // ---- the readout, top right ------------------------------------------------------------

  const readout = el('div', {
    ...PANEL,
    position: 'absolute',
    top: '12px',
    right: '12px',
    padding: '4px 8px',
    fontFamily: MONO,
    fontSize: '11px',
    textAlign: 'right',
    zIndex: '10',
  });
  readout.textContent = '—.————, —.————   z—.—';
  host.appendChild(readout);

  // ---- the selection strip, top left -----------------------------------------------------

  const strip = el('div', {
    ...PANEL,
    position: 'absolute',
    top: '12px',
    left: '12px',
    padding: '6px 8px',
    maxWidth: '340px',
    display: 'none',
    zIndex: '10',
    ...TRUNCATE,
  });
  host.appendChild(strip);

  // ---- the legend, bottom left -----------------------------------------------------------

  const legend = el('div', {
    ...PANEL,
    position: 'absolute',
    // Clear of the attribution row, which now sits in this corner.
    bottom: '44px',
    left: '12px',
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
    zIndex: '10',
  });
  host.appendChild(legend);

  const renderLegend = (): void => {
    legend.replaceChildren();
    for (const type of entityTypes) {
      const on = handle.isTypeVisible(type);
      const row = el('button', {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 6px',
        border: '0',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '11px',
        opacity: on ? '1' : '0.45',
        textAlign: 'left',
      });
      row.append(
        dot(on ? colourOfType(type) : 'var(--muted-foreground)'),
        el('span', { flex: '1' }, type),
        el(
          'span',
          { fontFamily: MONO, color: 'var(--muted-foreground)' },
          String(countOfType(type)),
        ),
      );
      row.addEventListener('click', () => {
        handle.setTypeVisible(type, !on);
        renderLegend();
      });
      legend.appendChild(row);
    }
  };

  // ---- the shortcut hint, bottom right ---------------------------------------------------

  const keys = el(
    'div',
    {
      ...PANEL,
      position: 'absolute',
      bottom: '56px',
      right: '12px',
      padding: '4px 8px',
      fontFamily: MONO,
      fontSize: '11px',
      color: 'var(--muted-foreground)',
      zIndex: '10',
    },
    'n next · p previous · f fit all · esc clear',
  );
  host.appendChild(keys);

  // ---- cycling ---------------------------------------------------------------------------

  const walkable = (): GeoEntity[] =>
    geoEntities.filter((entity) => handle.isTypeVisible(entity.type));

  const step = (delta: number): void => {
    const list = walkable();
    if (list.length === 0) return;
    const current = handle.selected();
    const at = current === null ? -1 : list.findIndex((entity) => entity.id === current.id);
    const next = list[(at + delta + list.length) % list.length];
    if (next === undefined) return;
    handle.select(next);
    handle.flyTo(next);
  };

  const onKey = (event: KeyboardEvent): void => {
    const target = event.target;
    // Never steal a key from a field. Nothing in this variant has one, but the switcher bar of
    // the prototype shares the window.
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

    if (event.key === 'n') step(1);
    else if (event.key === 'p') step(-1);
    else if (event.key === 'f') handle.fitAll();
    else if (event.key === 'Escape') handle.select(null);
  };
  window.addEventListener('keydown', onKey);

  // ---- wiring ----------------------------------------------------------------------------

  handle.onHover((entity, x, y) => {
    if (entity === null) hover.hide();
    else hover.show(entity, x, y);
  });

  handle.onCursor((lon, lat, zoom) => {
    readout.textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}   z${zoom.toFixed(1)}`;
  });

  handle.onSelect((entity) => {
    if (entity === null) {
      strip.style.display = 'none';
      return;
    }
    strip.replaceChildren();
    const head = el('div', { display: 'flex', alignItems: 'center', gap: '6px' });
    head.append(dot(colourOfType(entity.type)), el('span', { fontWeight: '500' }, entity.label));
    strip.append(
      head,
      el(
        'div',
        { fontFamily: MONO, fontSize: '11px', color: 'var(--muted-foreground)' },
        entity.id,
      ),
    );
    strip.style.display = 'block';
  });

  renderLegend();

  return () => {
    window.removeEventListener('keydown', onKey);
    handle.destroy();
    host.replaceChildren();
  };
}
