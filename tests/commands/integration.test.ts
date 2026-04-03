import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const CLI = join(process.cwd(), 'dist/bin/convoai.js');

function cli(args: string): string {
  try {
    return execSync(`node ${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
      env: { ...process.env, NO_COLOR: '1' },
    });
  } catch (err: any) {
    return err.stdout || err.stderr || '';
  }
}

// Read version from package.json for comparison
function getPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
  return pkg.version;
}

describe('CLI extended integration tests', () => {

  // ── Version ──────────────────────────────────────────────────────────────

  describe('--version', () => {
    it('returns the correct version from package.json', () => {
      const output = cli('--version').trim();
      expect(output).toBe(getPackageVersion());
    });

    it('also works with -v flag', () => {
      const output = cli('-v').trim();
      expect(output).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  // ── Top-level help: new commands visible ──────────────────────────────────

  describe('convoai --help includes all commands', () => {
    it('shows go command', () => {
      const output = cli('--help');
      expect(output).toContain('go');
    });

    it('shows quickstart command', () => {
      const output = cli('--help');
      expect(output).toContain('quickstart');
    });

    it('shows token command', () => {
      const output = cli('--help');
      expect(output).toContain('token');
    });

    it('shows call command', () => {
      const output = cli('--help');
      expect(output).toContain('call');
    });

    it('shows agent command', () => {
      const output = cli('--help');
      expect(output).toContain('agent');
    });

    it('shows config command', () => {
      const output = cli('--help');
      expect(output).toContain('config');
    });

    it('shows preset command', () => {
      const output = cli('--help');
      expect(output).toContain('preset');
    });

    it('shows template command', () => {
      const output = cli('--help');
      expect(output).toContain('template');
    });

    it('shows completion command', () => {
      const output = cli('--help');
      expect(output).toContain('completion');
    });
  });

  // ── convoai go --help ──────────────────────────────────────────────────────

  describe('convoai go --help', () => {
    it('shows --channel flag', () => {
      const output = cli('go --help');
      expect(output).toContain('--channel');
      expect(output).toContain('-c');
    });

    it('shows --setup flag', () => {
      const output = cli('go --help');
      expect(output).toContain('--setup');
    });

    it('shows --model flag', () => {
      const output = cli('go --help');
      expect(output).toContain('--model');
    });

    it('shows --tts flag', () => {
      const output = cli('go --help');
      expect(output).toContain('--tts');
    });

    it('shows --asr flag', () => {
      const output = cli('go --help');
      expect(output).toContain('--asr');
    });

    it('shows --browser flag', () => {
      const output = cli('go --help');
      expect(output).toContain('--browser');
    });

    it('shows --profile flag', () => {
      const output = cli('go --help');
      expect(output).toContain('--profile');
    });
  });

  // ── convoai token --help ──────────────────────────────────────────────────

  describe('convoai token --help', () => {
    it('shows --channel flag', () => {
      const output = cli('token --help');
      expect(output).toContain('--channel');
      expect(output).toContain('-c');
    });

    it('shows --uid flag', () => {
      const output = cli('token --help');
      expect(output).toContain('--uid');
    });

    it('shows --expire flag', () => {
      const output = cli('token --help');
      expect(output).toContain('--expire');
    });

    it('shows --certificate flag', () => {
      const output = cli('token --help');
      expect(output).toContain('--certificate');
    });

    it('shows --json flag', () => {
      const output = cli('token --help');
      expect(output).toContain('--json');
    });

    it('shows --profile flag', () => {
      const output = cli('token --help');
      expect(output).toContain('--profile');
    });

    it('shows description about RTC token', () => {
      const output = cli('token --help');
      expect(output.toLowerCase()).toContain('token');
    });
  });

  // ── convoai quickstart --help ─────────────────────────────────────────────

  describe('convoai quickstart --help', () => {
    it('works and shows description', () => {
      const output = cli('quickstart --help');
      expect(output.toLowerCase()).toContain('quickstart');
    });

    it('also accessible via qs alias', () => {
      const output = cli('qs --help');
      expect(output).toBeTruthy();
      // Should show the same help as quickstart
      expect(output.toLowerCase()).toContain('quickstart') ;
    });
  });

  // ── agent subcommands include new ones ────────────────────────────────────

  describe('convoai agent --help includes new subcommands', () => {
    it('includes join subcommand', () => {
      const output = cli('agent --help');
      expect(output).toContain('join');
    });

    it('includes history subcommand', () => {
      const output = cli('agent --help');
      expect(output).toContain('history');
    });

    it('includes turns subcommand', () => {
      const output = cli('agent --help');
      expect(output).toContain('turns');
    });
  });

  // ── Error cases ──────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('shows error for unknown command', () => {
      const output = cli('nonexistent');
      expect(output).toBeTruthy();
    });

    it('shows error for token without required --channel', () => {
      const output = cli('token');
      expect(output).toContain('channel');
    });
  });
});
