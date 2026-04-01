import { describe, it, expect, vi } from 'vitest';
import { withSpinner } from '../../src/ui/spinner.js';

describe('withSpinner', () => {
  it('returns the result of the async function', async () => {
    const result = await withSpinner('testing...', async () => 42);
    expect(result).toBe(42);
  });

  it('propagates errors from the async function', async () => {
    await expect(
      withSpinner('testing...', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('handles non-Error thrown values', async () => {
    await expect(
      withSpinner('testing...', async () => {
        throw 'string error';
      }),
    ).rejects.toBe('string error');
  });

  it('works with async functions that return different types', async () => {
    const str = await withSpinner('test', async () => 'hello');
    expect(str).toBe('hello');

    const obj = await withSpinner('test', async () => ({ a: 1 }));
    expect(obj).toEqual({ a: 1 });

    const arr = await withSpinner('test', async () => [1, 2, 3]);
    expect(arr).toEqual([1, 2, 3]);
  });
});
