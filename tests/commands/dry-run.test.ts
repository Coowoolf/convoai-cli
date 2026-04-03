import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const CLI = join(process.cwd(), 'dist/bin/convoai.js');

// Set up a temp config for testing
const TEMP_CONFIG_DIR = join(tmpdir(), `convoai-dry-run-test-${Date.now()}`);
const TEMP_CONFIG = join(TEMP_CONFIG_DIR, 'config.json');

function cli(args: string, env?: Record<string, string>): string {
  try {
    return execSync(`node ${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
      env: {
        ...process.env,
        XDG_CONFIG_HOME: TEMP_CONFIG_DIR.replace('/convoai', ''),
        ...env,
      },
    });
  } catch (err: any) {
    return (err.stdout || '') + (err.stderr || '');
  }
}

describe('Dry Run Tests', () => {
  beforeEach(() => {
    mkdirSync(join(TEMP_CONFIG_DIR, 'convoai'), { recursive: true });
    writeFileSync(
      join(TEMP_CONFIG_DIR, 'convoai', 'config.json'),
      JSON.stringify({
        app_id: 'test-app-id',
        customer_id: 'test-customer-id',
        customer_secret: 'test-customer-secret',
      }),
    );
  });

  afterEach(() => {
    rmSync(TEMP_CONFIG_DIR, { recursive: true, force: true });
  });

  it('agent start --dry-run shows request without sending', () => {
    const output = cli(
      'agent start --channel test-ch --model gpt-4o-mini --system-message "Hello" --dry-run',
    );
    // Should show the request JSON without making an API call
    expect(output).toContain('test-ch');
  });

  it('agent start --help shows all options', () => {
    const output = cli('agent start --help');
    expect(output).toContain('--channel');
    expect(output).toContain('--preset');
    expect(output).toContain('--model');
    expect(output).toContain('--tts');
    expect(output).toContain('--asr');
    expect(output).toContain('--system-message');
    expect(output).toContain('--greeting');
    expect(output).toContain('--uid');
    expect(output).toContain('--idle-timeout');
    expect(output).toContain('--json');
    expect(output).toContain('--dry-run');
  });
});

describe('Auth Commands Help', () => {
  it('auth login --help shows all options', () => {
    const output = cli('auth login --help');
    expect(output).toContain('--app-id');
    expect(output).toContain('--customer-id');
    expect(output).toContain('--customer-secret');
    expect(output).toContain('--profile');
  });

  it('auth status --help shows options', () => {
    const output = cli('auth status --help');
    expect(output).toContain('--profile');
    expect(output).toContain('--json');
  });

  it('auth logout --help shows options', () => {
    const output = cli('auth logout --help');
    expect(output).toContain('--profile');
    expect(output).toContain('--force');
  });
});

describe('Config Commands', () => {
  it('config set --help shows key value args', () => {
    const output = cli('config set --help');
    expect(output).toContain('key');
    expect(output).toContain('value');
  });

  it('config get --help shows key arg', () => {
    const output = cli('config get --help');
    expect(output).toContain('key');
  });

  it('config init --help exists', () => {
    const output = cli('config init --help');
    expect(output).toContain('init');
  });

  it('config show --help shows options', () => {
    const output = cli('config show --help');
    expect(output).toContain('--json');
  });

  it('config path --help exists', () => {
    const output = cli('config path --help');
    expect(output).toContain('path');
  });
});

describe('Agent Subcommand Help', () => {
  const subcommands = [
    'stop',
    'status',
    'list',
    'update',
    'speak',
    'interrupt',
    'history',
    'turns',
  ];

  for (const cmd of subcommands) {
    it(`agent ${cmd} --help works`, () => {
      const output = cli(`agent ${cmd} --help`);
      expect(output).toContain(cmd);
      expect(output.length).toBeGreaterThan(10);
    });
  }
});

describe('Template Commands Help', () => {
  const subcommands = ['save', 'list', 'show', 'delete', 'use'];

  for (const cmd of subcommands) {
    it(`template ${cmd} --help works`, () => {
      const output = cli(`template ${cmd} --help`);
      expect(output).toContain(cmd);
    });
  }
});

describe('Preset Commands Help', () => {
  it('preset list --help works', () => {
    const output = cli('preset list --help');
    expect(output).toContain('list');
  });

  it('preset use --help works', () => {
    const output = cli('preset use --help');
    expect(output).toContain('use');
  });
});
