import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the config manager
vi.mock('../../src/config/manager.js', () => ({
  loadConfig: vi.fn(),
}));

// Mock agora-token
vi.mock('agora-token', () => ({
  default: {
    RtcTokenBuilder: {
      buildTokenWithUid: vi.fn().mockReturnValue('mock-token-abc123'),
    },
    RtcRole: {
      PUBLISHER: 1,
    },
  },
}));

describe('generateRtcToken', () => {
  let loadConfigMock: ReturnType<typeof vi.fn>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    vi.resetModules();
    originalEnv = { ...process.env };

    const configManager = await import('../../src/config/manager.js');
    loadConfigMock = vi.mocked(configManager.loadConfig);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function loadGenerateRtcToken() {
    const mod = await import('../../src/utils/token.js');
    return mod.generateRtcToken;
  }

  // ── Returns undefined when config is missing ──────────────────────────────

  it('returns undefined when app_id is missing', async () => {
    loadConfigMock.mockReturnValue({ app_certificate: 'cert123' });
    delete process.env.AGORA_APP_CERTIFICATE;

    const generateRtcToken = await loadGenerateRtcToken();
    const result = await generateRtcToken('test-channel');
    expect(result).toBeUndefined();
  });

  it('returns undefined when app_certificate is missing and env not set', async () => {
    loadConfigMock.mockReturnValue({ app_id: 'appid123' });
    delete process.env.AGORA_APP_CERTIFICATE;

    const generateRtcToken = await loadGenerateRtcToken();
    const result = await generateRtcToken('test-channel');
    expect(result).toBeUndefined();
  });

  it('returns undefined when both app_id and app_certificate are missing', async () => {
    loadConfigMock.mockReturnValue({});
    delete process.env.AGORA_APP_CERTIFICATE;

    const generateRtcToken = await loadGenerateRtcToken();
    const result = await generateRtcToken('test-channel');
    expect(result).toBeUndefined();
  });

  // ── Returns a token string when config is present ─────────────────────────

  it('returns a token string when both app_id and app_certificate are present', async () => {
    loadConfigMock.mockReturnValue({
      app_id: 'test-app-id',
      app_certificate: 'test-certificate',
    });
    delete process.env.AGORA_APP_CERTIFICATE;

    const generateRtcToken = await loadGenerateRtcToken();
    const result = await generateRtcToken('my-channel');
    expect(result).toBe('mock-token-abc123');
  });

  it('uses AGORA_APP_CERTIFICATE env var over config', async () => {
    loadConfigMock.mockReturnValue({
      app_id: 'test-app-id',
      app_certificate: 'config-cert',
    });
    process.env.AGORA_APP_CERTIFICATE = 'env-cert';

    const generateRtcToken = await loadGenerateRtcToken();
    const result = await generateRtcToken('my-channel');
    expect(result).toBe('mock-token-abc123');
  });

  it('uses AGORA_APP_CERTIFICATE env var when config has no certificate', async () => {
    loadConfigMock.mockReturnValue({
      app_id: 'test-app-id',
    });
    process.env.AGORA_APP_CERTIFICATE = 'env-cert';

    const generateRtcToken = await loadGenerateRtcToken();
    const result = await generateRtcToken('my-channel');
    expect(result).toBe('mock-token-abc123');
  });

  // ── Default parameters ────────────────────────────────────────────────────

  it('uses uid=0 and expire=86400 by default', async () => {
    loadConfigMock.mockReturnValue({
      app_id: 'test-app-id',
      app_certificate: 'test-cert',
    });
    delete process.env.AGORA_APP_CERTIFICATE;

    const agoraToken = await import('agora-token');
    const buildSpy = vi.mocked((agoraToken.default as any).RtcTokenBuilder.buildTokenWithUid);
    buildSpy.mockClear();

    const generateRtcToken = await loadGenerateRtcToken();
    await generateRtcToken('default-channel');

    expect(buildSpy).toHaveBeenCalledTimes(1);
    const [appId, cert, channel, uid, role, expireTs1, expireTs2] = buildSpy.mock.calls[0];
    expect(appId).toBe('test-app-id');
    expect(cert).toBe('test-cert');
    expect(channel).toBe('default-channel');
    expect(uid).toBe(0);
    expect(role).toBe(1); // PUBLISHER

    // Expire timestamp should be roughly now + 86400
    const expectedExpire = Math.floor(Date.now() / 1000) + 86400;
    expect(Math.abs(expireTs1 - expectedExpire)).toBeLessThan(5);
  });

  // ── Custom parameters ────────────────────────────────────────────────────

  it('accepts custom uid and expire', async () => {
    loadConfigMock.mockReturnValue({
      app_id: 'test-app-id',
      app_certificate: 'test-cert',
    });
    delete process.env.AGORA_APP_CERTIFICATE;

    const agoraToken = await import('agora-token');
    const buildSpy = vi.mocked((agoraToken.default as any).RtcTokenBuilder.buildTokenWithUid);
    buildSpy.mockClear();

    const generateRtcToken = await loadGenerateRtcToken();
    await generateRtcToken('custom-channel', 999, 3600);

    const [, , , uid, , expireTs] = buildSpy.mock.calls[0];
    expect(uid).toBe(999);

    const expectedExpire = Math.floor(Date.now() / 1000) + 3600;
    expect(Math.abs(expireTs - expectedExpire)).toBeLessThan(5);
  });

  // ── Graceful handling of agora-token failures ─────────────────────────────

  it('returns undefined when agora-token throws', async () => {
    loadConfigMock.mockReturnValue({
      app_id: 'test-app-id',
      app_certificate: 'test-cert',
    });
    delete process.env.AGORA_APP_CERTIFICATE;

    const agoraToken = await import('agora-token');
    const buildSpy = vi.mocked((agoraToken.default as any).RtcTokenBuilder.buildTokenWithUid);
    buildSpy.mockImplementation(() => { throw new Error('token build failed'); });

    const generateRtcToken = await loadGenerateRtcToken();
    const result = await generateRtcToken('fail-channel');
    expect(result).toBeUndefined();
  });
});
