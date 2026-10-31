// A fault of the browser reaches the agent as a fixed sentence, and a render can be asked
// for. The browser is replaced, so no test opens one.

import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { CHROME_FAULT, readThroughFilter } from './challenge-page.ts';
import { CATALOGUE } from './catalogue.ts';
import { endMetadata, RENDER_FAULT } from './fetch-document.ts';
import {
  FIXTURE_HOST,
  fixtureLookup,
  fixtureReach,
  memoryStore,
  startFixture,
  type Fixture,
} from './fetch-fixture.ts';
import { renderPage } from './render-page.ts';
import { callTool, type Tool } from './tool.ts';
import { fetchDatabase } from './web-stub.ts';

vi.mock('./render-page.ts', () => ({ renderPage: vi.fn() }));
vi.mock('patchright', () => ({
  chromium: {
    launchPersistentContext: vi.fn(() =>
      Promise.reject(
        new Error(
          'Failed to launch: spawn /home/someone/.cache/ms-playwright/chrome ENOENT\n  at line 2',
        ),
      ),
    ),
  },
}));

const fetchDocument = ((): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === 'fetch_document');
  if (found === undefined) throw new Error('the catalogue holds no tool named fetch_document');
  return found;
})();

const PATH_FAULT = new Error('browser failed at /home/someone/.cache/ms-playwright/x\n  at y');
const SHELL = '<html><head><title>App</title></head><body><div id="root"></div></body></html>';
const LONG =
  '<html><head><title>Report</title></head><body><p>' +
  `${'The company published its annual report. '.repeat(10)}</p></body></html>`;
const BUILT =
  '<html><head><title>App</title></head><body><p>' +
  `${'The script built this text in the browser. '.repeat(10)}</p></body></html>`;

let fixture: Fixture;
const render = vi.mocked(renderPage);

beforeAll(async () => {
  fixture = await startFixture({
    '/shell': { headers: { 'content-type': 'text/html' }, body: SHELL + ' '.repeat(10) },
    '/long': { headers: { 'content-type': 'text/html' }, body: LONG },
    '/short': { headers: { 'content-type': 'text/html' }, body: '<html><body>Hi</body></html>' },
  });
});

afterAll(async () => {
  await fixture.close();
  await endMetadata();
});

beforeEach(() => {
  render.mockReset();
});

const fetched = async (path: string, extra: Record<string, unknown> = {}) => {
  const session = fetchDatabase();
  const outcome = await callTool(
    fetchDocument,
    session,
    { url: `http://${FIXTURE_HOST}:${fixture.port}${path}`, ...extra },
    fixtureReach(memoryStore()),
  );
  if (!outcome.ok) throw new Error(outcome.refusal);
  return {
    session,
    output: outcome.output as {
      notice: string | null;
      document: string;
      rendered: { document: string } | null;
    },
  };
};

describe('a fault of the browser sends no raw text to the agent', () => {
  test('a failed render gives a fixed sentence, and the path stays out of the answer', async () => {
    render.mockRejectedValue(PATH_FAULT);
    const { output } = await fetched('/short');
    expect(output.notice).toContain(RENDER_FAULT);
    expect(JSON.stringify(output)).not.toContain('/home/');
    expect(JSON.stringify(output)).not.toContain('someone');
  });

  test('the fault goes to the log', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render.mockRejectedValue(PATH_FAULT);
    await fetched('/short');
    expect(logged).toHaveBeenCalledWith(PATH_FAULT);
    logged.mockRestore();
  });

  test('a failed Chrome window gives a fixed sentence, and the path stays in the log', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const answer = await readThroughFilter(`http://${FIXTURE_HOST}:${fixture.port}/short`, {
      lookup: fixtureLookup,
      refuses: (address) => address !== '127.0.0.1',
    });
    expect(answer).toBe(CHROME_FAULT);
    expect(answer).not.toMatch(/\/home\//u);
    expect(logged).toHaveBeenCalledTimes(1);
    logged.mockRestore();
  });
});

describe('the render mode', () => {
  test('a page with enough text is not rendered unless the call asks for it', async () => {
    const { output } = await fetched('/long');
    expect(render).not.toHaveBeenCalled();
    expect(output.rendered).toBeNull();
  });

  test('a page with text is rendered when the call asks, and the document says so', async () => {
    render.mockResolvedValue({ html: BUILT, refused: 0, timedOut: false });
    const { output, session } = await fetched('/long', { render: true });
    expect(render).toHaveBeenCalledTimes(1);
    expect(output.rendered).not.toBeNull();
    expect(output.notice).toContain('render was asked for');
    expect(session.traces).toStrictEqual([[output.rendered?.document, null, true]]);
  });

  test('a page that is empty without JavaScript is stored with its text in render mode', async () => {
    render.mockResolvedValue({ html: BUILT, refused: 0, timedOut: false });
    const { output, session } = await fetched('/shell', { render: true });
    expect(output.rendered).not.toBeNull();
    expect(session.traces).toStrictEqual([[output.rendered?.document, null, true]]);
  });
});
