import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as child_process from 'node:child_process';

// Mock fs and child_process before importing the module under test
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return { ...actual, existsSync: vi.fn() };
});

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return { ...actual, execSync: vi.fn() };
});

describe('findChrome', () => {
  const existsSyncMock = vi.mocked(fs.existsSync);
  const execSyncMock = vi.mocked(child_process.execSync);
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.resetModules();
    existsSyncMock.mockReset();
    execSyncMock.mockReset();
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  function setPlatform(p: string) {
    Object.defineProperty(process, 'platform', { value: p, writable: true, configurable: true });
  }

  async function loadFindChrome() {
    const mod = await import('../../src/utils/find-chrome.js');
    return mod.findChrome;
  }

  // ── Return type ────────────────────────────────────────────────────────────

  it('returns a string or null', async () => {
    // Let it use the real platform; result should be string or null
    existsSyncMock.mockReturnValue(false);
    const findChrome = await loadFindChrome();
    const result = findChrome();
    expect(result === null || typeof result === 'string').toBe(true);
  });

  // ── macOS paths ────────────────────────────────────────────────────────────

  it('finds Google Chrome on macOS when it exists', async () => {
    setPlatform('darwin');
    existsSyncMock.mockImplementation((p) =>
      p === '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    );
    const findChrome = await loadFindChrome();
    const result = findChrome();
    expect(result).toBe('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  });

  it('finds Chromium on macOS when Chrome is absent', async () => {
    setPlatform('darwin');
    existsSyncMock.mockImplementation((p) =>
      p === '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
    const findChrome = await loadFindChrome();
    expect(findChrome()).toBe('/Applications/Chromium.app/Contents/MacOS/Chromium');
  });

  it('finds Edge on macOS when Chrome and Chromium are absent', async () => {
    setPlatform('darwin');
    existsSyncMock.mockImplementation((p) =>
      p === '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    );
    const findChrome = await loadFindChrome();
    expect(findChrome()).toBe('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  });

  it('finds Brave on macOS', async () => {
    setPlatform('darwin');
    existsSyncMock.mockImplementation((p) =>
      p === '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    );
    const findChrome = await loadFindChrome();
    expect(findChrome()).toBe('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser');
  });

  it('returns null on macOS when no browser is found', async () => {
    setPlatform('darwin');
    existsSyncMock.mockReturnValue(false);
    const findChrome = await loadFindChrome();
    expect(findChrome()).toBeNull();
  });

  it('returns the first browser found on macOS (priority order)', async () => {
    setPlatform('darwin');
    // Both Chrome and Edge exist; Chrome should win because it's checked first
    existsSyncMock.mockImplementation((p) =>
      p === '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' ||
      p === '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    );
    const findChrome = await loadFindChrome();
    expect(findChrome()).toBe('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  });

  // ── Linux paths ────────────────────────────────────────────────────────────

  it('finds google-chrome on Linux via which', async () => {
    setPlatform('linux');
    execSyncMock.mockImplementation((cmd: unknown) => {
      if (typeof cmd === 'string' && cmd.includes('google-chrome')) return '/usr/bin/google-chrome\n';
      throw new Error('not found');
    });
    const findChrome = await loadFindChrome();
    expect(findChrome()).toBe('/usr/bin/google-chrome');
  });

  it('falls back to chromium-browser on Linux', async () => {
    setPlatform('linux');
    execSyncMock.mockImplementation((cmd: unknown) => {
      if (typeof cmd === 'string' && cmd.includes('chromium-browser')) return '/usr/bin/chromium-browser\n';
      throw new Error('not found');
    });
    const findChrome = await loadFindChrome();
    expect(findChrome()).toBe('/usr/bin/chromium-browser');
  });

  it('returns null on Linux when no browser is found', async () => {
    setPlatform('linux');
    execSyncMock.mockImplementation(() => { throw new Error('not found'); });
    const findChrome = await loadFindChrome();
    expect(findChrome()).toBeNull();
  });

  // ── Windows paths ──────────────────────────────────────────────────────────

  it('finds Chrome on Windows', async () => {
    setPlatform('win32');
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    process.env.PROGRAMFILES = 'C:\\Program Files';
    process.env['PROGRAMFILES(X86)'] = 'C:\\Program Files (x86)';
    process.env.LOCALAPPDATA = 'C:\\Users\\Test\\AppData\\Local';

    existsSyncMock.mockImplementation((p) => p === chromePath);
    const findChrome = await loadFindChrome();
    expect(findChrome()).toBe(chromePath);
  });

  it('finds Edge on Windows when Chrome is absent', async () => {
    setPlatform('win32');
    const edgePath = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
    process.env.PROGRAMFILES = 'C:\\Program Files';
    process.env['PROGRAMFILES(X86)'] = 'C:\\Program Files (x86)';
    process.env.LOCALAPPDATA = 'C:\\Users\\Test\\AppData\\Local';

    existsSyncMock.mockImplementation((p) => p === edgePath);
    const findChrome = await loadFindChrome();
    expect(findChrome()).toBe(edgePath);
  });

  it('returns null on Windows when no browser is found', async () => {
    setPlatform('win32');
    process.env.PROGRAMFILES = 'C:\\Program Files';
    process.env['PROGRAMFILES(X86)'] = 'C:\\Program Files (x86)';
    process.env.LOCALAPPDATA = 'C:\\Users\\Test\\AppData\\Local';

    existsSyncMock.mockReturnValue(false);
    const findChrome = await loadFindChrome();
    expect(findChrome()).toBeNull();
  });

  // ── Unknown platform ──────────────────────────────────────────────────────

  it('returns null on an unknown platform', async () => {
    setPlatform('freebsd');
    existsSyncMock.mockReturnValue(false);
    const findChrome = await loadFindChrome();
    expect(findChrome()).toBeNull();
  });
});
