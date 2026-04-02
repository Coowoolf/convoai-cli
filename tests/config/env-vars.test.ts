import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), `convoai-env-test-${Date.now()}`);
const TEST_CONFIG_PATH = join(TEST_DIR, 'config.json');

vi.mock('../../src/config/paths.js', () => ({
  getConfigDir: () => {
    mkdirSync(TEST_DIR, { recursive: true });
    return TEST_DIR;
  },
  getConfigPath: () => TEST_CONFIG_PATH,
  getProjectConfigPath: () => join(process.cwd(), '.convoai.json'),
}));

const { resolveConfig, getActiveProfile } = await import('../../src/config/manager.js');

describe('Environment Variable Support', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      TEST_CONFIG_PATH,
      JSON.stringify({
        app_id: 'file-app',
        customer_id: 'file-cid',
        customer_secret: 'file-cs',
      }),
    );
  });

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('env vars override config file values in resolveConfig', () => {
    process.env.CONVOAI_APP_ID = 'env-app';
    const resolved = resolveConfig();
    expect(resolved.app_id).toBe('env-app');
    expect(resolved.customer_id).toBe('file-cid'); // not overridden
  });

  it('env vars override config file values in getActiveProfile', () => {
    process.env.CONVOAI_APP_ID = 'env-app';
    process.env.CONVOAI_CUSTOMER_ID = 'env-cid';
    process.env.CONVOAI_CUSTOMER_SECRET = 'env-cs';
    const profile = getActiveProfile();
    expect(profile.app_id).toBe('env-app');
    expect(profile.customer_id).toBe('env-cid');
    expect(profile.customer_secret).toBe('env-cs');
  });

  it('CONVOAI_BASE_URL overrides config', () => {
    process.env.CONVOAI_BASE_URL = 'https://custom.api.com';
    const resolved = resolveConfig();
    expect(resolved.base_url).toBe('https://custom.api.com');
  });

  it('CONVOAI_REGION overrides config', () => {
    process.env.CONVOAI_REGION = 'cn';
    const resolved = resolveConfig();
    expect(resolved.region).toBe('cn');
  });

  it('config file values used when env vars not set', () => {
    delete process.env.CONVOAI_APP_ID;
    delete process.env.CONVOAI_CUSTOMER_ID;
    delete process.env.CONVOAI_CUSTOMER_SECRET;
    const resolved = resolveConfig();
    expect(resolved.app_id).toBe('file-app');
  });
});
