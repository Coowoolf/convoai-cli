import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Test config manager edge cases
const TEST_DIR = join(tmpdir(), `convoai-edge-test-${Date.now()}`);
const TEST_CONFIG_PATH = join(TEST_DIR, 'config.json');

vi.mock('../../src/config/paths.js', () => ({
  getConfigDir: () => {
    mkdirSync(TEST_DIR, { recursive: true });
    return TEST_DIR;
  },
  getConfigPath: () => TEST_CONFIG_PATH,
  getProjectConfigPath: () => join(process.cwd(), '.convoai.json'),
}));

const { loadConfig, saveConfig, getActiveProfile, resolveConfig } = await import(
  '../../src/config/manager.js'
);

describe('Config Manager Edge Cases', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('handles config with all fields populated', () => {
    const fullConfig = {
      app_id: 'full-app',
      customer_id: 'full-cid',
      customer_secret: 'full-cs',
      base_url: 'https://custom.api.com',
      region: 'cn',
      default_profile: 'dev',
      profiles: {
        dev: {
          app_id: 'dev-app',
          customer_id: 'dev-cid',
          customer_secret: 'dev-cs',
          region: 'global',
          llm: {
            vendor: 'openai',
            model: 'gpt-4o',
            style: 'openai',
          },
          tts: { vendor: 'microsoft' },
          asr: { vendor: 'deepgram', language: 'en-US' },
        },
      },
    };
    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(fullConfig));
    const loaded = loadConfig();
    expect(loaded.profiles?.dev?.llm?.model).toBe('gpt-4o');
  });

  it('getActiveProfile with missing profile name falls back to base', () => {
    writeFileSync(
      TEST_CONFIG_PATH,
      JSON.stringify({
        app_id: 'app',
        customer_id: 'cid',
        customer_secret: 'cs',
        profiles: {},
      }),
    );

    const profile = getActiveProfile('nonexistent');
    expect(profile.app_id).toBe('app');
  });

  it('resolveConfig merges across layers', () => {
    writeFileSync(
      TEST_CONFIG_PATH,
      JSON.stringify({
        app_id: 'base-app',
        customer_id: 'base-cid',
        customer_secret: 'base-cs',
        region: 'global',
        profiles: {
          dev: {
            region: 'cn',
            llm: { model: 'dev-model' },
          },
        },
      }),
    );

    const resolved = resolveConfig('dev');
    expect(resolved.app_id).toBe('base-app');
    expect(resolved.region).toBe('cn');
    expect(resolved.llm?.model).toBe('dev-model');
  });

  it('save and reload preserves data integrity', () => {
    const config = {
      app_id: 'integrity-test',
      customer_id: 'cid',
      customer_secret: 'cs',
      profiles: {
        a: { app_id: 'a-app', llm: { model: 'm1' } },
        b: { app_id: 'b-app', tts: { vendor: 'microsoft' } },
      },
    };
    saveConfig(config);
    const loaded = loadConfig();
    expect(loaded.profiles?.a?.llm?.model).toBe('m1');
    expect(loaded.profiles?.b?.tts?.vendor).toBe('microsoft');
  });
});

// Test shortId edge cases
import { shortId } from '../../src/utils/hints.js';

describe('shortId edge cases', () => {
  it('handles exactly 12 characters', () => {
    expect(shortId('123456789012')).toBe('123456789012');
  });

  it('handles 13 characters', () => {
    expect(shortId('1234567890123')).toBe('123456789012');
  });

  it('handles special characters', () => {
    expect(shortId('abc-def_ghi.jkl')).toBe('abc-def_ghi.');
  });
});

// Test resolveBaseUrl edge cases
import { resolveBaseUrl } from '../../src/api/client.js';

describe('resolveBaseUrl edge cases', () => {
  it('handles empty appId', () => {
    const url = resolveBaseUrl('');
    expect(url).toContain('/projects/');
  });

  it('handles appId with special characters', () => {
    const url = resolveBaseUrl('app-123_test');
    expect(url).toContain('app-123_test');
  });

  it('custom URL takes precedence over region', () => {
    const url = resolveBaseUrl('app', 'cn', 'https://custom.com');
    expect(url).toBe('https://custom.com');
    expect(url).not.toContain('cn');
  });
});

// Test AgentStatusCode/AgentStatusNumber consistency
import { AgentStatusCode, AgentStatusNumber } from '../../src/api/types.js';

describe('Status code bidirectional mapping', () => {
  it('every code maps to a status and back', () => {
    for (const [codeStr, status] of Object.entries(AgentStatusCode)) {
      const code = Number(codeStr);
      expect(AgentStatusNumber[status as keyof typeof AgentStatusNumber]).toBe(code);
    }
  });

  it('every status maps to a code and back', () => {
    for (const [status, code] of Object.entries(AgentStatusNumber)) {
      expect(AgentStatusCode[code]).toBe(status);
    }
  });
});
