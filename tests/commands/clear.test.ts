import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI = join(process.cwd(), 'dist/bin/convoai.js');

function cli(args: string, env: Record<string, string> = {}): string {
  try {
    return execSync(`node ${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
      env: { ...process.env, ...env },
    });
  } catch (err: any) {
    return err.stdout || err.stderr || '';
  }
}

describe('convoai clear', () => {
  it('shows help with --help', () => {
    const output = cli('clear --help');
    expect(output).toContain('--force');
    expect(output).toContain('--global-only');
    expect(output).toContain('--json');
  });

  it('appears in top-level help', () => {
    const output = cli('--help');
    expect(output).toContain('clear');
  });
});

describe('convoai clear --force (integration)', () => {
  let testHome: string;
  let testConfigDir: string;

  beforeEach(() => {
    testHome = join(tmpdir(), `convoai-clear-force-${Date.now()}`);
    testConfigDir = join(testHome, 'convoai');
    mkdirSync(testConfigDir, { recursive: true });
    writeFileSync(join(testConfigDir, 'config.json'), '{"app_id":"test"}');
    mkdirSync(join(testConfigDir, 'templates'));
    writeFileSync(join(testConfigDir, 'templates', 'a.json'), '{}');
  });

  afterEach(() => {
    if (existsSync(testHome)) {
      rmSync(testHome, { recursive: true, force: true });
    }
  });

  it('removes config files with --force and XDG_CONFIG_HOME set', () => {
    const output = cli('clear --force --global-only', { XDG_CONFIG_HOME: testHome });
    expect(existsSync(join(testConfigDir, 'config.json'))).toBe(false);
    expect(existsSync(join(testConfigDir, 'templates'))).toBe(false);
    expect(existsSync(testConfigDir)).toBe(true);
  });

  it('outputs JSON with --json --force', () => {
    const output = cli('clear --json --force --global-only', { XDG_CONFIG_HOME: testHome });
    const parsed = JSON.parse(output);
    expect(parsed.cleared).toBeInstanceOf(Array);
    expect(parsed.cleared.length).toBeGreaterThan(0);
    expect(parsed.errors).toEqual([]);
    expect(parsed.cancelled).toBe(false);
  });

  it('shows nothing-to-clear message when config is empty', () => {
    rmSync(join(testConfigDir, 'config.json'));
    rmSync(join(testConfigDir, 'templates'), { recursive: true });
    const output = cli('clear --force --global-only', { XDG_CONFIG_HOME: testHome });
    expect(output.toLowerCase()).toContain('nothing to clear');
  });
});
