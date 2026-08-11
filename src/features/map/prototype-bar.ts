/**
 * PROTOTYPE — throwaway. The two-step rail, chosen by the operator on 11 August 2026.
 *
 * The rail shows the four type rows and nothing else, and it opens one type at a time in place.
 * It separates the two acts the other bars conflated: switching a type is a control, and
 * finding an entity is a search. The layer control is the same control as the type filter —
 * the finding reported to **#36** — and nothing here adds a second one.
 *
 * **The rail is no longer under review.** The variation is the row, and it arrives as a
 * `RowStyle`: the row decides its own shape, and the rail takes its width from it.
 */

import {
  colourOfType,
  countOfType,
  entityTypes,
  geoLinks,
  linksOf,
  undrawableCount,
  type GeoEntity,
  type GeoLink,
} from './prototype-corpus';
import { dot, el, MONO, PANEL, TRUNCATE } from './prototype-dom';
import { createHoverLabel } from './prototype-hover';
import { collapseButton, rowsOfType, typeStrip } from './prototype-index';
import { mountMap } from './prototype-map';
import { ROW_STYLES, type RowKey } from './prototype-rows';
import { patchMapWorkspace, readMapWorkspace } from './prototype-workspace';

export function mountBar(host: HTMLElement, rowKey: RowKey): () => void {
  const style = ROW_STYLES[rowKey];
  host.style.display = 'flex';

  let open = readMapWorkspace().barOpen;
  // Which type is unfolded. One at a time, so the rail never becomes the full list by accident.
  // It is seeded below, from the selection the map restored out of the address: the map reads
  // `?entity=` inside its own constructor, which is before this bar can subscribe to it, so a
  // bar that only listened would open no group on a reload.
  let expanded: string | null = null;
  const queries = new Map<string, string>();

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

  // ---- the basemap switch ------------------------------------------------------------------
  //
  // It stands over the map and not in the rail, because it is about the ground under the points
  // and not about the corpus. Two labels, one pressed: a two-state control that says both of
  // its states is read without being clicked. `#33` calls the choice workspace, so it persists
  // beside the camera.

  const basemapSwitch = el('div', {
    ...PANEL,
    position: 'absolute',
    top: '12px',
    right: '12px',
    display: 'flex',
    padding: '2px',
    fontFamily: MONO,
    fontSize: '11px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
    zIndex: '10',
  });
  mapHost.appendChild(basemapSwitch);

  const renderBasemap = (): void => {
    basemapSwitch.replaceChildren();
    for (const [key, label] of [
      ['satellite', 'satellite'],
      ['osm', 'map'],
    ] as const) {
      const on = handle.basemap() === key;
      const button = el(
        'button',
        {
          border: '0',
          padding: '2px 8px',
          cursor: 'pointer',
          font: 'inherit',
          background: on ? 'var(--accent)' : 'transparent',
          color: on ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
        },
        label,
      );
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      button.title =
        key === 'satellite'
          ? 'EOX Sentinel-2 cloudless 2025 — ADR 0005 §3'
          : 'OpenStreetMap raster — a stand-in for the archive of ADR 0005 §2, never for a build';
      button.addEventListener('click', () => {
        handle.setBasemap(key);
        renderBasemap();

        // ---- the relation card -------------------------------------------------------------------
        //
        // **`features/detail/` has no relation surface.** It exports a page and a sidebar, and both
        // take an entity identifier. A relation is an evidentiary row like any other — it carries
        // attributes, sources and an interval — and nothing shows it. Until one exists, the map draws
        // its own small card, and that gap is worth reporting rather than papering over.

        const card = el('div', {
          ...PANEL,
          position: 'absolute',
          left: '12px',
          top: '12px',
          width: '300px',
          padding: '8px',
          display: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          zIndex: '11',
        });
        mapHost.appendChild(card);

        const endpointButton = (entity: GeoEntity, arrow: string): HTMLElement => {
          const line = el('div', {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 0',
          });
          const jump = el(
            'button',
            {
              ...TRUNCATE,
              flex: '1',
              border: '0',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              font: 'inherit',
              padding: '0',
              textAlign: 'left',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
            },
            entity.label,
          );
          jump.addEventListener('click', () => {
            handle.select(entity);
            handle.flyTo(entity);
          });
          line.append(
            el(
              'span',
              { fontFamily: MONO, fontSize: '11px', color: 'var(--muted-foreground)' },
              arrow,
            ),
            dot(colourOfType(entity.type)),
            jump,
          );
          return line;
        };

        const renderCard = (link: GeoLink | null): void => {
          if (link === null) {
            card.style.display = 'none';
            return;
          }

          card.replaceChildren();

          const head = el('div', {
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '4px',
            marginBottom: '4px',
          });
          const close = el(
            'button',
            {
              border: '0',
              background: 'transparent',
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              fontFamily: MONO,
              fontSize: '11px',
              padding: '0 2px',
            },
            '×',
          );
          close.title = 'Close';
          close.setAttribute('aria-label', 'Close the relation');
          close.addEventListener('click', () => {
            handle.selectLink(null);
          });
          head.append(el('span', { fontWeight: '500', flex: '1' }, link.type), close);

          card.append(head, endpointButton(link.from, 'from'), endpointButton(link.to, 'to'));

          // M6 reserves an interval for identity and ownership. A closed one must never read as
          // current, so the card writes both ends and never only the first.
          if (link.validFrom !== null || link.validTo !== null) {
            card.appendChild(
              el(
                'div',
                {
                  fontFamily: MONO,
                  fontSize: '11px',
                  color: 'var(--muted-foreground)',
                  paddingTop: '4px',
                },
                `${link.validFrom ?? 'unknown'} to ${link.validTo ?? 'now'}`,
              ),
            );
          }

          for (const [key, attribute] of Object.entries(link.attrs)) {
            const line = el('div', { display: 'flex', gap: '6px', fontSize: '11px' });
            line.append(
              el(
                'span',
                { ...TRUNCATE, flex: '1', color: 'var(--muted-foreground)' },
                key.replace(/_/g, ' '),
              ),
              el(
                'span',
                { ...TRUNCATE, fontFamily: MONO, flex: '1', textAlign: 'right' },
                typeof attribute.v === 'object' ? attribute.v.join(', ') : String(attribute.v),
              ),
            );
            card.appendChild(line);
          }

          card.appendChild(
            el(
              'div',
              {
                fontFamily: MONO,
                fontSize: '10px',
                color: 'var(--muted-foreground)',
                paddingTop: '6px',
                ...TRUNCATE,
              },
              `sources ${link.sourceIds.join(', ')}`,
            ),
          );
          card.style.display = 'block';
        };

        handle.onLinkSelect(renderCard);
      });
      basemapSwitch.appendChild(button);
    }
  };

  renderBasemap();

  // ---- the relation card -------------------------------------------------------------------
  //
  // **`features/detail/` has no relation surface.** It exports a page and a sidebar, and both
  // take an entity identifier. A relation is an evidentiary row like any other — it carries
  // attributes, sources and an interval — and nothing shows it. Until one exists, the map draws
  // its own small card, and that gap is worth reporting rather than papering over.

  const card = el('div', {
    ...PANEL,
    position: 'absolute',
    left: '12px',
    top: '12px',
    width: '300px',
    padding: '8px',
    display: 'none',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    zIndex: '11',
  });
  mapHost.appendChild(card);

  const endpointButton = (entity: GeoEntity, arrow: string): HTMLElement => {
    const line = el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '2px 0',
    });
    const jump = el(
      'button',
      {
        ...TRUNCATE,
        flex: '1',
        border: '0',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        font: 'inherit',
        padding: '0',
        textAlign: 'left',
        textDecoration: 'underline',
        textUnderlineOffset: '2px',
      },
      entity.label,
    );
    jump.addEventListener('click', () => {
      handle.select(entity);
      handle.flyTo(entity);
    });
    line.append(
      el('span', { fontFamily: MONO, fontSize: '11px', color: 'var(--muted-foreground)' }, arrow),
      dot(colourOfType(entity.type)),
      jump,
    );
    return line;
  };

  const renderCard = (link: GeoLink | null): void => {
    if (link === null) {
      card.style.display = 'none';
      return;
    }

    card.replaceChildren();

    const head = el('div', {
      display: 'flex',
      alignItems: 'baseline',
      gap: '8px',
      borderBottom: '1px solid var(--border)',
      paddingBottom: '4px',
      marginBottom: '4px',
    });
    const close = el(
      'button',
      {
        border: '0',
        background: 'transparent',
        color: 'var(--muted-foreground)',
        cursor: 'pointer',
        fontFamily: MONO,
        fontSize: '11px',
        padding: '0 2px',
      },
      '×',
    );
    close.title = 'Close';
    close.setAttribute('aria-label', 'Close the relation');
    close.addEventListener('click', () => {
      handle.selectLink(null);
    });
    head.append(el('span', { fontWeight: '500', flex: '1' }, link.type), close);

    card.append(head, endpointButton(link.from, 'from'), endpointButton(link.to, 'to'));

    // M6 reserves an interval for identity and ownership. A closed one must never read as
    // current, so the card writes both ends and never only the first.
    if (link.validFrom !== null || link.validTo !== null) {
      card.appendChild(
        el(
          'div',
          {
            fontFamily: MONO,
            fontSize: '11px',
            color: 'var(--muted-foreground)',
            paddingTop: '4px',
          },
          `${link.validFrom ?? 'unknown'} to ${link.validTo ?? 'now'}`,
        ),
      );
    }

    for (const [key, attribute] of Object.entries(link.attrs)) {
      const line = el('div', { display: 'flex', gap: '6px', fontSize: '11px' });
      line.append(
        el(
          'span',
          { ...TRUNCATE, flex: '1', color: 'var(--muted-foreground)' },
          key.replace(/_/g, ' '),
        ),
        el(
          'span',
          { ...TRUNCATE, fontFamily: MONO, flex: '1', textAlign: 'right' },
          typeof attribute.v === 'object' ? attribute.v.join(', ') : String(attribute.v),
        ),
      );
      card.appendChild(line);
    }

    card.appendChild(
      el(
        'div',
        {
          fontFamily: MONO,
          fontSize: '10px',
          color: 'var(--muted-foreground)',
          paddingTop: '6px',
          ...TRUNCATE,
        },
        `sources ${link.sourceIds.join(', ')}`,
      ),
    );
    card.style.display = 'block';
  };

  handle.onLinkSelect(renderCard);

  expanded = handle.selected()?.type ?? null;

  const toggle = (): void => {
    open = !open;
    patchMapWorkspace({ barOpen: open });
    render();
  };

  const render = (): void => {
    rail.replaceChildren();
    const width = open ? `${style.railWidth}px` : '44px';
    rail.style.width = width;
    rail.style.flex = `0 0 ${width}`;

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
      // rest of the row switches the type. Whether that is discoverable is a thing to judge.
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
        minWidth: '0',
        border: '0',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        font: 'inherit',
        padding: '0',
        textAlign: 'left',
      });

      // The note names the field the rows below hold. Without it a blank column is unreadable:
      // the reader cannot tell a missing key from a column that draws nothing.
      const note = style.groupNote(type);

      label.append(
        dot(on ? colourOfType(type) : 'var(--muted-foreground)'),
        el('span', { textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '11px' }, type),
        el(
          'span',
          { ...TRUNCATE, flex: '1', fontFamily: MONO, fontSize: '10px', opacity: '0.55' },
          note === null ? '' : `· ${note}`,
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
          style.render(entity, selected !== null && selected.id === entity.id, () => {
            handle.select(entity);
            handle.flyTo(entity);
          }),
        );
      }
    }

    // ---- links -----------------------------------------------------------------------------
    //
    // A relation is not an entity type, so it does not belong in the list of types above: ADR
    // 0005 §6 makes that list a projection of the entity types and nothing else. It gets one
    // switch of its own, and a block that fills only when an entity is selected.

    const linksOn = handle.linksVisible();
    const linkHead = el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 8px',
      borderTop: '1px solid var(--border)',
      cursor: 'pointer',
      background: 'var(--muted)',
      opacity: linksOn ? '1' : '0.5',
    });
    linkHead.append(
      el(
        'span',
        { flex: '1', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '11px' },
        'links',
      ),
      el('span', { fontFamily: MONO, fontSize: '11px' }, String(geoLinks.length)),
      el(
        'span',
        { fontFamily: MONO, fontSize: '11px', color: 'var(--muted-foreground)', width: '24px' },
        linksOn ? 'on' : 'off',
      ),
    );
    linkHead.addEventListener('click', () => {
      handle.setLinksVisible(!linksOn);
      render();
    });

    const linkBlock = el('div', { borderTop: '0' });
    linkBlock.appendChild(linkHead);

    if (linksOn) {
      // M4: a relation may point at another relation, and such a relation has no second point.
      // The count is on screen because a map that drops evidence in silence is worse than one
      // that says how much it dropped.
      if (undrawableCount > 0) {
        linkBlock.appendChild(
          el(
            'div',
            {
              padding: '4px 8px',
              fontSize: '10px',
              color: 'var(--muted-foreground)',
              lineHeight: '14px',
            },
            `${undrawableCount} more point at another relation or at an entity with no ` +
              `geometry. They cannot be drawn here.`,
          ),
        );
      }

      const mine = selected === null ? [] : linksOf(selected.id);
      if (selected !== null) {
        linkBlock.appendChild(
          el(
            'div',
            { padding: '4px 8px 2px', fontSize: '10px', color: 'var(--muted-foreground)' },
            mine.length === 0
              ? 'The selected entity touches none that can be drawn.'
              : `${mine.length} on the selected entity`,
          ),
        );
      }

      const chosen = handle.selectedLink();
      for (const link of mine) {
        const other = link.from.id === selected?.id ? link.to : link.from;
        const row = el('div', {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px 4px 22px',
          cursor: 'pointer',
          background: chosen !== null && chosen.id === link.id ? 'var(--accent)' : 'transparent',
        });
        row.append(
          el(
            'span',
            { fontFamily: MONO, fontSize: '10px', color: 'var(--muted-foreground)' },
            link.from.id === selected?.id ? '→' : '←',
          ),
          el('span', { ...TRUNCATE, flex: '1', fontSize: '11px' }, link.type),
          dot(colourOfType(other.type)),
          el('span', { ...TRUNCATE, flex: '1', fontSize: '11px' }, other.label),
        );
        row.addEventListener('click', () => {
          handle.selectLink(link);
        });
        linkBlock.appendChild(row);
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

    rail.append(header, list, linkBlock, footer);
  };

  // A selection made on the map opens the group it belongs to, so the rail always agrees with
  // the map about what is being examined.
  handle.onSelect((entity) => {
    if (entity !== null) expanded = entity.type;
    render();
  });

  handle.onLinkSelect(() => {
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
