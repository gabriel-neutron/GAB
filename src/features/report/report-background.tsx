import type { BackgroundHandle, BackgroundPreset } from 'asciify-engine/kit';
import { useReportScroll } from './report-context';
import { useEffect, useRef, useState } from 'react';

export function CurrentField() {
  const host = useRef<HTMLDivElement>(null),
    handle = useRef<BackgroundHandle | null>(null);
  const container = useReportScroll();
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduce(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let disposed = false;
    const el = host.current;
    const scroller = container.current;
    if (el === null || scroller === null) return;
    let scrollPosition = scroller.scrollTop,
      pointer = { x: 0.5, y: 0.5 },
      frameId: number | null = null;
    const refresh = () => {
      if (reduce || frameId) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        scrollPosition = scroller.scrollTop;
        handle.current?.update({ speed: 0 });
      });
    };
    const move = (e: PointerEvent) => {
      pointer = { x: e.clientX / innerWidth, y: e.clientY / innerHeight };
      refresh();
    };
    scroller.addEventListener('scroll', refresh, { passive: true });
    addEventListener('pointermove', move, { passive: true });
    import('asciify-engine/kit')
      .then(({ background, mountCanvas }) => {
        if (disposed) return;
        // A custom 2D preset uses Asciify's clock, pointer, theme and visibility lifecycle.
        // It also works on machines without WebGL.
        const current: BackgroundPreset = {
          id: 'gab-current',
          name: 'Current',
          description: 'A monochrome field of moving currents',
          cellSize: 14,
          speed: 0,
          cursor: true,
          mount: (context) =>
            mountCanvas(context, (ctx, w, h, t, mouse, frame) => {
              t = reduce ? 0 : scrollPosition / 500;
              mouse = reduce ? { x: 0.5, y: 0.5 } : pointer;
              ctx.clearRect(0, 0, w, h);
              ctx.font = `${frame.fontSize}px "Geist Mono", monospace`;
              ctx.fillStyle = frame.ink;
              ctx.textBaseline = 'top';
              const ramp = ' .:+*#';
              const step = frame.fontSize;
              const cols = Math.ceil(w / step),
                lines = Math.ceil(h / step);
              for (let y = 0; y < lines; y++)
                for (let x = 0; x < cols; x++) {
                  const px = x / cols,
                    py = y / lines;
                  const distance = Math.hypot(px - mouse.x, py - mouse.y);
                  const bend = Math.max(0, 1 - distance * 3) * 0.9;
                  const wave =
                    (Math.sin(px * 13 + Math.sin(py * 5 + t * 0.32) * 2 - t * 0.45 + bend) +
                      Math.cos(py * 11 + px * 4 + t * 0.25)) *
                      0.25 +
                    0.5;
                  const density = Math.max(0, Math.min(0.999, (wave - 0.25) * 1.4));
                  ctx.globalAlpha = 0.3 + density * 0.7;
                  ctx.fillText(ramp[Math.floor(density * ramp.length)] ?? ' ', x * step, y * step);
                }
              ctx.globalAlpha = 1;
            }),
        };
        handle.current = background(el, {
          preset: current,
          clear: false,
          ink: '--ascii-ink',
          cellSize: 14,
          speed: 0,
          opacity: 0.16,
          cursor: !reduce,
          lazy: false,
          // Draw only on explicit updates; the page supplies the scroll/pointer clock.
          reducedMotion: true,
        });
        el.dataset['field'] = handle.current.supported ? 'ready' : 'fallback';
      })
      .catch(() => {
        el.dataset['field'] = 'fallback';
      });
    return () => {
      disposed = true;
      scroller.removeEventListener('scroll', refresh);
      removeEventListener('pointermove', move);
      if (frameId !== null) cancelAnimationFrame(frameId);
      handle.current?.destroy();
      handle.current = null;
    };
  }, [reduce, container]);
  return (
    <aside className="current-art">
      <div className="current-field" ref={host} aria-hidden="true">
        <pre className="current-poster">
          {Array.from({ length: 16 }, (_, y) =>
            Array.from(
              { length: 64 },
              (_, x) => ' .:+*#'[Math.floor((Math.sin(x * 0.13 + y * 0.24) + 1) * 2.49)],
            ).join(''),
          ).join('\n')}
        </pre>
      </div>
    </aside>
  );
}
