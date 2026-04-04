import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import chalk from 'chalk';

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

      // 3. Delegate to npm run dev
      const child = spawn('npm', ['run', 'dev'], {
        stdio: 'inherit',
        cwd,
        shell: true,
      });

      child.on('close', (code) => {
        process.exit(code ?? 0);
      });
    });
}
