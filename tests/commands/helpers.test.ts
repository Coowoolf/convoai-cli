import { describe, it, expect } from 'vitest';
import { formatTimestamp, relativeTime } from '../../src/commands/agent/_helpers.js';

describe('formatTimestamp', () => {
  it('returns "—" for undefined', () => {
    expect(formatTimestamp(undefined)).toBe('—');
  });

  it('returns "—" for 0', () => {
    expect(formatTimestamp(0)).toBe('—');
  });

  it('formats a Unix timestamp to readable date', () => {
    // 2024-01-17 14:30:00 UTC
    const ts = 1705501800;
    const result = formatTimestamp(ts);
    expect(result).toContain('2024');
    expect(result).toContain('Jan');
  });
});

describe('relativeTime', () => {
  it('returns "—" for undefined', () => {
    expect(relativeTime(undefined)).toBe('—');
  });

  it('returns "—" for 0', () => {
    expect(relativeTime(0)).toBe('—');
  });

  it('returns "just now" for future timestamps', () => {
    const future = Math.floor(Date.now() / 1000) + 100;
    expect(relativeTime(future)).toBe('just now');
  });

  it('returns seconds for very recent timestamps', () => {
    const recent = Math.floor(Date.now() / 1000) - 30;
    const result = relativeTime(recent);
    expect(result).toMatch(/^\d+s ago$/);
  });

  it('returns minutes for timestamps within the hour', () => {
    const fiveMinAgo = Math.floor(Date.now() / 1000) - 300;
    const result = relativeTime(fiveMinAgo);
    expect(result).toMatch(/^\d+m ago$/);
  });

  it('returns hours for timestamps within the day', () => {
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
    const result = relativeTime(twoHoursAgo);
    expect(result).toMatch(/^\d+h ago$/);
  });

  it('returns days for older timestamps', () => {
    const threeDaysAgo = Math.floor(Date.now() / 1000) - 259200;
    const result = relativeTime(threeDaysAgo);
    expect(result).toMatch(/^\d+d ago$/);
  });
});
