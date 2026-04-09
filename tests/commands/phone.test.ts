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

describe('convoai phone', () => {
  it('shows phone help', () => {
    const output = cli('phone --help');
    expect(output).toContain('send');
    expect(output).toContain('numbers');
    expect(output).toContain('import');
    expect(output).toContain('hangup');
    expect(output).toContain('status');
    expect(output).toContain('history');
  });

  it('phone send shows help with --help', () => {
    const output = cli('phone send --help');
    expect(output).toContain('--from');
    expect(output).toContain('--to');
    expect(output).toContain('--task');
    expect(output).toContain('--wait');
  });

  it('phone import shows help with --help', () => {
    const output = cli('phone import --help');
    expect(output).toContain('--number');
    expect(output).toContain('--provider');
    expect(output).toContain('--sip-address');
  });

  it('phone numbers shows help with --help', () => {
    const output = cli('phone numbers --help');
    expect(output).toContain('--json');
  });

  it('phone remove shows help with --help', () => {
    const output = cli('phone remove --help');
    expect(output).toContain('--force');
  });

  it('help text includes Phone group', () => {
    const output = cli('--help');
    expect(output).toContain('Phone:');
    expect(output).toContain('phone send');
    expect(output).toContain('phone numbers');
  });

  it('go --call shows in help', () => {
    const output = cli('go --help');
    expect(output).toContain('--call');
  });

  it('deprecated call initiate still works', () => {
    const output = cli('call initiate --help');
    expect(output.toLowerCase()).not.toContain('unknown command');
  });

  it('deprecated call shows deprecation hint', () => {
    const output = cli('call initiate');
    expect(output).toContain('deprecated');
  });

  it('phone go shows in phone help', () => {
    const output = cli('phone --help');
    expect(output).toContain('go');
  });

  it('phone go shows help with --help', () => {
    const output = cli('phone go --help');
    expect(output).toContain('--mode');
    expect(output).toContain('--lang');
    expect(output).toContain('--task');
    expect(output).toContain('--no-dashboard');
  });
});

describe('E.164 validation', () => {
  it('accepts valid E.164 numbers', async () => {
    const { isE164 } = await import('../../src/commands/phone/_helpers.js');
    expect(isE164('+15551234567')).toBe(true);
    expect(isE164('+8613800138000')).toBe(true);
    expect(isE164('+442071234567')).toBe(true);
  });

  it('rejects invalid numbers', async () => {
    const { isE164 } = await import('../../src/commands/phone/_helpers.js');
    expect(isE164('15551234567')).toBe(false);
    expect(isE164('+0551234567')).toBe(false);
    expect(isE164('hello')).toBe(false);
    expect(isE164('')).toBe(false);
  });
});
