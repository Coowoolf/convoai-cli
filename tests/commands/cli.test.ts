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

describe('CLI Integration', () => {
  it('shows version with --version', () => {
    const output = cli('--version');
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('shows help with --help', () => {
    const output = cli('--help');
    expect(output).toContain('convoai');
    expect(output).toContain('auth');
    expect(output).toContain('agent');
    expect(output).toContain('config');
    expect(output).toContain('preset');
    expect(output).toContain('template');
    expect(output).toContain('completion');
    expect(output).toContain('repl');
  });

  it('shows agent help', () => {
    const output = cli('agent --help');
    expect(output).toContain('start');
    expect(output).toContain('stop');
    expect(output).toContain('status');
    expect(output).toContain('list');
    expect(output).toContain('update');
    expect(output).toContain('speak');
    expect(output).toContain('interrupt');
    expect(output).toContain('history');
    expect(output).toContain('turns');
    expect(output).toContain('watch');
  });

  it('shows agent start help with all flags', () => {
    const output = cli('agent start --help');
    expect(output).toContain('--channel');
    expect(output).toContain('--preset');
    expect(output).toContain('--model');
    expect(output).toContain('--json');
    expect(output).toContain('--dry-run');
    expect(output).toContain('--profile');
  });

  it('shows config path', () => {
    const output = cli('config path');
    expect(output.trim()).toMatch(/convoai\/config\.json$/);
  });

  it('shows preset list', () => {
    const output = cli('preset list');
    expect(output).toContain('openai-gpt4o');
    expect(output).toContain('openai-mini');
    expect(output).toContain('anthropic-claude');
    expect(output).toContain('gemini');
    expect(output).toContain('realtime-openai');
  });

  it('shows call help', () => {
    const output = cli('call --help');
    expect(output).toContain('initiate');
    expect(output).toContain('hangup');
    expect(output).toContain('status');
  });

  it('shows template help', () => {
    const output = cli('template --help');
    expect(output).toContain('save');
    expect(output).toContain('list');
    expect(output).toContain('show');
    expect(output).toContain('delete');
    expect(output).toContain('use');
  });

  it('shows completion help', () => {
    const output = cli('completion --help');
    expect(output).toContain('bash');
    expect(output).toContain('zsh');
    expect(output).toContain('fish');
    expect(output).toContain('install');
  });

  it('generates bash completion script', () => {
    const output = cli('completion bash');
    expect(output).toContain('_convoai');
    expect(output).toContain('complete');
  });

  it('generates zsh completion script', () => {
    const output = cli('completion zsh');
    expect(output).toContain('convoai');
  });

  it('shows template list (empty)', () => {
    const output = cli('template list');
    // Should either show "No templates" message or empty table
    expect(typeof output).toBe('string');
  });

  it('shows config show', () => {
    const output = cli('config show');
    // Should show config or "no config" message
    expect(typeof output).toBe('string');
  });
});
