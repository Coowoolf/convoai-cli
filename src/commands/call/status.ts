import { Command } from 'commander';
import chalk from 'chalk';

export function registerCallStatus(program: Command): void {
  program
    .command('status <agent-id>')
    .description('(deprecated) Use "phone status" instead')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (agentId: string) => {
      console.log(chalk.yellow('\n  ⚠ "call status" is deprecated. Use "convoai phone status" instead.\n'));
      console.log(chalk.dim(`  Example: convoai phone status ${agentId}\n`));
    });
}
