import { Command } from 'commander';
import { getCallAPI, formatTimestamp, formatDuration } from './_helpers.js';
import { withSpinner } from '../../ui/spinner.js';
import { printKeyValue } from '../../ui/table.js';
import { handleError } from '../../utils/errors.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerCallStatus(program: Command): void {
  program
    .command('status <agent-id>')
    .description('Get the status of a call')
    .option('--profile <name>', 'Config profile to use')
    .option('--json', 'Output result as JSON')
    .action(async (agentId: string, opts) => {
      try {
        const api = getCallAPI(opts.profile);

        const result = await withSpinner('Fetching call status...', () =>
          api.status(agentId),
        );

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        const pairs: Array<[string, string]> = [
          ['Agent ID', result.agent_id],
          ['Status', result.status],
          ['Direction', result.direction],
        ];

        if (result.phone_number) {
          pairs.push(['Phone', result.phone_number]);
        }

        pairs.push(['Started', formatTimestamp(result.start_ts)]);

        if (result.end_ts) {
          pairs.push(['Ended', formatTimestamp(result.end_ts)]);
          const duration = result.end_ts - result.start_ts;
          if (duration >= 0) {
            pairs.push(['Duration', formatDuration(duration)]);
          }
        } else {
          // Call is still active — show elapsed time
          const elapsed = Math.floor(Date.now() / 1000) - result.start_ts;
          if (elapsed >= 0) {
            pairs.push(['Elapsed', formatDuration(elapsed)]);
          }
        }

        printKeyValue(pairs);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
