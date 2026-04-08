import { Command } from 'commander';
import { getCallAPI } from './_helpers.js';
import { printKeyValue } from '../../ui/table.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneStatus(phone: Command): void {
  phone
    .command('status <agent-id>')
    .description('Check call status')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (agentId, opts) => {
      try {
        const api = getCallAPI(opts.profile);
        const status = await api.status(agentId);

        if (opts.json) {
          console.log(JSON.stringify(status, null, 2));
          return;
        }

        const duration = status.stop_ts
          ? `${Math.floor((status.stop_ts - status.start_ts) / 60)}:${String((status.stop_ts - status.start_ts) % 60).padStart(2, '0')}`
          : `${Math.floor((Math.floor(Date.now() / 1000) - status.start_ts) / 60)}:${String((Math.floor(Date.now() / 1000) - status.start_ts) % 60).padStart(2, '0')}`;

        console.log('');
        printKeyValue([
          ['Agent ID', status.agent_id],
          ['Status', status.status],
          ['Duration', duration],
          ['Channel', status.channel ?? '-'],
        ]);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
