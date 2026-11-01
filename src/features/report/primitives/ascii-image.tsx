import { useEffect, useRef, useState } from 'react';
import { useInView } from 'motion/react';
import { asciiRows } from './ascii-art';

// One column for each 7 CSS pixels; Geist Mono draws a glyph 0.6em wide.
const COLUMN_PX = 7;
const GLYPH_WIDTH = 0.6;

interface Art {
  readonly text: string;
  readonly fontSize: number;
}

/** A monochrome ASCII drawing of an image that covers its box. It loads the image only near the
 * view, and draws once, in the ink of the theme. It is decoration, so assistive technology skips
 * it. */
export function AsciiImage({ src }: { readonly src: string }) {
  const box = useRef<HTMLDivElement>(null);
  const near = useInView(box, { once: true, margin: '400px 0px' });
  const [art, setArt] = useState<Art | null>(null);

  // An adapter: the browser loads and reads the image past React, and a ResizeObserver draws it
  // again when the box changes size (a resize or a rotation).
  useEffect(() => {
    const node = box.current;
    if (!near || node === null) return undefined;
    let live = true;
    let loaded = false;
    let frame = 0;
    const image = new Image();
    image.decoding = 'async';
    const draw = () => {
      frame = 0;
      const { width, height } = node.getBoundingClientRect();
      if (!live || !loaded || width === 0 || height === 0) return;
      const cols = Math.max(40, Math.round(width / COLUMN_PX));
      const fontSize = width / cols / GLYPH_WIDTH;
      const rows = Math.ceil(height / fontSize);
      const canvas = document.createElement('canvas');
      canvas.width = cols;
      canvas.height = rows;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context === null) return;
      // Cover: crop the image to the shape of the box.
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const cropW = width / scale;
      const cropH = height / scale;
      context.drawImage(
        image,
        (image.naturalWidth - cropW) / 2,
        (image.naturalHeight - cropH) / 2,
        cropW,
        cropH,
        0,
        0,
        cols,
        rows,
      );
      const pixels = context.getImageData(0, 0, cols, rows).data;
      const luminance = new Float32Array(cols * rows);
      for (let index = 0; index < luminance.length; index++)
        luminance[index] =
          (0.2126 * (pixels[index * 4] ?? 0) +
            0.7152 * (pixels[index * 4 + 1] ?? 0) +
            0.0722 * (pixels[index * 4 + 2] ?? 0)) /
          255;
      setArt({ text: asciiRows(luminance, cols).join('\n'), fontSize });
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(schedule);
    image.onload = () => {
      loaded = true;
      draw();
      observer.observe(node);
    };
    // A failed load leaves an empty box.
    image.src = src;
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [near, src]);

  return (
    <div ref={box} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {art === null ? null : (
        <pre
          style={{ fontSize: art.fontSize }}
          className="absolute inset-0 m-0 overflow-hidden font-mono leading-none whitespace-pre text-foreground/40 select-none"
        >
          {art.text}
        </pre>
      )}
    </div>
  );
}
