import { Command } from 'commander';
import chalk from 'chalk';
import { getCallAPI } from '../phone/_helpers.js';
import { printKeyValue } from '../../ui/table.js';
import { handleError } from '../../utils/errors.js';

export function registerCallStatus(program: Command): void {
  program
    .command('status <agent-id>')
    .description('(deprecated) Use "phone status" instead')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (agentId: string, opts) => {
      console.log(chalk.yellow('  ⚠ "call status" is deprecated. Use "convoai phone status" instead.'));
      try {
        const api = getCallAPI(opts.profile);
        const status = await api.status(agentId);
        if (opts.json) { console.log(JSON.stringify(status, null, 2)); return; }
        console.log('');
        printKeyValue([
          ['Agent ID', status.agent_id],
          ['Status', status.status],
          ['Channel', status.channel ?? '-'],
        ]);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
