import { glyphOf, pathOf } from './glyphs';

const NS = 'http://www.w3.org/2000/svg';

/** The glyph of a type as an SVG element in a box of `size` pixels. Filled is evidence and
 * hollow is a candidate, as on the canvas. `colour` is any CSS colour. */
export function glyphSvg(type: string, colour: string, size = 14, candidate = false): SVGElement {
  const glyph = glyphOf(type);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-7 -7 14 14');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.style.flex = 'none';
  svg.style.overflow = 'visible';
  const shape = document.createElementNS(NS, glyph.circle > 0 ? 'circle' : 'path');
  if (glyph.circle > 0) shape.setAttribute('r', String(glyph.circle));
  else shape.setAttribute('d', pathOf(glyph));
  const hollow = candidate || glyph.dashed;
  shape.setAttribute('fill', hollow ? 'none' : colour);
  if (hollow) {
    shape.setAttribute('stroke', colour);
    shape.setAttribute('stroke-width', '1.5');
    if (glyph.dashed) shape.setAttribute('stroke-dasharray', '2 2');
  }
  svg.append(shape);
  return svg;
}
