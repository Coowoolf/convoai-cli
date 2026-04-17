import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, statSync, rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getConfigDir, getProjectConfigPath } from '../config/paths.js';
import { printSuccess, printError, printHint } from '../ui/output.js';
import { handleError } from '../utils/errors.js';

export interface ScanEntry {
  path: string;
  size: number;
  type: 'file' | 'dir';
}

/** Format a byte count as a human-readable string. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Recursively compute the total size of a directory. */
function dirSize(dir: string): number {
  let total = 0;
  try {
    const entries = readdirSync(dir);
    for (const name of entries) {
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        total += dirSize(full);
      } else {
        total += stat.size;
      }
    }
  } catch { /* ignore */ }
  return total;
}

/**
 * Scan a directory (depth 1) and return entries for each file and subdirectory.
 * Files get their byte size; directories get their recursive total size.
 */
export function scanDirectory(dir: string): ScanEntry[] {
  if (!existsSync(dir)) return [];
  const entries: ScanEntry[] = [];
  try {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        entries.push({ path: full, size: dirSize(full), type: 'dir' });
      } else {
        entries.push({ path: full, size: stat.size, type: 'file' });
      }
    }
  } catch { /* ignore */ }
  return entries;
}

function deleteEntry(entry: ScanEntry): { ok: true } | { ok: false; error: string } {
  try {
    if (entry.type === 'dir') {
      rmSync(entry.path, { recursive: true, force: true });
    } else {
      unlinkSync(entry.path);
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }
}

function displayPath(fullPath: string): string {
  const home = homedir();
  if (fullPath.startsWith(home)) {
    return '~' + fullPath.slice(home.length);
  }
  return fullPath;
}

async function clearAction(opts: {
  force?: boolean;
  globalOnly?: boolean;
  json?: boolean;
}): Promise<void> {
  const globalDir = getConfigDir();
  const globalEntries = scanDirectory(globalDir);

  const projectEntries: ScanEntry[] = [];
  if (!opts.globalOnly) {
    const projectPath = getProjectConfigPath();
    if (existsSync(projectPath)) {
      try {
        const stat = statSync(projectPath);
        projectEntries.push({ path: projectPath, size: stat.size, type: 'file' });
      } catch { /* ignore */ }
    }
  }

  const allEntries = [...globalEntries, ...projectEntries];

  if (allEntries.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ cleared: [], errors: [], cancelled: false }));
    } else {
      console.log('');
      console.log(chalk.dim('  Nothing to clear — config directory is empty.'));
      console.log('');
    }
    return;
  }

  if (!opts.json) {
    console.log('');
    console.log(chalk.yellow('  ⚠  This will delete the following:'));
    console.log('');

    if (globalEntries.length > 0) {
      console.log(chalk.bold('  Global config:'));
      for (const entry of globalEntries) {
        const display = displayPath(entry.path);
        const size = entry.type === 'dir' && entry.size === 0
          ? '(empty)'
          : `(${formatSize(entry.size)})`;
        console.log(`    ${display}${entry.type === 'dir' ? '/' : ''}    ${chalk.dim(size)}`);
      }
      console.log('');
    }

    if (!opts.globalOnly) {
      console.log(chalk.bold('  Project config:'));
      if (projectEntries.length > 0) {
        for (const entry of projectEntries) {
          console.log(`    ./${entry.path.split('/').pop()}    ${chalk.dim(`(${formatSize(entry.size)})`)}`);
        }
      } else {
        console.log(chalk.dim('    ./.convoai.json    (not found, skipping)'));
      }
      console.log('');
    }
  }

  if (!opts.force && !opts.json) {
    if (!process.stdin.isTTY) {
      printError('Cannot prompt in non-TTY mode. Use --force to proceed.');
      process.exit(1);
    }
    const { safePrompt } = await import('../ui/prompt.js');
    const { confirm } = await safePrompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure?',
      default: false,
    }]);
    if (!confirm) {
      console.log(chalk.dim('  Cancelled.'));
      return;
    }
  } else if (!opts.force && opts.json) {
    console.log(JSON.stringify({ error: '--force required in JSON mode', cleared: [], errors: [], cancelled: true }));
    process.exit(1);
  }

  const cleared: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  for (const entry of allEntries) {
    const result = deleteEntry(entry);
    if (result.ok) {
      cleared.push(entry.path);
      if (!opts.json) {
        printSuccess(`Removed ${displayPath(entry.path)}`);
      }
    } else {
      errors.push({ path: entry.path, error: result.error });
      if (!opts.json) {
        printError(`Failed: ${displayPath(entry.path)} — ${result.error}`);
      }
    }
  }

  if (opts.json) {
    console.log(JSON.stringify({ cleared, errors, cancelled: false }));
  } else {
    console.log('');
    if (errors.length === 0) {
      printSuccess('Done.');
      printHint('Run `convoai quickstart` to set up again.');
    } else {
      printError(`Completed with ${errors.length} error(s).`);
    }
  }
}

export function registerClear(program: Command): void {
  program
    .command('clear')
    .description('Remove all local configuration (global and project)')
    .option('--force', 'Skip confirmation')
    .option('--global-only', 'Only clear global config, skip project')
    .option('--json', 'JSON output (requires --force for destructive ops)')
    .action(async (opts) => {
      try {
        await clearAction(opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
