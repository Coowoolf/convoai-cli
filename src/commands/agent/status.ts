import { Command } from 'commander';
import { getAgentAPI, formatTimestamp } from './_helpers.js';
import { withSpinner } from '../../ui/spinner.js';
import { printKeyValue } from '../../ui/table.js';
import { colorStatus } from '../../ui/colors.js';
import { handleError } from '../../utils/errors.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAgentStatus(program: Command): void {
  program
    .command('status <agent-id>')
    .description('Query the status of an agent')
    .option('--profile <name>', 'Config profile to use')
    .option('--json', 'Output result as JSON')
    .action(async (agentId: string, opts) => {
      try {
        const api = getAgentAPI(opts.profile);

        const result = await withSpinner('Fetching agent status...', () =>
          api.status(agentId),
        );

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        const pairs: Array<[string, string]> = [
          ['Agent ID', result.agent_id],
          ['Status', colorStatus(result.status)],
        ];

        if (result.channel) {
          pairs.push(['Channel', result.channel]);
        }

        pairs.push(['Started', formatTimestamp(result.start_ts)]);

        if (result.stop_ts) {
          pairs.push(['Stopped', formatTimestamp(result.stop_ts)]);
        }

        if (result.message) {
          pairs.push(['Message', result.message]);
        }

        printKeyValue(pairs);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
