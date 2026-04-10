import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const CLI = join(process.cwd(), 'dist/bin/convoai.js');

function cli(args: string): string {
  try {
    return execSync(`node ${CLI} ${args}`, { encoding: 'utf-8', timeout: 10000 });
  } catch (err: any) {
    return err.stdout || err.stderr || '';
  }
}

describe('convoai update', () => {
  it('shows help with --help', () => {
    const output = cli('update --help');
    expect(output).toContain('--force');
    expect(output).toContain('--check');
    expect(output).toContain('--json');
  });

  it('appears in top-level help', () => {
    const output = cli('--help');
    expect(output).toContain('update');
  });
});

describe('isGloballyInstalled', () => {
  it('returns boolean', async () => {
    const { isGloballyInstalled } = await import('../../src/commands/update.js');
    const result = isGloballyInstalled();
    expect(typeof result).toBe('boolean');
  });
});
