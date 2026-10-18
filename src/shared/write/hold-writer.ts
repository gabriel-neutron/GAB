import { spyOn } from 'storybook/test';

import { recheckWriter } from './writer-status';

/** For a story: make the status of the write service online or offline, and read it again. The
 * stub answers the status address only, and the caller restores it with `restoreAllMocks`. */
export async function holdWriter(online: boolean): Promise<void> {
  const real = globalThis.fetch.bind(globalThis);
  spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const address = input instanceof Request ? input.url : String(input);
    if (!address.endsWith('/writer-status')) return real(input, init);
    return online
      ? Promise.resolve(Response.json({ online: true }))
      : Promise.reject(new TypeError('The write service is off.'));
  });
  await recheckWriter();
}
