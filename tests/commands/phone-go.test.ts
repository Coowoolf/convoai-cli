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

describe('convoai phone go', () => {
  it('shows in phone help', () => {
    const output = cli('phone --help');
    expect(output).toContain('go');
  });

  it('shows help with --help', () => {
    const output = cli('phone go --help');
    expect(output).toContain('--mode');
    expect(output).toContain('--to');
    expect(output).toContain('--from');
    expect(output).toContain('--lang');
    expect(output).toContain('--task');
    expect(output).toContain('--task-lang');
    expect(output).toContain('--no-dashboard');
    expect(output).toContain('--json');
    expect(output).toContain('--dry-run');
  });

  it('dry-run with translate mode does not error on unknown flags', () => {
    const output = cli(
      'phone go --mode translate --lang zh:ja --to +81312345678 --from +15551234567 --dry-run --no-dashboard'
    );
    expect(output).not.toContain('unknown option');
  });
});
