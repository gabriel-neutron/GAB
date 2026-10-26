import type { Glyph } from './glyphs';

const num = (value: number): string =>
  Number.isInteger(value) ? `${String(value)}.0` : String(value);

/** The GLSL of `float glyph(vec2 p)`: the signed distance to the glyph, negative inside. */
export function distanceSource(glyph: Glyph): string {
  if (glyph.polygons.length === 0)
    return `float glyph(vec2 p) { return length(p) - ${num(glyph.circle)}; }`;
  const bodies = glyph.polygons.map((points, shape) => {
    const first = points[0];
    if (first === undefined) return '';
    const lines = [
      `  vec2 a${String(shape)} = vec2(${num(first[0])}, ${num(first[1])});`,
      `  float d${String(shape)} = dot(p - a${String(shape)}, p - a${String(shape)});`,
      `  float s${String(shape)} = 1.0;`,
    ];
    points.forEach((current, index) => {
      const previous = points[(index + points.length - 1) % points.length];
      if (previous === undefined) return;
      const v = `vec2(${num(current[0])}, ${num(current[1])})`;
      const u = `vec2(${num(previous[0])}, ${num(previous[1])})`;
      lines.push(
        `  { vec2 e = ${u} - ${v}; vec2 w = p - ${v};`,
        `    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);`,
        `    d${String(shape)} = min(d${String(shape)}, dot(b, b));`,
        `    bvec3 c = bvec3(p.y >= ${num(current[1])}, p.y < ${num(previous[1])}, e.x * w.y > e.y * w.x);`,
        `    if (all(c) || all(not(c))) s${String(shape)} *= -1.0; }`,
      );
    });
    lines.push(`  float r${String(shape)} = s${String(shape)} * sqrt(d${String(shape)});`);
    return lines.join('\n');
  });
  const union = glyph.polygons.reduce<string>(
    (so, _points, shape) => (shape === 0 ? `r0` : `min(${so}, r${String(shape)})`),
    '',
  );
  return `float glyph(vec2 p) {\n${bodies.join('\n')}\n  return ${union};\n}`;
}
