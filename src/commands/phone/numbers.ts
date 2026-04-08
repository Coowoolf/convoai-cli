import { Command } from 'commander';
import chalk from 'chalk';
import { getNumberAPI } from './_helpers.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneNumbers(phone: Command): void {
  phone
    .command('numbers')
    .description('List imported phone numbers')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      try {
        const api = getNumberAPI(opts.profile);
        const numbers = await api.list();

        if (opts.json) {
          console.log(JSON.stringify(numbers, null, 2));
          return;
        }

        if (numbers.length === 0) {
          console.log(chalk.dim('\n  No phone numbers. Run: convoai phone import\n'));
          return;
        }

        console.log('');
        for (const n of numbers) {
          const dir = [n.outbound && 'outbound', n.inbound && 'inbound'].filter(Boolean).join('+');
          console.log(`  ${chalk.cyan(n.phone_number)}  ${chalk.dim(dir)}  ${n.label}  ${chalk.dim(n.provider)}`);
        }
        console.log('');
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
