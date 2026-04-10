import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('formatSize', () => {
  it('formats bytes', async () => {
    const { formatSize } = await import('../../src/commands/clear.js');
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(500)).toBe('500 B');
    expect(formatSize(1023)).toBe('1023 B');
  });

  it('formats kilobytes', async () => {
    const { formatSize } = await import('../../src/commands/clear.js');
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(102400)).toBe('100.0 KB');
  });

  it('formats megabytes', async () => {
    const { formatSize } = await import('../../src/commands/clear.js');
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(1024 * 1024 * 5)).toBe('5.0 MB');
  });
});

describe('scanDirectory', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `convoai-clear-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('returns empty array for empty directory', async () => {
    const { scanDirectory } = await import('../../src/commands/clear.js');
    const entries = scanDirectory(testDir);
    expect(entries).toEqual([]);
  });

  it('returns files with size', async () => {
    writeFileSync(join(testDir, 'config.json'), '{"app_id":"test"}');
    writeFileSync(join(testDir, '.session'), 'abc');
    const { scanDirectory } = await import('../../src/commands/clear.js');
    const entries = scanDirectory(testDir);
    expect(entries).toHaveLength(2);
    const config = entries.find(e => e.path.endsWith('config.json'));
    expect(config).toBeDefined();
    expect(config!.size).toBe(17);
    expect(config!.type).toBe('file');
  });

  it('returns subdirectories as dir entries', async () => {
    mkdirSync(join(testDir, 'templates'));
    writeFileSync(join(testDir, 'templates', 'one.json'), '{}');
    writeFileSync(join(testDir, 'templates', 'two.json'), '{}');
    const { scanDirectory } = await import('../../src/commands/clear.js');
    const entries = scanDirectory(testDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('dir');
    expect(entries[0].path.endsWith('templates')).toBe(true);
  });

  it('returns empty dir entry with size 0', async () => {
    mkdirSync(join(testDir, 'templates'));
    const { scanDirectory } = await import('../../src/commands/clear.js');
    const entries = scanDirectory(testDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('dir');
    expect(entries[0].size).toBe(0);
  });
});
