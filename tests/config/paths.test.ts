import { describe, it, expect, vi, afterEach } from 'vitest';
import { getConfigDir, getConfigPath, getProjectConfigPath } from '../../src/config/paths.js';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

describe('getConfigDir', () => {
  const originalEnv = process.env.XDG_CONFIG_HOME;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.XDG_CONFIG_HOME = originalEnv;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
  });

  it('uses ~/.config/convoai by default', () => {
    delete process.env.XDG_CONFIG_HOME;
    const dir = getConfigDir();
    expect(dir).toBe(join(homedir(), '.config', 'convoai'));
  });

  it('respects XDG_CONFIG_HOME env var', () => {
    process.env.XDG_CONFIG_HOME = '/tmp/testconfig';
    const dir = getConfigDir();
    expect(dir).toBe('/tmp/testconfig/convoai');
  });
});

describe('getConfigPath', () => {
  it('returns config.json inside the config dir', () => {
    const path = getConfigPath();
    expect(path).toMatch(/convoai\/config\.json$/);
  });
});

describe('getProjectConfigPath', () => {
  it('returns .convoai.json in CWD', () => {
    const path = getProjectConfigPath();
    expect(path).toBe(resolve(process.cwd(), '.convoai.json'));
  });
});
