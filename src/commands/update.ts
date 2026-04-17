import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchLatestVersion, isNewer } from '../utils/update-check.js';
import { printSuccess, printError, printHint } from '../ui/output.js';
import { handleError } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function isGloballyInstalled(): boolean {
  try {
    const output = execSync('npm ls -g convoai --json --depth=0', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const data = JSON.parse(output);
    return !!(data?.dependencies?.convoai);
  } catch {
    return false;
  }
}

function getCurrentVersion(): string {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
      if (pkg.name === 'convoai') return pkg.version ?? '0.0.0';
    } catch { /* keep searching */ }
    dir = dirname(dir);
  }
  return '0.0.0';
}

async function updateAction(opts: {
  force?: boolean;
  check?: boolean;
  json?: boolean;
}): Promise<void> {
  const current = getCurrentVersion();

  if (!opts.json) {
    console.log('');
    console.log(`  ${chalk.dim('Current:')} v${current}`);
    console.log(`  ${chalk.dim('Checking npm registry...')}`);
  }

  const latest = await fetchLatestVersion();

  if (!latest) {
    if (opts.json) {
      console.log(JSON.stringify({ error: 'Failed to check npm registry' }));
    } else {
      printError('Failed to check npm registry. Check your connection.');
    }
    process.exit(1);
  }

  if (!opts.json) {
    console.log(`  ${chalk.dim('Latest:  ')} v${latest}`);
    console.log('');
  }

  const upToDate = latest === current || !isNewer(latest, current);

  if (upToDate) {
    if (opts.json) {
      console.log(JSON.stringify({ current, latest, updated: false, upToDate: true }));
    } else {
      printSuccess(`Already at latest version (v${current})`);
    }
    return;
  }

  if (opts.check) {
    if (opts.json) {
      console.log(JSON.stringify({ current, latest, updated: false, upToDate: false }));
    } else {
      console.log(chalk.yellow(`  Update available: v${current} → v${latest}`));
      printHint('Run: convoai update');
    }
    return;
  }

  if (!isGloballyInstalled()) {
    if (opts.json) {
      console.log(JSON.stringify({ error: 'not globally installed', current, latest }));
    } else {
      printError('convoai does not appear to be installed globally.');
      printHint('Run: npm install -g convoai@latest');
    }
    process.exit(1);
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
      message: `Update to v${latest}?`,
      default: true,
    }]);
    if (!confirm) {
      console.log(chalk.dim('  Cancelled.'));
      return;
    }
  }

  if (!opts.json) {
    console.log('');
    console.log(chalk.dim('  Running: npm install -g convoai@latest'));
    console.log('');
  }

  try {
    execSync('npm install -g convoai@latest', {
      stdio: opts.json ? 'pipe' : 'inherit',
      timeout: 120_000,
    });
  } catch (err: any) {
    if (opts.json) {
      console.log(JSON.stringify({ error: 'npm install failed', current, latest }));
    } else {
      printError('npm install failed. See output above.');
    }
    process.exit(err.status ?? 1);
  }

  if (opts.json) {
    console.log(JSON.stringify({ current, latest, updated: true }));
  } else {
    console.log('');
    printSuccess(`Updated to v${latest}`);
  }
}

export function registerUpdate(program: Command): void {
  program
    .command('update')
    .description('Check and install the latest version of convoai')
    .option('--force', 'Skip confirmation prompt')
    .option('--check', 'Only check for updates, do not install')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      try {
        await updateAction(opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
