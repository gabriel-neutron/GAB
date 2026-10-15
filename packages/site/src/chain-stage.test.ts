import { expect, test } from 'vitest';

import { stageOf } from './chain-stage.ts';

test.each([
  ['facility', 'field', 'field'],
  ['facility', 'pipeline_segment', 'transport'],
  ['facility', 'refinery', 'processing'],
  ['facility', 'lng_plant', 'processing'],
  ['facility', 'export_terminal', 'export'],
  ['port', undefined, 'export'],
  ['facility', undefined, null],
  ['vessel', undefined, null],
])('a %s of kind %s has the stage %s', (type, kind, stage) => {
  expect(stageOf(type, kind)).toBe(stage);
});
