import { describe, expect, it } from 'vitest';

import { carriedSelection } from './carried-selection';

describe('the selection that a link between the map and the graph carries', () => {
  it('carries the selected entity from the graph to the map', () => {
    expect(carriedSelection('/graph', '?entity=e1', '/map')).toEqual({
      entity: 'e1',
      relation: '',
    });
  });

  it('sends the relation alone from the map to the graph, which reads the entity first', () => {
    expect(carriedSelection('/map', '?entity=e1&relation=r1', '/graph')).toEqual({
      entity: '',
      relation: 'r1',
    });
  });

  it('keeps both keys on a link from the graph to the graph', () => {
    expect(carriedSelection('/graph', '?entity=e1&relation=r1', '/graph')).toEqual({
      entity: 'e1',
      relation: 'r1',
    });
  });

  it('drops the relation on a link to the globe, which selects an entity only', () => {
    expect(carriedSelection('/graph', '?entity=e1&relation=r1', '/map')).toEqual({
      entity: 'e1',
      relation: '',
    });
  });

  it('carries nothing from a page that is not a surface', () => {
    expect(carriedSelection('/review', '?entity=e1', '/map')).toEqual({ entity: '', relation: '' });
  });
});
