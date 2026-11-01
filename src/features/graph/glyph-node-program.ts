import { NodeProgram, type NodeProgramType, type ProgramInfo } from 'sigma/rendering';
import type { NodeDisplayData, RenderParams } from 'sigma/types';
import { floatColor } from 'sigma/utils';

import { distanceSource } from './glyph-glsl';
import { glyphOf, type Glyph } from './glyphs';
import type { EdgeAttrs, NodeAttrs } from './model';
import { morph } from './morph';

// External constraint: Sigma ships a disc and a few image programs, and none draws a polygon.
// This program is the vertex shader of the Sigma disc with one varying added, `v_hollow`. The
// fragment shader holds the signed distance of one glyph, generated from `glyphs.ts`, so a shape
// stays sharp at every zoom and the legend and the canvas never differ.
const VERTEX_SHADER = /* glsl */ `
attribute vec4 a_id;
attribute vec4 a_color;
attribute vec2 a_position;
attribute vec2 a_from;
attribute float a_size;
attribute float a_hollow;
attribute float a_angle;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_correctionRatio;
uniform float u_morph;

varying vec4 v_color;
varying vec2 v_diffVector;
varying float v_radius;
varying float v_hollow;

const float bias = 255.0 / 254.0;

void main() {
  float size = a_size * u_correctionRatio / u_sizeRatio * 4.0;
  vec2 diffVector = size * vec2(cos(a_angle), sin(a_angle));
  gl_Position = vec4((u_matrix * vec3(mix(a_from, a_position, u_morph) + diffVector, 1)).xy, 0, 1);

  v_diffVector = diffVector;
  v_radius = size / 2.0;
  v_hollow = a_hollow;

  #ifdef PICKING_MODE
  v_color = a_id;
  #else
  v_color = a_color;
  #endif

  v_color.a *= bias;
}
`;

const fragmentSource = (glyph: Glyph): string => /* glsl */ `
precision highp float;

varying vec4 v_color;
varying vec2 v_diffVector;
varying float v_radius;
varying float v_hollow;

uniform float u_correctionRatio;
uniform vec3 u_ground;

${distanceSource(glyph)}

const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);

void main(void) {
  // The box of a glyph is 14 units, and the radius of the node is half of it.
  // The screen is y up and the glyph table is y down, as in an SVG.
  vec2 p = vec2(v_diffVector.x, -v_diffVector.y) / v_radius * 7.0;
  float d = glyph(p);

  #ifdef PICKING_MODE
  gl_FragColor = d > 0.0 ? transparent : v_color;
  #else
  // One pixel of the screen, in units of the box.
  float pixel = 2.0 * u_correctionRatio / v_radius * 7.0;
  float aa = pixel * 0.7;
  float stroke = 1.5 * pixel;
  float outer = 1.0 - smoothstep(-aa, aa, d);
  ${
    glyph.dashed
      ? `// A dashed outline: eight marks round the circle, and nothing inside.
  float turn = atan(p.y, p.x) * 8.0 / 6.2831853;
  float mark = step(fract(turn), 0.5);
  float ring = outer - (1.0 - smoothstep(-aa, aa, d + stroke));
  float alpha = v_color.a * ring * mark;
  gl_FragColor = vec4(v_color.rgb * alpha, alpha);`
      : `// Filled is evidence. Hollow is a candidate: an edge of 1.5px over the ground, so a line that
  // ends at the centre does not show inside.
  float inner = 1.0 - smoothstep(-aa, aa, d + stroke);
  float edge = outer - inner;
  vec3 rgb = mix(v_color.rgb, u_ground, v_hollow * (1.0 - edge / max(outer, 0.0001)));
  float alpha = v_color.a * outer;
  gl_FragColor = vec4(rgb * alpha, alpha);`
  }
  #endif
}
`;

/** The ground the hollow glyphs are filled with. The controller sets it on each theme change. */
export const paint = { ground: [0, 0, 0] as readonly [number, number, number] };

export const setGround = (hex: string): void => {
  const value = Number.parseInt(hex.slice(1), 16);
  if (hex.length !== 7 || Number.isNaN(value)) return;
  paint.ground = [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
};

const UNIFORMS = ['u_sizeRatio', 'u_correctionRatio', 'u_matrix', 'u_ground', 'u_morph'] as const;
type GlyphUniform = (typeof UNIFORMS)[number];

type GraphNodeProgram = NodeProgramType<NodeAttrs, EdgeAttrs>;

const ANGLES = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3] as const;

/** A node program for one entity type. */
export function createGlyphProgram(type: string): GraphNodeProgram {
  const glyph = glyphOf(type);
  const source = fragmentSource(glyph);
  return class GlyphProgram extends NodeProgram<GlyphUniform, NodeAttrs, EdgeAttrs> {
    getDefinition() {
      const { FLOAT, UNSIGNED_BYTE, TRIANGLES } = WebGLRenderingContext;
      return {
        VERTICES: 3,
        VERTEX_SHADER_SOURCE: VERTEX_SHADER,
        FRAGMENT_SHADER_SOURCE: source,
        METHOD: TRIANGLES,
        UNIFORMS,
        ATTRIBUTES: [
          { name: 'a_position', size: 2, type: FLOAT },
          { name: 'a_from', size: 2, type: FLOAT },
          { name: 'a_size', size: 1, type: FLOAT },
          { name: 'a_hollow', size: 1, type: FLOAT },
          { name: 'a_color', size: 4, type: UNSIGNED_BYTE, normalized: true },
          { name: 'a_id', size: 4, type: UNSIGNED_BYTE, normalized: true },
        ],
        CONSTANT_ATTRIBUTES: [{ name: 'a_angle', size: 1, type: FLOAT }],
        CONSTANT_DATA: ANGLES.map((angle) => [angle]),
      };
    }

    processVisibleItem(
      nodeIndex: number,
      startIndex: number,
      data: NodeDisplayData & { candidate?: boolean; fromX?: number; fromY?: number },
    ) {
      const array = this.array;
      let at = startIndex;
      array[at++] = data.x;
      array[at++] = data.y;
      array[at++] = data.fromX ?? data.x;
      array[at++] = data.fromY ?? data.y;
      array[at++] = data.size;
      array[at++] = data.candidate ? 1 : 0;
      array[at++] = floatColor(data.color);
      array[at] = nodeIndex;
    }

    setUniforms(params: RenderParams, { gl, uniformLocations }: ProgramInfo<GlyphUniform>): void {
      gl.uniform1f(uniformLocations.u_correctionRatio, params.correctionRatio);
      gl.uniform1f(uniformLocations.u_sizeRatio, params.sizeRatio);
      gl.uniformMatrix3fv(uniformLocations.u_matrix, false, params.matrix);
      gl.uniform3f(uniformLocations.u_ground, ...paint.ground);
      gl.uniform1f(uniformLocations.u_morph, morph.progress);
    }
  };
}
