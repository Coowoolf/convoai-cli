import { Command } from 'commander';
import { getCallAPI } from './_helpers.js';
import { withSpinner } from '../../ui/spinner.js';
import { printSuccess, printError, printHint } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';
import { shortId } from '../../utils/hints.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerCallHangup(program: Command): void {
  program
    .command('hangup <agent-id>')
    .description('Hang up an active call')
    .option('--profile <name>', 'Config profile to use')
    .option('--json', 'Output result as JSON')
    .action(async (agentId: string, opts) => {
      try {
        const api = getCallAPI(opts.profile);
        await withSpinner(`Hanging up call ${shortId(agentId)}...`, () =>
          api.hangup(agentId),
        );

        if (opts.json) {
          console.log(JSON.stringify({ agent_id: agentId, status: 'HUNG_UP' }, null, 2));
          return;
        }

        printSuccess(`Call ${shortId(agentId)} hung up.`);
        printHint('Run `convoai call initiate --phone <number>` to start a new call.');
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
