import { Command } from 'commander';
import { getNumberAPI } from './_helpers.js';
import { printKeyValue } from '../../ui/table.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneGet(phone: Command): void {
  phone
    .command('number <phone-number>')
    .description('View phone number details')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (phoneNumber, opts) => {
      try {
        const api = getNumberAPI(opts.profile);
        const num = await api.get(phoneNumber);

        if (opts.json) {
          console.log(JSON.stringify(num, null, 2));
          return;
        }

        console.log('');
        printKeyValue([
          ['Phone', num.phone_number],
          ['Label', num.label],
          ['Provider', num.provider],
          ['Outbound', num.outbound ? 'yes' : 'no'],
          ['Inbound', num.inbound ? 'yes' : 'no'],
          ['SIP', num.outbound_config ? `${num.outbound_config.address} (${num.outbound_config.transport})` : '-'],
          ['Pipeline', num.associated_pipeline?.pipeline_name ?? '(none)'],
        ]);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
