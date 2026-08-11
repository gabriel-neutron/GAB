/**
 * PROTOTYPE — variant B · Findings rail.
 *
 * The bet is the opposite of variant A: at ten thousand nodes the picture cannot name anything,
 * so the **ranked list leads** and the graph confirms it. The rail holds the three macro reads —
 * cut points, communities, isolates — and the badged elements. The graph is the second column.
 *
 * A row in the rail moves the camera on purpose. A click on the canvas never does. That is the
 * distinction the operator asked for in UC2.
 */

import { memo, useEffect, useRef } from 'react';
import { buildFilters, collectFindings, type FindingRow } from './prototype-chrome';
import { button, el, renderDetail } from './prototype-dom';
import { costLine, mountGraph } from './prototype-mount';

const GROUP_TITLE =
  'sticky top-0 bg-background py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';
const ROW =
  'flex w-full items-baseline justify-between gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent';

export const VariantB = memo(function VariantB({ entityCount }: { entityCount: number }) {
  const canvas = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const filters = useRef<HTMLDivElement>(null);
  const cost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvasNode = canvas.current;
    const overlayNode = overlay.current;
    const statusNode = status.current;
    const railNode = rail.current;
    const filtersNode = filters.current;
    const costNode = cost.current;
    if (
      canvasNode === null ||
      overlayNode === null ||
      statusNode === null ||
      railNode === null ||
      filtersNode === null ||
      costNode === null
    ) {
      return;
    }

    return mountGraph(
      entityCount,
      { canvas: canvasNode, overlay: overlayNode, status: statusNode },
      (controller) => {
        const model = controller.model;
        const repaintFilters = buildFilters(controller, filtersNode);
        const findings = collectFindings(controller);

        const counts = el('div', 'text-[11px] tabular-nums text-muted-foreground');
        costNode.replaceChildren(el('div', 'text-[11px] leading-snug', costLine(model)), counts);

        const list = el('div', 'flex min-h-0 flex-1 flex-col overflow-y-auto');
        const detailHost = el('div', 'flex min-h-0 flex-1 flex-col');
        detailHost.style.display = 'none';

        const addGroup = (title: string, rows: readonly FindingRow[], total: number): void => {
          list.append(el('h3', GROUP_TITLE, `${title} — ${total.toLocaleString('en-GB')}`));
          if (rows.length === 0) {
            list.append(el('p', 'px-2 py-1 text-sm text-muted-foreground', 'None.'));
            return;
          }
          for (const row of rows) {
            const node = button('', ROW, () => {
              controller.select({ kind: 'entity', id: row.nodeId });
              // A control asked for the move, so the camera may travel.
              controller.flyTo(row.nodeId);
            });
            node.textContent = '';
            node.append(el('span', 'truncate font-medium', row.primary));
            node.append(el('span', 'shrink-0 text-[11px] text-muted-foreground', row.secondary));
            list.append(node);
          }
          if (total > rows.length) {
            list.append(
              el(
                'p',
                'px-2 py-1 text-[11px] text-muted-foreground',
                `+ ${(total - rows.length).toLocaleString('en-GB')} more, not listed.`,
              ),
            );
          }
        };

        // The count is read, never written down. `shared/fixtures/corpus` grows while the four
        // prototypes are built, and a number in a caption goes stale in silence.
        addGroup('From the fixture — the real rows', findings.fixture, findings.fixture.length);
        addGroup('Bridges, by what they sever', findings.cuts, model.structure.bridges.size);
        list.append(
          el(
            'p',
            'px-2 pb-1 text-[11px] text-muted-foreground',
            `${model.structure.cutPoints.size.toLocaleString('en-GB')} cut points in all. Most detach one leaf, ` +
              `so only those above the floor are painted or listed.`,
          ),
        );
        addGroup('Communities', findings.communities, model.structure.communityCount);
        addGroup('Isolates', findings.isolates, model.structure.isolates.length);
        addGroup('Carrying a pending proposal', findings.pending, model.badgedNodes.length);

        list.append(
          el(
            'p',
            'mt-3 border-l-2 border-amber-500 bg-amber-500/10 px-2 py-1 text-[11px] leading-snug',
            `${model.pendingWithoutTarget.length} pending proposals name no existing element. ` +
              `The chosen rule badges a real element, so none of them can appear here. #10.`,
          ),
        );

        const back = button(
          '← back to the findings',
          'mb-2 shrink-0 self-start rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent',
          () => {
            controller.select(null);
          },
        );
        const detailBody = el('div', 'flex min-h-0 flex-1 flex-col');
        detailHost.append(back, detailBody);
        railNode.replaceChildren(list, detailHost);

        return controller.subscribe((view) => {
          repaintFilters(view);
          counts.textContent =
            `${view.lit.toLocaleString('en-GB')} lit · ${view.dimmed.toLocaleString('en-GB')} dimmed · ` +
            `${view.badgesDrawn} badges drawn${view.badgesOverCap > 0 ? `, ${view.badgesOverCap} over the cap` : ''}`;

          const showing = view.detail !== null;
          list.style.display = showing ? 'none' : 'flex';
          detailHost.style.display = showing ? 'flex' : 'none';
          if (view.detail !== null) {
            renderDetail(
              detailBody,
              view.detail,
              (selection) => {
                controller.select(selection);
              },
              'stacked',
            );
          }
        });
      },
    );
  }, [entityCount]);

  return (
    <div className="grid size-full grid-cols-[360px_1fr] gap-3 overflow-hidden">
      <aside className="flex min-h-0 flex-col rounded-lg border border-border bg-background p-3">
        <div ref={cost} className="shrink-0 border-b border-border pb-2" />
        <div ref={rail} className="mt-2 flex min-h-0 flex-1 flex-col" />
        <div
          ref={filters}
          className="mt-2 flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border pt-2"
        />
      </aside>
      <div className="relative min-h-0 overflow-hidden rounded-lg border border-border bg-background">
        <div ref={canvas} className="absolute inset-0" />
        <div ref={overlay} className="pointer-events-none absolute inset-0 z-10" />
        <div
          ref={status}
          className="absolute inset-0 z-30 items-center justify-center bg-background/85 text-sm font-medium"
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
});
