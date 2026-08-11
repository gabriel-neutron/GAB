/**
 * PROTOTYPE — throwaway. Variant A, "Command palette".
 *
 * **The claim.** Locating is a search act, not a browsing act. The analyst knows the name, so
 * the map needs no permanent chrome at all: one field, invoked from the keyboard, that finds a
 * name and moves the camera to it. The type control lives inside that field as a scope, because
 * a filter is only ever wanted while searching.
 *
 * **What it puts at risk.** Nothing on the screen says what the corpus holds. An analyst who
 * does not know a name has nothing to click.
 */

import { colourOfType, countOfType, entityTypes, geoEntities } from './prototype-corpus';
import { dot, el, MONO, PANEL, TRUNCATE } from './prototype-dom';
import { createHoverLabel } from './prototype-hover';
import { mountMap } from './prototype-map';

export const NAME_A = 'Command palette';

const MAX_RESULTS = 7;

export function mountVariantA(host: HTMLElement): () => void {
  // The shell gives the stage `position: absolute; inset: 0`, so it already fills the screen and
  // is already a positioned ancestor for the overlays below. Do **not** set `position` here: a
  // `relative` on this node drops the `inset`, the stage collapses to no height, and the chrome
  // still looks correct over a map that is one pixel tall.

  const mapHost = el('div', { position: 'absolute', inset: '0' });
  host.appendChild(mapHost);

  const handle = mountMap(mapHost, colourOfType);
  const hover = createHoverLabel(host, 'label');

  // ---- the palette -----------------------------------------------------------------------

  const palette = el('div', {
    ...PANEL,
    position: 'absolute',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '460px',
    maxWidth: 'calc(100% - 24px)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
    zIndex: '10',
  });

  const field = el('div', {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderBottom: '1px solid var(--border)',
  });

  const input = el('input', {
    flex: '1',
    background: 'transparent',
    border: '0',
    outline: 'none',
    color: 'inherit',
    fontSize: '13px',
  });
  input.placeholder = 'Find an entity';
  input.setAttribute('aria-label', 'Find an entity');

  // Rule 19: a visible shortcut hint is part of the style, not a help page.
  const hint = el(
    'kbd',
    {
      fontFamily: MONO,
      fontSize: '11px',
      color: 'var(--muted-foreground)',
      border: '1px solid var(--border)',
      padding: '0 4px',
    },
    '/',
  );

  field.append(input, hint);

  // The scope row. This is the layer panel — there is no second control.
  const scopes = el('div', {
    display: 'flex',
    gap: '4px',
    padding: '6px 8px',
    borderBottom: '1px solid var(--border)',
    flexWrap: 'wrap',
  });

  const results = el('div', { maxHeight: '260px', overflowY: 'auto' });

  palette.append(field, scopes, results);
  host.appendChild(palette);

  // ---- the status strip ------------------------------------------------------------------

  const status = el('div', {
    ...PANEL,
    position: 'absolute',
    bottom: '56px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '4px 8px',
    fontFamily: MONO,
    fontSize: '11px',
    display: 'none',
    zIndex: '10',
  });
  host.appendChild(status);

  // ---- rendering -------------------------------------------------------------------------

  let active = 0;
  let shown: typeof geoEntities = [];

  const matches = (): typeof geoEntities => {
    const query = input.value.trim().toLowerCase();
    return geoEntities
      .filter((entity) => handle.isTypeVisible(entity.type))
      .filter((entity) => query === '' || entity.label.toLowerCase().includes(query))
      .slice(0, MAX_RESULTS);
  };

  const commit = (index: number): void => {
    const entity = shown[index];
    if (entity === undefined) return;
    handle.select(entity);
    handle.flyTo(entity);
    input.blur();
  };

  const renderResults = (): void => {
    shown = matches();
    if (active >= shown.length) active = Math.max(0, shown.length - 1);
    results.replaceChildren();

    if (shown.length === 0) {
      results.appendChild(
        el(
          'div',
          { padding: '8px', color: 'var(--muted-foreground)' },
          'No entity carries a geometry under this query.',
        ),
      );
      return;
    }

    shown.forEach((entity, index) => {
      const row = el('div', {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 8px',
        cursor: 'pointer',
        background: index === active ? 'var(--accent)' : 'transparent',
      });
      row.append(
        dot(colourOfType(entity.type)),
        el('span', { ...TRUNCATE, flex: '1' }, entity.label),
        el(
          'span',
          { fontFamily: MONO, fontSize: '11px', color: 'var(--muted-foreground)' },
          entity.type,
        ),
      );
      row.addEventListener('mouseenter', () => {
        active = index;
        renderResults();
      });
      row.addEventListener('click', () => {
        commit(index);
      });
      results.appendChild(row);
    });
  };

  const renderScopes = (): void => {
    scopes.replaceChildren();
    for (const type of entityTypes) {
      const on = handle.isTypeVisible(type);
      const chip = el('button', {
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 6px',
        fontSize: '11px',
        cursor: 'pointer',
        border: '1px solid var(--border)',
        borderRadius: '0',
        background: on ? 'var(--accent)' : 'transparent',
        color: on ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
      });
      chip.append(
        dot(on ? colourOfType(type) : 'var(--muted-foreground)'),
        el('span', {}, type),
        el('span', { fontFamily: MONO }, String(countOfType(type))),
      );
      chip.addEventListener('click', () => {
        handle.setTypeVisible(type, !on);
        renderScopes();
        renderResults();
      });
      scopes.appendChild(chip);
    }
  };

  // ---- wiring ----------------------------------------------------------------------------

  input.addEventListener('input', () => {
    active = 0;
    renderResults();
  });

  input.addEventListener('keydown', (event) => {
    if (shown.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      active = (active + 1) % shown.length;
      renderResults();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      active = (active - 1 + shown.length) % shown.length;
      renderResults();
    } else if (event.key === 'Enter') {
      commit(active);
    } else if (event.key === 'Escape') {
      input.value = '';
      renderResults();
      input.blur();
    }
  });

  const focusKey = (event: KeyboardEvent): void => {
    if (event.key !== '/' || event.target === input) return;
    event.preventDefault();
    input.focus();
    input.select();
  };
  window.addEventListener('keydown', focusKey);

  handle.onHover((entity, x, y) => {
    if (entity === null) hover.hide();
    else hover.show(entity, x, y);
  });

  handle.onSelect((entity) => {
    if (entity === null) {
      status.style.display = 'none';
      return;
    }
    status.style.display = 'block';
    status.textContent = `selected  ${entity.id}  ${entity.lat.toFixed(4)}, ${entity.lon.toFixed(4)}`;
    renderResults();
  });

  renderScopes();
  renderResults();

  return () => {
    window.removeEventListener('keydown', focusKey);
    handle.destroy();
    host.replaceChildren();
  };
}
