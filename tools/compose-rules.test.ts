// The local compose file binds every port to the loopback address and pins every image. It holds
// the two services of the back-end AI and the object store. The test reads text and opens no
// socket.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { composeServiceNames, composeViolations } from './compose-rules.ts';

const composeText = readFileSync(
  path.resolve(import.meta.dirname, '../infra/docker-compose.yml'),
  'utf8',
);

describe('the local compose file', () => {
  test('it holds the model gateway, the search service and the object store', () => {
    expect(composeServiceNames(composeText)).toEqual(
      expect.arrayContaining(['freellmapi', 'searxng', 'seaweedfs']),
    );
  });

  test('every port is on 127.0.0.1 and every image has a pinned tag', () => {
    expect(composeViolations(composeText)).toEqual([]);
  });
});

describe('the checker', () => {
  const file = (service: string) => `services:\n  svc:\n${service}`;

  test('it refuses a port that is not on the loopback address', () => {
    const text = file("    image: a/b:1\n    ports:\n      - '8888:8080'\n");
    expect(composeViolations(text)).toEqual(['svc: the port 8888:8080 is not bound to 127.0.0.1']);
    const wide = file("    image: a/b:1\n    ports:\n      - '0.0.0.0:8888:8080'\n");
    expect(composeViolations(wide)).toHaveLength(1);
  });

  test('it refuses an image with no tag, with latest, or with a variable tag', () => {
    expect(composeViolations(file('    image: a/b\n'))).toHaveLength(1);
    expect(composeViolations(file('    image: a/b:latest\n'))).toHaveLength(1);
    expect(composeViolations(file('    image: a/b:${TAG}\n'))).toHaveLength(1);
    expect(composeViolations(file('    build: ./x\n'))).toHaveLength(1);
  });

  test('it accepts a pinned tag, a digest and a registry with a port', () => {
    expect(composeViolations(file('    image: a/b:1.2\n'))).toEqual([]);
    expect(composeViolations(file('    image: a/b@sha256:abc\n'))).toEqual([]);
    expect(composeViolations(file('    image: host:5000/b:1\n'))).toEqual([]);
    expect(composeViolations(file('    image: host:5000/b\n'))).toHaveLength(1);
  });
});
