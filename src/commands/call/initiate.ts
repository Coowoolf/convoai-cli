import { Command } from 'commander';
import chalk from 'chalk';

export function registerCallInitiate(program: Command): void {
  program
    .command('initiate')
    .description('(deprecated) Use "phone send" instead')
    .option('--phone <number>', 'Phone number')
    .option('--channel <name>', 'Channel name')
    .option('--model <model>', 'LLM model')
    .option('--system-message <msg>', 'System prompt')
    .option('--greeting <msg>', 'Greeting message')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .option('--dry-run', 'Dry run')
    .action(async () => {
      console.log(chalk.yellow('\n  ⚠ "call initiate" is deprecated. Use "convoai phone send" instead.\n'));
      console.log(chalk.dim('  Example: convoai phone send --to +15551234567 --task "Ask about demo"\n'));
    });
}
