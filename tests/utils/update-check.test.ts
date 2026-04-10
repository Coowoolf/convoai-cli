import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('fetchLatestVersion', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns version string on successful fetch', async () => {
    vi.doMock('axios', () => ({
      default: {
        get: vi.fn().mockResolvedValue({ data: { version: '1.9.0' } }),
      },
    }));
    const { fetchLatestVersion } = await import('../../src/utils/update-check.js');
    const result = await fetchLatestVersion();
    expect(result).toBe('1.9.0');
  });

  it('returns null on network error', async () => {
    vi.doMock('axios', () => ({
      default: {
        get: vi.fn().mockRejectedValue(new Error('network')),
      },
    }));
    const { fetchLatestVersion } = await import('../../src/utils/update-check.js');
    const result = await fetchLatestVersion();
    expect(result).toBeNull();
  });

  it('returns null if response has no version field', async () => {
    vi.doMock('axios', () => ({
      default: {
        get: vi.fn().mockResolvedValue({ data: {} }),
      },
    }));
    const { fetchLatestVersion } = await import('../../src/utils/update-check.js');
    const result = await fetchLatestVersion();
    expect(result).toBeNull();
  });
});
