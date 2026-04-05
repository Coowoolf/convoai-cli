import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, execSync } from 'node:child_process';
import chalk from 'chalk';

function readPortFromEnv(cwd: string): number {
  try {
    const envPath = join(cwd, '.env');
    if (!existsSync(envPath)) return 3000;
    const content = readFileSync(envPath, 'utf-8');
    const match = content.match(/^PORT=(\d+)/m);
    return match ? parseInt(match[1], 10) : 3000;
  } catch { return 3000; }
}

export function registerDev(program: Command): void {
  program
    .command('dev')
    .description('Start the ConvoAI starter dev server')
    .action(async () => {
      const cwd = process.cwd();
      const pkgPath = join(cwd, 'package.json');

      // 1. Check for package.json with convoai-starter marker
      if (!existsSync(pkgPath)) {
        console.error(chalk.red('\n  Error: No package.json found in current directory.'));
        console.error(chalk.dim('  This is not a ConvoAI starter project.'));
        console.error(chalk.dim('  Run: convoai init <name>\n'));
        process.exit(1);
      }

      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (!pkg['convoai-starter']) {
          console.error(chalk.red('\n  Error: This is not a ConvoAI starter project.'));
          console.error(chalk.dim('  Run: convoai init <name>\n'));
          process.exit(1);
        }
      } catch {
        console.error(chalk.red('\n  Error: Invalid package.json.\n'));
        process.exit(1);
      }

      // 2. Check node_modules exists
      if (!existsSync(join(cwd, 'node_modules'))) {
        console.error(chalk.red('\n  Error: Dependencies not installed.'));
        console.error(chalk.cyan('  Run: npm install\n'));
        process.exit(1);
      }

      // 3. Check if configured port is in use
      const port = readPortFromEnv(cwd);
      try {
        const pids = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' }).trim();
        if (pids) {
          console.error(chalk.yellow(`\n  Port ${port} is already in use.`));
          console.error(chalk.dim('  Stop the other process first, or change PORT in .env\n'));
          process.exit(1);
        }
      } catch { /* no process on port */ }

      // 4. Delegate to npm run dev (shell:true for Windows npm.cmd compat)
      const isWindows = process.platform === 'win32';
      const child = spawn('npm', ['run', 'dev'], {
        stdio: 'inherit',
        cwd,
        shell: isWindows,
      });

      child.on('close', (code) => {
        process.exit(code ?? 0);
      });
    });
}
