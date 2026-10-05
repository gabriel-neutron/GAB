// The object store of the local stack: one service, one private bucket, and two accounts whose
// rights are written in one file. The test reads text and opens no socket.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';

const INFRA = path.resolve(import.meta.dirname, '../infra');
const IDENTITIES = path.join(INFRA, 'seaweedfs/s3.json');

// External constraint: the project client defaults to this address, so the store must answer on
// it, and on the loopback address alone.
const S3_PORT = '127.0.0.1:9000:9000';

const service = z.object({
  image: z.string(),
  ports: z.array(z.string()),
  volumes: z.array(z.string()),
  healthcheck: z.object({ test: z.array(z.string()) }),
  environment: z.record(z.string(), z.string()),
});

const seaweedfs = () => {
  const compose = z
    .object({ services: z.record(z.string(), z.unknown()) })
    .parse(parse(readFileSync(path.join(INFRA, 'docker-compose.yml'), 'utf8')));
  return service.parse(compose.services['seaweedfs']);
};

const statement = z.object({
  Effect: z.string(),
  Action: z.array(z.string()),
  Resource: z.array(z.string()),
});

const identities = z.object({
  identities: z.array(
    z.object({
      name: z.string(),
      credentials: z.array(z.object({ accessKey: z.string(), secretKey: z.string() })),
      actions: z.array(z.string()).optional(),
      policyNames: z.array(z.string()).optional(),
    }),
  ),
  policies: z.array(z.object({ name: z.string(), content: z.string() })),
});

const config = () => identities.parse(JSON.parse(readFileSync(IDENTITIES, 'utf8')));

const identityNamed = (name: string) => {
  const found = config().identities.find((identity) => identity.name === name);
  if (found === undefined) throw new Error(`The identity ${name} is absent.`);
  return found;
};

describe('the object store service', () => {
  test('it is pinned by tag and by digest, and it answers on 127.0.0.1:9000 only', () => {
    const store = seaweedfs();
    expect(store.image).toMatch(/^chrislusf\/seaweedfs:4\.\d+@sha256:[0-9a-f]{64}$/u);
    expect(store.ports).toEqual([S3_PORT]);
  });

  test('it keeps its bytes in a named volume, and it reports its health', () => {
    const store = seaweedfs();
    expect(store.volumes.some((volume) => /^[a-z][a-z0-9-]*:\/data$/u.test(volume))).toBe(true);
    expect(store.healthcheck.test.length).toBeGreaterThan(0);
  });

  test('it refuses to start when one of the four keys is absent', () => {
    const environment = seaweedfs().environment;
    for (const key of [
      'RAW_STORE_ACCESS_KEY',
      'RAW_STORE_SECRET_KEY',
      'RAW_STORE_ADMIN_ACCESS_KEY',
      'RAW_STORE_ADMIN_SECRET_KEY',
    ])
      expect(environment[key]).toMatch(new RegExp(`^\\$\\{${key}:\\?`, 'u'));
  });
});

describe('the accounts of the object store', () => {
  test('the file holds no key, only references to the environment', () => {
    expect(existsSync(IDENTITIES)).toBe(true);
    for (const identity of config().identities)
      for (const credential of identity.credentials) {
        expect(credential.accessKey).toMatch(/^\$\{RAW_STORE_[A-Z_]+\}$/u);
        expect(credential.secretKey).toMatch(/^\$\{RAW_STORE_[A-Z_]+\}$/u);
      }
  });

  test('no account is anonymous: every identity signs with a key', () => {
    for (const identity of config().identities) {
      expect(identity.name).not.toBe('anonymous');
      expect(identity.credentials.length).toBeGreaterThan(0);
    }
  });

  test('the application may put an object in raw and list raw, and nothing else', () => {
    const app = identityNamed('gab-app');
    expect(app.actions ?? []).toEqual([]);
    expect(app.policyNames).toEqual(['gab-app-put-list']);

    const policy = config().policies.find((each) => each.name === 'gab-app-put-list');
    const content = z
      .object({ Statement: z.array(statement) })
      .parse(JSON.parse(policy?.content ?? '{}'));
    expect(content.Statement).toEqual([
      { Effect: 'Allow', Action: ['s3:PutObject'], Resource: ['arn:aws:s3:::raw/*'] },
      { Effect: 'Allow', Action: ['s3:ListBucket'], Resource: ['arn:aws:s3:::raw'] },
    ]);
  });

  test('the account of the tests may read, write and list raw, and administer nothing', () => {
    expect(identityNamed('gab-admin').actions).toEqual(['Read:raw', 'Write:raw', 'List:raw']);
  });
});
