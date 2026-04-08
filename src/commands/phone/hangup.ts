import { Command } from 'commander';
import { getCallAPI } from './_helpers.js';
import { printSuccess } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneHangup(phone: Command): void {
  phone
    .command('hangup <agent-id>')
    .description('End an active call')
    .option('--profile <name>', 'Config profile')
    .action(async (agentId, opts) => {
      try {
        const api = getCallAPI(opts.profile);
        await api.hangup(agentId);
        printSuccess('Call ended');
      } catch (error) {
        handleError(error);
      }
    });
}
