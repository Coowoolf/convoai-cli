import { describe, it, expect } from 'vitest';
import {
  generateAgentName,
  maskSecret,
  formatTimestamp,
  relativeTime,
  formatDuration,
  colorLatency,
  formatRole,
  averageOf,
} from '../../src/utils/format.js';

describe('generateAgentName', () => {
  it('generates a name with agent- prefix', () => {
    const name = generateAgentName();
    expect(name).toMatch(/^agent-\d+-[a-z0-9]{4}$/);
  });

  it('generates unique names', () => {
    const names = new Set(Array.from({ length: 10 }, () => generateAgentName()));
    expect(names.size).toBeGreaterThan(1);
  });
});

describe('maskSecret', () => {
  it('masks long secrets showing first 4 chars', () => {
    expect(maskSecret('abcdefghij')).toBe('abcd****');
  });

  it('fully masks short secrets', () => {
    expect(maskSecret('abc')).toBe('****');
    expect(maskSecret('abcd')).toBe('****');
  });

  it('returns "(not set)" for undefined', () => {
    expect(maskSecret(undefined)).toBe('(not set)');
  });

  it('returns "(not set)" for empty string', () => {
    expect(maskSecret('')).toBe('(not set)');
  });
});

describe('formatTimestamp', () => {
  it('returns "—" for undefined', () => {
    expect(formatTimestamp(undefined)).toBe('—');
  });

  it('returns "—" for 0', () => {
    expect(formatTimestamp(0)).toBe('—');
  });

  it('formats a valid timestamp', () => {
    const result = formatTimestamp(1705501800);
    expect(result).toContain('2024');
  });
});

describe('relativeTime', () => {
  it('returns "—" for undefined', () => {
    expect(relativeTime(undefined)).toBe('—');
  });

  it('returns seconds ago', () => {
    const ts = Math.floor(Date.now() / 1000) - 30;
    expect(relativeTime(ts)).toMatch(/^\d+s ago$/);
  });

  it('returns minutes ago', () => {
    const ts = Math.floor(Date.now() / 1000) - 300;
    expect(relativeTime(ts)).toMatch(/^\d+m ago$/);
  });

  it('returns hours ago', () => {
    const ts = Math.floor(Date.now() / 1000) - 7200;
    expect(relativeTime(ts)).toMatch(/^\d+h ago$/);
  });

  it('returns days ago', () => {
    const ts = Math.floor(Date.now() / 1000) - 259200;
    expect(relativeTime(ts)).toMatch(/^\d+d ago$/);
  });
});

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(30)).toBe('30s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2m 5s');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3720)).toBe('1h 2m');
  });
});

describe('colorLatency', () => {
  it('returns "—" for undefined', () => {
    expect(colorLatency(undefined)).toBe('—');
  });

  it('returns colored string for valid ms', () => {
    const result = colorLatency(500);
    expect(result).toContain('500ms');
  });

  it('contains ms suffix for all values', () => {
    expect(colorLatency(100)).toContain('100ms');
    expect(colorLatency(1500)).toContain('1500ms');
    expect(colorLatency(3000)).toContain('3000ms');
  });
});

describe('formatRole', () => {
  it('formats user role', () => {
    const result = formatRole('user');
    expect(result).toContain('user');
  });

  it('formats assistant role', () => {
    const result = formatRole('assistant');
    expect(result).toContain('assistant');
  });

  it('handles unknown roles', () => {
    const result = formatRole('system');
    expect(result).toContain('system');
  });
});

describe('averageOf', () => {
  it('returns 0 for empty array', () => {
    expect(averageOf([])).toBe(0);
  });

  it('returns 0 for all undefined', () => {
    expect(averageOf([undefined, undefined])).toBe(0);
  });

  it('calculates average ignoring undefined', () => {
    expect(averageOf([100, undefined, 200])).toBe(150);
  });

  it('rounds to integer', () => {
    expect(averageOf([100, 200, 300])).toBe(200);
    expect(averageOf([100, 101])).toBe(101); // 100.5 rounds to 101
  });
});
