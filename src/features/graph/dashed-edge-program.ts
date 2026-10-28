import {
  createEdgeArrowHeadProgram,
  createEdgeCompoundProgram,
  EdgeProgram,
  type EdgeProgramType,
  type ProgramInfo,
} from 'sigma/rendering';
import type { EdgeDisplayData, NodeDisplayData, RenderParams } from 'sigma/types';
import { floatColor } from 'sigma/utils';

import { ARROW_LENGTH_RATIO, ARROW_WIDTH_RATIO } from '@/shared/canvas-arrow';

import type { EdgeAttrs, NodeAttrs } from './model';
import { morph } from './morph';
import type { DashPattern } from './relation-families';

// External constraint: Sigma ships no edge program that repeats a mark. This body is the straight
// body of the library, with one varying added: the distance from the source, in screen pixels.
// The pattern is read in the fragment shader, so a dash keeps its length at every zoom. The
// body runs to the middle of the target, and the head and the node are drawn over its end.
const VERTEX_SHADER = /* glsl */ `
attribute vec4 a_id;
attribute vec4 a_color;
attribute float a_thickness;
attribute float a_normalCoef;
attribute vec2 a_positionStart;
attribute vec2 a_positionEnd;
attribute vec2 a_fromStart;
attribute vec2 a_fromEnd;
attribute float a_positionCoef;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_zoomRatio;
uniform float u_pixelRatio;
uniform float u_correctionRatio;
uniform float u_minEdgeThickness;
uniform float u_feather;
uniform vec2 u_resolution;
uniform float u_morph;

varying vec4 v_color;
varying vec2 v_normal;
varying float v_thickness;
varying float v_feather;
varying float v_along;

const float bias = 255.0 / 254.0;

void main() {
  // The ends move from their old place to their new one on the card, so the normal is read from
  // the ends of this frame and the body keeps its width while it turns.
  vec2 start = mix(a_fromStart, a_positionStart, u_morph);
  vec2 end = mix(a_fromEnd, a_positionEnd, u_morph);
  vec2 along = end - start;
  float alongLength = length(along);
  vec2 direction = alongLength == 0.0 ? vec2(1.0, 0.0) : along / alongLength;
  vec2 unitNormal = vec2(-direction.y, direction.x) * a_normalCoef;
  vec2 position = start * (1.0 - a_positionCoef) + end * a_positionCoef;

  float normalLength = a_thickness;

  float pixelsThickness = max(normalLength, u_minEdgeThickness * u_sizeRatio);
  float webGLThickness = pixelsThickness * u_correctionRatio / u_sizeRatio;

  gl_Position = vec4((u_matrix * vec3(position + unitNormal * webGLThickness, 1)).xy, 0, 1);

  vec2 clipStart = (u_matrix * vec3(start, 1)).xy;
  vec2 clipEnd = (u_matrix * vec3(end, 1)).xy;
  v_along = a_positionCoef * length((clipEnd - clipStart) * 0.5 * u_resolution);

  v_thickness = webGLThickness / u_zoomRatio;
  v_normal = unitNormal;
  v_feather = u_feather * u_correctionRatio / u_zoomRatio / u_pixelRatio * 2.0;

  #ifdef PICKING_MODE
  v_color = a_id;
  #else
  v_color = a_color;
  #endif

  v_color.a *= bias;
}
`;

// The picking pass draws the body whole, so a gap of the pattern is still a place to click.
const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec4 v_color;
varying vec2 v_normal;
varying float v_thickness;
varying float v_feather;
varying float v_along;

uniform vec4 u_pattern;

const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);

void main(void) {
  #ifdef PICKING_MODE
  gl_FragColor = v_color;
  #else
  float period = u_pattern.x + u_pattern.y + u_pattern.z + u_pattern.w;
  float at = mod(v_along, period);
  bool marked = at < u_pattern.x || (at >= u_pattern.x + u_pattern.y && at < u_pattern.x + u_pattern.y + u_pattern.z);
  if (!marked) {
    gl_FragColor = transparent;
    return;
  }

  float dist = length(v_normal) * v_thickness;
  float t = smoothstep(v_thickness - v_feather, v_thickness, dist);
  gl_FragColor = mix(v_color, transparent, t);
  #endif
}
`;

const UNIFORMS = [
  'u_matrix',
  'u_zoomRatio',
  'u_sizeRatio',
  'u_correctionRatio',
  'u_pixelRatio',
  'u_feather',
  'u_minEdgeThickness',
  'u_resolution',
  'u_pattern',
  'u_morph',
] as const;

type DashUniform = (typeof UNIFORMS)[number];

/** A node as the edge program reads it: the place now, and the place that the move starts from. */
type MovingNode = NodeDisplayData & { fromX?: number; fromY?: number };

type GraphEdgeProgram = EdgeProgramType<NodeAttrs, EdgeAttrs>;

function createDashedBody(pattern: DashPattern): GraphEdgeProgram {
  return class DashedBody extends EdgeProgram<DashUniform, NodeAttrs, EdgeAttrs> {
    getDefinition() {
      const { FLOAT, UNSIGNED_BYTE, TRIANGLES } = WebGLRenderingContext;
      return {
        VERTICES: 6,
        VERTEX_SHADER_SOURCE: VERTEX_SHADER,
        FRAGMENT_SHADER_SOURCE: FRAGMENT_SHADER,
        METHOD: TRIANGLES,
        UNIFORMS,
        ATTRIBUTES: [
          { name: 'a_positionStart', size: 2, type: FLOAT },
          { name: 'a_positionEnd', size: 2, type: FLOAT },
          { name: 'a_fromStart', size: 2, type: FLOAT },
          { name: 'a_fromEnd', size: 2, type: FLOAT },
          { name: 'a_thickness', size: 1, type: FLOAT },
          { name: 'a_color', size: 4, type: UNSIGNED_BYTE, normalized: true },
          { name: 'a_id', size: 4, type: UNSIGNED_BYTE, normalized: true },
        ],
        CONSTANT_ATTRIBUTES: [
          { name: 'a_positionCoef', size: 1, type: FLOAT },
          { name: 'a_normalCoef', size: 1, type: FLOAT },
        ],
        CONSTANT_DATA: [
          [0, 1],
          [0, -1],
          [1, 1],
          [1, 1],
          [0, -1],
          [1, -1],
        ],
      };
    }

    processVisibleItem(
      edgeIndex: number,
      startIndex: number,
      sourceData: MovingNode,
      targetData: MovingNode,
      data: EdgeDisplayData,
    ): void {
      const thickness = data.size || 1;
      const array = this.array;
      let at = startIndex;
      array[at++] = sourceData.x;
      array[at++] = sourceData.y;
      array[at++] = targetData.x;
      array[at++] = targetData.y;
      array[at++] = sourceData.fromX ?? sourceData.x;
      array[at++] = sourceData.fromY ?? sourceData.y;
      array[at++] = targetData.fromX ?? targetData.x;
      array[at++] = targetData.fromY ?? targetData.y;
      array[at++] = thickness;
      array[at++] = floatColor(data.color);
      array[at] = edgeIndex;
    }

    setUniforms(params: RenderParams, { gl, uniformLocations }: ProgramInfo<DashUniform>): void {
      gl.uniformMatrix3fv(uniformLocations.u_matrix, false, params.matrix);
      gl.uniform1f(uniformLocations.u_zoomRatio, params.zoomRatio);
      gl.uniform1f(uniformLocations.u_sizeRatio, params.sizeRatio);
      gl.uniform1f(uniformLocations.u_correctionRatio, params.correctionRatio);
      gl.uniform1f(uniformLocations.u_pixelRatio, params.pixelRatio);
      gl.uniform1f(uniformLocations.u_feather, params.antiAliasingFeather);
      gl.uniform1f(uniformLocations.u_minEdgeThickness, params.minEdgeThickness);
      gl.uniform2f(uniformLocations.u_resolution, params.width, params.height);
      gl.uniform4f(uniformLocations.u_pattern, ...pattern);
      gl.uniform1f(uniformLocations.u_morph, morph.progress);
    }
  };
}

/** An edge program that draws a body with the dash pattern, and the arrow head of the other
 * edges of the canvas at its target. */
export function createDashedArrowProgram(pattern: DashPattern): GraphEdgeProgram {
  return createEdgeCompoundProgram<NodeAttrs, EdgeAttrs>([
    createDashedBody(pattern),
    createEdgeArrowHeadProgram<NodeAttrs, EdgeAttrs>({
      lengthToThicknessRatio: ARROW_LENGTH_RATIO,
      widenessToThicknessRatio: ARROW_WIDTH_RATIO,
    }),
  ]);
}
