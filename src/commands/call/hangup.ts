import { Command } from 'commander';
import chalk from 'chalk';

export function registerCallHangup(program: Command): void {
  program
    .command('hangup <agent-id>')
    .description('(deprecated) Use "phone hangup" instead')
    .option('--profile <name>', 'Config profile')
    .action(async (agentId: string) => {
      console.log(chalk.yellow('\n  ⚠ "call hangup" is deprecated. Use "convoai phone hangup" instead.\n'));
      console.log(chalk.dim(`  Example: convoai phone hangup ${agentId}\n`));
    });
}
