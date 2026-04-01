import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We need to mock the config paths to use a temp directory
const TEST_DIR = join(tmpdir(), `convoai-test-${Date.now()}`);
const TEST_CONFIG_PATH = join(TEST_DIR, 'config.json');

vi.mock('../../src/config/paths.js', () => ({
  getConfigDir: () => {
    mkdirSync(TEST_DIR, { recursive: true });
    return TEST_DIR;
  },
  getConfigPath: () => TEST_CONFIG_PATH,
  getProjectConfigPath: () => join(process.cwd(), '.convoai.json'),
}));

// Import after mocking
const { loadConfig, saveConfig, getActiveProfile, resolveConfig } = await import(
  '../../src/config/manager.js'
);

describe('Config Manager', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('loadConfig', () => {
    it('returns empty object when no config file exists', () => {
      const config = loadConfig();
      expect(config).toEqual({});
    });

    it('loads and parses valid config file', () => {
      const testConfig = {
        app_id: 'test-app',
        customer_id: 'cid',
        customer_secret: 'csecret',
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));

      const config = loadConfig();
      expect(config.app_id).toBe('test-app');
      expect(config.customer_id).toBe('cid');
    });

    it('returns empty config for malformed JSON', () => {
      writeFileSync(TEST_CONFIG_PATH, 'not valid json {{{');
      const config = loadConfig();
      expect(config).toEqual({});
    });
  });

  describe('saveConfig', () => {
    it('writes config to disk', () => {
      const config = {
        app_id: 'save-test',
        customer_id: 'cid',
        customer_secret: 'cs',
      };
      saveConfig(config);

      expect(existsSync(TEST_CONFIG_PATH)).toBe(true);
      const raw = require('node:fs').readFileSync(TEST_CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.app_id).toBe('save-test');
    });

    it('overwrites existing config', () => {
      saveConfig({ app_id: 'first' });
      saveConfig({ app_id: 'second' });

      const raw = require('node:fs').readFileSync(TEST_CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.app_id).toBe('second');
    });
  });

  describe('getActiveProfile', () => {
    it('throws when required credentials are missing', () => {
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify({}));
      expect(() => getActiveProfile()).toThrow('Missing required credentials');
    });

    it('returns merged config when credentials are set', () => {
      writeFileSync(
        TEST_CONFIG_PATH,
        JSON.stringify({
          app_id: 'app',
          customer_id: 'cid',
          customer_secret: 'cs',
        }),
      );

      const profile = getActiveProfile();
      expect(profile.app_id).toBe('app');
      expect(profile.customer_id).toBe('cid');
      expect(profile.customer_secret).toBe('cs');
    });

    it('merges named profile over base config', () => {
      writeFileSync(
        TEST_CONFIG_PATH,
        JSON.stringify({
          app_id: 'base-app',
          customer_id: 'base-cid',
          customer_secret: 'base-cs',
          profiles: {
            dev: {
              app_id: 'dev-app',
            },
          },
        }),
      );

      const profile = getActiveProfile('dev');
      expect(profile.app_id).toBe('dev-app');
      expect(profile.customer_id).toBe('base-cid');
    });

    it('uses default_profile when no profile name given', () => {
      writeFileSync(
        TEST_CONFIG_PATH,
        JSON.stringify({
          app_id: 'base',
          customer_id: 'cid',
          customer_secret: 'cs',
          default_profile: 'prod',
          profiles: {
            prod: {
              app_id: 'prod-app',
            },
          },
        }),
      );

      const profile = getActiveProfile();
      expect(profile.app_id).toBe('prod-app');
    });
  });

  describe('resolveConfig', () => {
    it('returns base config when no profile or project config', () => {
      writeFileSync(
        TEST_CONFIG_PATH,
        JSON.stringify({
          app_id: 'base',
          customer_id: 'cid',
          customer_secret: 'cs',
        }),
      );

      const resolved = resolveConfig();
      expect(resolved.app_id).toBe('base');
    });

    it('merges profile config over base', () => {
      writeFileSync(
        TEST_CONFIG_PATH,
        JSON.stringify({
          app_id: 'base',
          customer_id: 'cid',
          customer_secret: 'cs',
          profiles: {
            staging: {
              app_id: 'staging-app',
              region: 'cn',
            },
          },
        }),
      );

      const resolved = resolveConfig('staging');
      expect(resolved.app_id).toBe('staging-app');
      expect(resolved.region).toBe('cn');
      expect(resolved.customer_id).toBe('cid');
    });
  });
});
