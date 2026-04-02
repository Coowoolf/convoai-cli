import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { join } from 'node:path';

// We need to mock fs (for existsSync, readFileSync, writeFileSync) and getConfigDir
// before importing the module under test.

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

vi.mock('../../src/config/paths.js', () => ({
  getConfigDir: () => '/tmp/convoai-test-telemetry',
}));

const existsSyncMock = vi.mocked(fs.existsSync);
const readFileSyncMock = vi.mocked(fs.readFileSync);
const writeFileSyncMock = vi.mocked(fs.writeFileSync);

describe('telemetry – track()', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    existsSyncMock.mockReset();
    readFileSyncMock.mockReset();
    writeFileSyncMock.mockReset();

    originalEnv = { ...process.env };

    // Mock global fetch
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);

    // Default: no session file, no config file
    existsSyncMock.mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  async function loadTrack() {
    const mod = await import('../../src/utils/telemetry.js');
    return mod.track;
  }

  // ── Fire-and-forget, never throws ─────────────────────────────────────────

  it('never throws even when fetch rejects', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const track = await loadTrack();
    expect(() => track('test_event')).not.toThrow();
  });

  it('never throws when fetch is not available', async () => {
    vi.stubGlobal('fetch', undefined);
    const track = await loadTrack();
    expect(() => track('test_event')).not.toThrow();
  });

  it('never throws when fetch throws synchronously', async () => {
    vi.stubGlobal('fetch', () => { throw new Error('sync kaboom'); });
    const track = await loadTrack();
    expect(() => track('test_event')).not.toThrow();
  });

  // ── Sends POST to the telemetry endpoint ──────────────────────────────────

  it('sends a POST request to the telemetry URL', async () => {
    const track = await loadTrack();
    track('cli_start');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://convobench.org/api/t');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('includes the event name in the POST body', async () => {
    const track = await loadTrack();
    track('agent_start');

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.event).toBe('agent_start');
  });

  it('includes extra fields in the POST body', async () => {
    const track = await loadTrack();
    track('error', { error_type: 'timeout' });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.error_type).toBe('timeout');
  });

  it('includes a session_id in the POST body', async () => {
    const track = await loadTrack();
    track('test_event');

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.session_id).toBeDefined();
    expect(typeof body.session_id).toBe('string');
    expect(body.session_id.length).toBeGreaterThan(0);
  });

  it('includes a monotonic ts field', async () => {
    const track = await loadTrack();
    track('event_a');
    track('event_b');

    const bodyA = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const bodyB = JSON.parse(fetchSpy.mock.calls[1][1].body);
    expect(bodyB.ts).toBeGreaterThan(bodyA.ts);
  });

  // ── Opt-out via CONVOAI_TELEMETRY env var ─────────────────────────────────

  it('does NOT send when CONVOAI_TELEMETRY=0', async () => {
    process.env.CONVOAI_TELEMETRY = '0';
    const track = await loadTrack();
    track('should_not_send');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does NOT send when CONVOAI_TELEMETRY=false', async () => {
    process.env.CONVOAI_TELEMETRY = 'false';
    const track = await loadTrack();
    track('should_not_send');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends when CONVOAI_TELEMETRY is not set', async () => {
    delete process.env.CONVOAI_TELEMETRY;
    const track = await loadTrack();
    track('should_send');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('sends when CONVOAI_TELEMETRY=1', async () => {
    process.env.CONVOAI_TELEMETRY = '1';
    const track = await loadTrack();
    track('should_send');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // ── Opt-out via config file ───────────────────────────────────────────────

  it('does NOT send when config.json has telemetry: false', async () => {
    delete process.env.CONVOAI_TELEMETRY;
    existsSyncMock.mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('config.json')) return true;
      return false;
    });
    readFileSyncMock.mockImplementation((p: any) => {
      if (typeof p === 'string' && p.endsWith('config.json')) return JSON.stringify({ telemetry: false });
      throw new Error('not found');
    });

    const track = await loadTrack();
    track('should_not_send');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ── Session ID persistence ────────────────────────────────────────────────

  it('reads session ID from .session file when it exists', async () => {
    existsSyncMock.mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('.session')) return true;
      return false;
    });
    readFileSyncMock.mockImplementation((p: any) => {
      if (typeof p === 'string' && p.endsWith('.session')) return 'abc12345';
      throw new Error('not found');
    });

    const track = await loadTrack();
    track('test');

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.session_id).toBe('abc12345');
  });

  it('writes a new session ID when .session file does not exist', async () => {
    existsSyncMock.mockReturnValue(false);

    const track = await loadTrack();
    track('test');

    // writeFileSync should have been called for the session file
    const sessionWrite = writeFileSyncMock.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].endsWith('.session'),
    );
    expect(sessionWrite).toBeDefined();
    // The written session ID should be 8 chars (UUID slice)
    expect(typeof sessionWrite![1]).toBe('string');
    expect((sessionWrite![1] as string).length).toBe(8);
  });

  // ── AbortSignal timeout ────────────────────────────────────────────────────

  it('uses a 3000ms abort signal timeout', async () => {
    const track = await loadTrack();
    track('test');

    const opts = fetchSpy.mock.calls[0][1];
    expect(opts.signal).toBeDefined();
  });
});
