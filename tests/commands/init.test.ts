import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const CLI = join(process.cwd(), 'dist/bin/convoai.js');

function cli(args: string, cwd?: string): string {
  try {
    return execSync(`node ${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 15000,
      cwd: cwd || process.cwd(),
    });
  } catch (err: any) {
    return err.stdout || err.stderr || '';
  }
}

describe('convoai init', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'convoai-init-'));
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('shows help with --help', () => {
    const output = cli('init --help');
    expect(output).toContain('project-name');
  });

  it('creates project directory with expected structure', () => {
    cli('init test-app', tempDir);
    const projectDir = join(tempDir, 'test-app');
    expect(existsSync(projectDir)).toBe(true);
    expect(existsSync(join(projectDir, 'frontend', 'index.html'))).toBe(true);
    expect(existsSync(join(projectDir, 'frontend', 'style.css'))).toBe(true);
    expect(existsSync(join(projectDir, 'frontend', 'app.js'))).toBe(true);
    expect(existsSync(join(projectDir, 'server', 'index.ts'))).toBe(true);
    expect(existsSync(join(projectDir, 'server', 'convoai-api.ts'))).toBe(true);
    expect(existsSync(join(projectDir, 'server', 'routes', 'session.ts'))).toBe(true);
    expect(existsSync(join(projectDir, 'python-server', 'app.py'))).toBe(true);
    expect(existsSync(join(projectDir, 'connectors', 'README.md'))).toBe(true);
    expect(existsSync(join(projectDir, 'package.json'))).toBe(true);
    expect(existsSync(join(projectDir, '.gitignore'))).toBe(true);
    expect(existsSync(join(projectDir, 'README.md'))).toBe(true);
  });

  it('generates .env file', () => {
    cli('init test-app', tempDir);
    const envPath = join(tempDir, 'test-app', '.env');
    expect(existsSync(envPath)).toBe(true);
  });

  it('starter package.json has convoai-starter marker', () => {
    cli('init test-app', tempDir);
    const pkg = JSON.parse(readFileSync(join(tempDir, 'test-app', 'package.json'), 'utf-8'));
    expect(pkg['convoai-starter']).toBe(true);
  });

  it('updates package name to project name', () => {
    cli('init my-cool-app', tempDir);
    const pkg = JSON.parse(readFileSync(join(tempDir, 'my-cool-app', 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('my-cool-app');
  });

  it('uses default name when no argument given', () => {
    cli('init', tempDir);
    const projectDir = join(tempDir, 'my-convoai-app');
    expect(existsSync(projectDir)).toBe(true);
  });

  it('errors when directory already exists and is non-empty', () => {
    const existingDir = join(tempDir, 'existing-app');
    mkdirSync(existingDir);
    writeFileSync(join(existingDir, 'file.txt'), 'content');
    const output = cli('init existing-app', tempDir);
    expect(output.toLowerCase()).toContain('already exists');
  });

  it('prints next steps after success', () => {
    const output = cli('init test-app', tempDir);
    expect(output).toContain('cd test-app');
    expect(output).toContain('npm install');
    expect(output).toContain('convoai dev');
  });
});
