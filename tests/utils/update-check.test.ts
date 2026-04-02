import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock axios before importing the module under test
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('update-check', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  async function loadModule() {
    const mod = await import('../../src/utils/update-check.js');
    return mod;
  }

  async function getAxiosMock() {
    const axios = await import('axios');
    return vi.mocked(axios.default.get);
  }

  // ── isNewer logic ─────────────────────────────────────────────────────────
  // isNewer is not exported, but we can test it indirectly through checkForUpdate:
  // if latest is newer, it prints; if not, it stays silent.

  describe('version comparison (isNewer) via checkForUpdate', () => {
    it('detects 1.0.1 as newer than 1.0.0', async () => {
      const axiosGet = await getAxiosMock();
      axiosGet.mockResolvedValue({ data: { version: '1.0.1' } });

      const { checkForUpdate } = await loadModule();
      await checkForUpdate('1.0.0');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(c => c[0]).join(' ');
      expect(output).toContain('1.0.1');
    });

    it('detects 1.1.0 as newer than 1.0.9', async () => {
      const axiosGet = await getAxiosMock();
      axiosGet.mockResolvedValue({ data: { version: '1.1.0' } });

      const { checkForUpdate } = await loadModule();
      await checkForUpdate('1.0.9');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(c => c[0]).join(' ');
      expect(output).toContain('1.1.0');
    });

    it('detects 2.0.0 as newer than 1.9.9', async () => {
      const axiosGet = await getAxiosMock();
      axiosGet.mockResolvedValue({ data: { version: '2.0.0' } });

      const { checkForUpdate } = await loadModule();
      await checkForUpdate('1.9.9');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(c => c[0]).join(' ');
      expect(output).toContain('2.0.0');
    });

    it('detects 10.0.0 as newer than 9.9.9', async () => {
      const axiosGet = await getAxiosMock();
      axiosGet.mockResolvedValue({ data: { version: '10.0.0' } });

      const { checkForUpdate } = await loadModule();
      await checkForUpdate('9.9.9');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(c => c[0]).join(' ');
      expect(output).toContain('10.0.0');
    });
  });

  // ── No update when versions match ─────────────────────────────────────────

  describe('no update needed', () => {
    it('does not print when versions match', async () => {
      const axiosGet = await getAxiosMock();
      axiosGet.mockResolvedValue({ data: { version: '1.0.0' } });

      const { checkForUpdate } = await loadModule();
      await checkForUpdate('1.0.0');

      // No console.log calls about updates (empty string check)
      const updateCalls = consoleSpy.mock.calls.filter(c =>
        typeof c[0] === 'string' && c[0].includes('Update available'),
      );
      expect(updateCalls).toHaveLength(0);
    });

    it('does not print when current version is newer than registry', async () => {
      const axiosGet = await getAxiosMock();
      axiosGet.mockResolvedValue({ data: { version: '1.0.0' } });

      const { checkForUpdate } = await loadModule();
      await checkForUpdate('2.0.0');

      const updateCalls = consoleSpy.mock.calls.filter(c =>
        typeof c[0] === 'string' && c[0].includes('Update available'),
      );
      expect(updateCalls).toHaveLength(0);
    });

    it('does not print when latest version is null/undefined', async () => {
      const axiosGet = await getAxiosMock();
      axiosGet.mockResolvedValue({ data: {} });

      const { checkForUpdate } = await loadModule();
      await checkForUpdate('1.0.0');

      const updateCalls = consoleSpy.mock.calls.filter(c =>
        typeof c[0] === 'string' && c[0].includes('Update available'),
      );
      expect(updateCalls).toHaveLength(0);
    });
  });

  // ── Update message content ────────────────────────────────────────────────

  describe('update message', () => {
    it('prints the current and latest version', async () => {
      const axiosGet = await getAxiosMock();
      axiosGet.mockResolvedValue({ data: { version: '2.0.0' } });

      const { checkForUpdate } = await loadModule();
      await checkForUpdate('1.0.0');

      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('2.0.0');
      expect(output).toContain('1.0.0');
    });

    it('prints the npm install command', async () => {
      const axiosGet = await getAxiosMock();
      axiosGet.mockResolvedValue({ data: { version: '2.0.0' } });

      const { checkForUpdate } = await loadModule();
      await checkForUpdate('1.0.0');

      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('npm install -g convoai@latest');
    });
  });

  // ── Network errors are handled silently ───────────────────────────────────

  describe('error handling', () => {
    it('does not throw on network error', async () => {
      const axiosGet = await getAxiosMock();
      axiosGet.mockRejectedValue(new Error('ECONNREFUSED'));

      const { checkForUpdate } = await loadModule();
      await expect(checkForUpdate('1.0.0')).resolves.toBeUndefined();
    });

    it('does not throw on timeout', async () => {
      const axiosGet = await getAxiosMock();
      axiosGet.mockRejectedValue(new Error('timeout of 3000ms exceeded'));

      const { checkForUpdate } = await loadModule();
      await expect(checkForUpdate('1.0.0')).resolves.toBeUndefined();
    });

    it('does not throw on malformed response', async () => {
      const axiosGet = await getAxiosMock();
      axiosGet.mockResolvedValue({ data: 'not json' });

      const { checkForUpdate } = await loadModule();
      await expect(checkForUpdate('1.0.0')).resolves.toBeUndefined();
    });

    it('does not print anything on network error', async () => {
      const axiosGet = await getAxiosMock();
      axiosGet.mockRejectedValue(new Error('offline'));

      const { checkForUpdate } = await loadModule();
      await checkForUpdate('1.0.0');

      const updateCalls = consoleSpy.mock.calls.filter(c =>
        typeof c[0] === 'string' && c[0].includes('Update available'),
      );
      expect(updateCalls).toHaveLength(0);
    });
  });

  // ── Uses correct npm registry URL ────────────────────────────────────────

  it('fetches from the npm registry with correct URL', async () => {
    const axiosGet = await getAxiosMock();
    axiosGet.mockResolvedValue({ data: { version: '1.0.0' } });

    const { checkForUpdate } = await loadModule();
    await checkForUpdate('1.0.0');

    expect(axiosGet).toHaveBeenCalledWith(
      'https://registry.npmjs.org/convoai/latest',
      expect.objectContaining({ timeout: 3000 }),
    );
  });
});
