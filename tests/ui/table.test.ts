import { describe, it, expect, vi, afterEach } from 'vitest';
import { printTable, printKeyValue } from '../../src/ui/table.js';

describe('printTable', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    spy?.mockRestore();
  });

  it('prints a table with headers and rows', () => {
    spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    printTable(['NAME', 'VALUE'], [['foo', 'bar'], ['baz', 'qux']]);

    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0];
    expect(output).toContain('foo');
    expect(output).toContain('bar');
    expect(output).toContain('baz');
    expect(output).toContain('qux');
  });

  it('handles empty rows', () => {
    spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    printTable(['A', 'B'], []);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('printKeyValue', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    spy?.mockRestore();
  });

  it('prints key-value pairs with padding', () => {
    spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    printKeyValue([
      ['NAME', 'test-agent'],
      ['STATUS', 'RUNNING'],
    ]);

    expect(spy).toHaveBeenCalledTimes(2);
    const output1 = spy.mock.calls[0][0];
    const output2 = spy.mock.calls[1][0];
    expect(output1).toContain('NAME');
    expect(output1).toContain('test-agent');
    expect(output2).toContain('STATUS');
    expect(output2).toContain('RUNNING');
  });
});
