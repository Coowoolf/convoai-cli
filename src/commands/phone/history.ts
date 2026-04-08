import { Command } from 'commander';
import chalk from 'chalk';
import { getCallAPI } from './_helpers.js';
import { handleError } from '../../utils/errors.js';

function timeSince(ts: number): string {
  const sec = Math.floor(Date.now() / 1000) - ts;
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  return `${Math.floor(sec / 86400)} days ago`;
}

export function registerPhoneHistory(phone: Command): void {
  phone
    .command('history')
    .description('List recent calls')
    .option('--limit <n>', 'Max results', '20')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      try {
        const api = getCallAPI(opts.profile);
        const result = await api.list({ limit: parseInt(opts.limit, 10) || 20 });
        const list = result.data?.list ?? [];

        if (opts.json) {
          console.log(JSON.stringify(list, null, 2));
          return;
        }

        if (list.length === 0) {
          console.log(chalk.dim('\n  No recent calls.\n'));
          return;
        }

        console.log('');
        for (const call of list) {
          const id = call.agent_id.slice(0, 12);
          const status = call.status === 'STOPPED' ? chalk.dim('completed') :
                         call.status === 'RUNNING' ? chalk.green('active') :
                         call.status === 'FAILED' ? chalk.red('failed') :
                         chalk.dim(call.status);
          const ago = call.start_ts ? timeSince(call.start_ts) : '';
          console.log(`  ${chalk.cyan(id)}  ${status}  ${chalk.dim(ago)}`);
        }
        console.log('');
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
