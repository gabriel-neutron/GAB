/**
 * PROTOTYPE — throwaway. The pieces every left bar is built from.
 *
 * A row and a strip are shared; **a layout is not**. The three bars disagree about where the
 * index stands and what remains of it when it closes, and that disagreement is the whole point
 * of the exercise. Each one therefore writes its own container, its own open state and its own
 * close control, and takes only the parts below.
 */

import { colourOfType, countOfType, entityTypes, geoEntities, type GeoEntity } from './prototype-corpus';
import { dot, el, MONO, TRUNCATE } from './prototype-dom';
import type { MapHandle } from './prototype-map';

/** Use case 4: one click picks the entity, moves the camera, and fills the sidebar. */
export function entityRow(
  entity: GeoEntity,
  selected: boolean,
  onPick: () => void,
  indent: string,
): HTMLElement {
  const row = el('div', {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: `4px 8px 4px ${indent}`,
    cursor: 'pointer',
    background: selected ? 'var(--accent)' : 'transparent',
  });
  row.append(
    el('span', { ...TRUNCATE, flex: '1' }, entity.label),
    el(
      'span',
      { fontFamily: MONO, fontSize: '11px', color: 'var(--muted-foreground)' },
      entity.lat.toFixed(1),
    ),
  );
  row.addEventListener('click', onPick);
  return row;
}

export function matchesQuery(entity: GeoEntity, query: string): boolean {
  return query === '' || entity.label.toLowerCase().includes(query.trim().toLowerCase());
}

export function rowsOfType(type: string, query: string): GeoEntity[] {
  return geoEntities.filter((entity) => entity.type === type && matchesQuery(entity, query));
}

/**
 * Use case 2. What a closed bar still has to say: which types are drawn, and how many of each.
 * A closed bar that shows nothing turns every colour on the map into a guess.
 *
 * The strip is a control, not a caption — a click on a colour still switches the type, so the
 * bar never has to be reopened to change what is drawn.
 */
export function typeStrip(handle: MapHandle, onChange: () => void): HTMLElement {
  const strip = el('div', {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '8px 0',
  });

  for (const type of entityTypes) {
    const on = handle.isTypeVisible(type);
    const cell = el('button', {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px',
      width: '100%',
      padding: '4px 0',
      border: '0',
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      opacity: on ? '1' : '0.4',
    });
    cell.title = `${type} — ${countOfType(type)} on the map`;
    cell.append(
      dot(on ? colourOfType(type) : 'var(--muted-foreground)'),
      el(
        'span',
        { fontFamily: MONO, fontSize: '10px', color: 'var(--muted-foreground)' },
        String(countOfType(type)),
      ),
    );
    cell.addEventListener('click', () => {
      handle.setTypeVisible(type, !on);
      onChange();
    });
    strip.appendChild(cell);
  }

  return strip;
}

/** The one control the theme asks to be visible rather than discovered. Rule 19. */
export function collapseButton(open: boolean, onToggle: () => void): HTMLButtonElement {
  const button = el(
    'button',
    {
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--muted-foreground)',
      cursor: 'pointer',
      fontFamily: MONO,
      fontSize: '11px',
      lineHeight: '16px',
      padding: '0 5px',
    },
    open ? '«' : '»',
  );
  button.title = open ? 'Close the index' : 'Open the index';
  button.setAttribute('aria-label', open ? 'Close the index' : 'Open the index');
  button.addEventListener('click', onToggle);
  return button;
}
