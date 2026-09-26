import { describe, expect, it, vi } from 'vitest';

import { readOnce } from './once';

describe('one read held for every later caller', () => {
  it('keeps the later read when an earlier read fails after forget', async () => {
    const first = Promise.withResolvers<string>();
    const second = Promise.withResolvers<string>();
    const read = vi.fn<() => Promise<string>>(() => Promise.withResolvers<string>().promise);
    read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const memory = readOnce(read);

    const firstLoad = memory.load();
    memory.forget();
    const secondLoad = memory.load();
    first.reject(new Error('the first read failed'));
    await expect(firstLoad).rejects.toThrow('the first read failed');

    expect(memory.load(), 'the memory still holds the second read').toBe(secondLoad);
    expect(read).toHaveBeenCalledTimes(2);
    second.resolve('the record');
    await expect(secondLoad).resolves.toBe('the record');
  });

  it('forgets its own failure, so the next load reads again', async () => {
    const read = vi.fn<() => Promise<string>>();
    read.mockRejectedValueOnce(new Error('the read failed')).mockResolvedValueOnce('the record');
    const memory = readOnce(read);

    await expect(memory.load()).rejects.toThrow('the read failed');
    await expect(memory.load()).resolves.toBe('the record');
    expect(read).toHaveBeenCalledTimes(2);
  });
});
