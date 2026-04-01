import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { output, isJsonMode, printSuccess, printError, printHint } from '../../src/ui/output.js';

describe('output', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('outputs JSON when json flag is true', () => {
    output({ foo: 'bar' }, { json: true });
    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({ foo: 'bar' }, null, 2));
  });

  it('does nothing when json flag is false', () => {
    output({ foo: 'bar' }, { json: false });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('does nothing when json flag is undefined', () => {
    output({ foo: 'bar' }, {});
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});

describe('isJsonMode', () => {
  it('returns true when json is true', () => {
    expect(isJsonMode({ json: true })).toBe(true);
  });

  it('returns false when json is false', () => {
    expect(isJsonMode({ json: false })).toBe(false);
  });

  it('returns false when json is undefined', () => {
    expect(isJsonMode({})).toBe(false);
  });
});

describe('printSuccess', () => {
  it('prints to stdout with checkmark', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printSuccess('done!');
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0];
    expect(output).toContain('done!');
    expect(output).toContain('\u2714'); // checkmark
    spy.mockRestore();
  });
});

describe('printError', () => {
  it('prints to stderr with X mark', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    printError('oops!');
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0];
    expect(output).toContain('oops!');
    expect(output).toContain('\u2716'); // X mark
    spy.mockRestore();
  });
});

describe('printHint', () => {
  it('prints hint with Next: prefix', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printHint('try this');
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0];
    expect(output).toContain('try this');
    expect(output).toContain('Next:');
    spy.mockRestore();
  });
});
