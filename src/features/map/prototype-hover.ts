/**
 * PROTOTYPE — throwaway. Use case 3: read a point before committing to it.
 *
 * Two modes, because the variants disagree about how much a hover should say. A variant that
 * carries a list can afford a bare label; a variant with no chrome has to say more, because the
 * hover is the only place a name appears.
 */

import { colourOfType, type GeoEntity } from './prototype-corpus';
import { dot, el, MONO, PANEL } from './prototype-dom';

export interface HoverLabel {
  readonly show: (entity: GeoEntity, x: number, y: number) => void;
  readonly hide: () => void;
}

export function createHoverLabel(host: HTMLElement, mode: 'label' | 'card'): HoverLabel {
  const node = el('div', {
    ...PANEL,
    position: 'absolute',
    display: 'none',
    pointerEvents: 'none',
    padding: '6px 8px',
    maxWidth: '260px',
    // Rule 6: a shadow is only for a true overlay, and this floats over a live canvas.
    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
    zIndex: '20',
  });
  host.appendChild(node);

  return {
    show: (entity, x, y) => {
      node.replaceChildren();

      const head = el('div', { display: 'flex', alignItems: 'center', gap: '6px' });
      head.append(dot(colourOfType(entity.type)), el('span', { fontWeight: '500' }, entity.label));
      node.appendChild(head);

      if (mode === 'card') {
        node.appendChild(
          el(
            'div',
            { fontFamily: MONO, color: 'var(--muted-foreground)', fontSize: '11px' },
            `${entity.type} · ${entity.lat.toFixed(4)}, ${entity.lon.toFixed(4)} · ` +
              `${entity.sourceIds.length} source${entity.sourceIds.length === 1 ? '' : 's'}`,
          ),
        );
      }

      // 14px clear of the cursor, so the label never sits under the point it names.
      node.style.left = `${x + 14}px`;
      node.style.top = `${y + 14}px`;
      node.style.display = 'block';
    },

    hide: () => {
      node.style.display = 'none';
    },
  };
}
