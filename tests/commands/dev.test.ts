import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const CLI = join(process.cwd(), 'dist/bin/convoai.js');

function cli(args: string, cwd?: string): string {
  try {
    return execSync(`node ${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
      cwd: cwd || process.cwd(),
    });
  } catch (err: any) {
    return err.stdout || err.stderr || '';
  }
}

describe('convoai dev', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'convoai-dev-'));
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('shows help with --help', () => {
    const output = cli('dev --help');
    expect(output).toContain('starter');
  });

  it('errors when not in a starter project directory', () => {
    const output = cli('dev', tempDir);
    expect(output.toLowerCase()).toMatch(/not.*starter|not.*convoai/i);
  });

  it('errors when package.json exists but missing convoai-starter marker', () => {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));
    const output = cli('dev', tempDir);
    expect(output.toLowerCase()).toMatch(/not.*starter|not.*convoai/i);
  });

  it('errors when node_modules is missing', () => {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ 'convoai-starter': true }));
    const output = cli('dev', tempDir);
    expect(output.toLowerCase()).toMatch(/npm install/i);
  });

  it('detects valid starter project', () => {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      'convoai-starter': true,
      scripts: { dev: 'echo ok' },
    }));
    mkdirSync(join(tempDir, 'node_modules'));
    const output = cli('dev', tempDir);
    expect(output.toLowerCase()).not.toMatch(/not.*starter/i);
  });
});
