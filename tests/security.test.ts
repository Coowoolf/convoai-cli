import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, statSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ─── C1: File Permissions ───────────────────────────────────────────────────

const TEST_DIR = join(tmpdir(), `convoai-sec-test-${Date.now()}`);
const TEST_CONFIG_PATH = join(TEST_DIR, 'config.json');

vi.mock('../src/config/paths.js', () => ({
  getConfigDir: () => {
    mkdirSync(TEST_DIR, { recursive: true, mode: 0o700 });
    return TEST_DIR;
  },
  getConfigPath: () => TEST_CONFIG_PATH,
  getProjectConfigPath: () => join(process.cwd(), '.convoai.json'),
}));

const { saveConfig, loadConfig } = await import('../src/config/manager.js');

describe('Security: Config file permissions', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('saves config file with restricted permissions (0600)', () => {
    saveConfig({ app_id: 'test', customer_id: 'cid', customer_secret: 'cs' });
    const stat = statSync(TEST_CONFIG_PATH);
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('config file is not world-readable', () => {
    saveConfig({ app_id: 'test' });
    const stat = statSync(TEST_CONFIG_PATH);
    const othersRead = stat.mode & 0o004;
    expect(othersRead).toBe(0);
  });
});

// ─── C2: Template Name Sanitization ────────────────────────────────────────

import { SAFE_NAME_PATTERN } from '../src/templates/manager.js';

describe('Security: Template name validation', () => {
  it('rejects path traversal attempts', () => {
    expect(SAFE_NAME_PATTERN.test('../../etc/passwd')).toBe(false);
    expect(SAFE_NAME_PATTERN.test('../config/config')).toBe(false);
    expect(SAFE_NAME_PATTERN.test('hello/../world')).toBe(false);
  });

  it('rejects names with slashes', () => {
    expect(SAFE_NAME_PATTERN.test('foo/bar')).toBe(false);
    expect(SAFE_NAME_PATTERN.test('foo\\bar')).toBe(false);
  });

  it('rejects names with dots only', () => {
    expect(SAFE_NAME_PATTERN.test('.')).toBe(false);
    expect(SAFE_NAME_PATTERN.test('..')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(SAFE_NAME_PATTERN.test('')).toBe(false);
  });

  it('rejects names starting with hyphen', () => {
    expect(SAFE_NAME_PATTERN.test('-bad')).toBe(false);
  });

  it('accepts valid template names', () => {
    expect(SAFE_NAME_PATTERN.test('my-template')).toBe(true);
    expect(SAFE_NAME_PATTERN.test('my_template')).toBe(true);
    expect(SAFE_NAME_PATTERN.test('MyTemplate123')).toBe(true);
    expect(SAFE_NAME_PATTERN.test('v2')).toBe(true);
    expect(SAFE_NAME_PATTERN.test('openai-gpt4o-voice')).toBe(true);
  });
});

// ─── I5: Retry logic constants ──────────────────────────────────────────────

import { resolveBaseUrl } from '../src/api/client.js';

describe('Security: API client base URL', () => {
  it('never exposes credentials in URL', () => {
    const url = resolveBaseUrl('myapp', 'global');
    expect(url).not.toContain('secret');
    expect(url).not.toContain('password');
  });
});
