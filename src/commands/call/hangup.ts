import { Command } from 'commander';
import chalk from 'chalk';
import { getCallAPI } from '../phone/_helpers.js';
import { printSuccess } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';

export function registerCallHangup(program: Command): void {
  program
    .command('hangup <agent-id>')
    .description('(deprecated) Use "phone hangup" instead')
    .option('--profile <name>', 'Config profile')
    .action(async (agentId: string, opts) => {
      console.log(chalk.yellow('  ⚠ "call hangup" is deprecated. Use "convoai phone hangup" instead.'));
      try {
        const api = getCallAPI(opts.profile);
        await api.hangup(agentId);
        printSuccess('Call ended');
      } catch (error) {
        handleError(error);
      }
    });
}
