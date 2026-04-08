import { Command } from 'commander';
import { getNumberAPI } from './_helpers.js';
import { printSuccess } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneUpdate(phone: Command): void {
  phone
    .command('update <phone-number>')
    .description('Update phone number configuration')
    .option('--label <label>', 'New label')
    .option('--sip-address <address>', 'New SIP address')
    .option('--sip-transport <transport>', 'New transport (tls/tcp/udp)')
    .option('--sip-user <user>', 'New SIP username')
    .option('--sip-password <password>', 'New SIP password')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (phoneNumber, opts) => {
      try {
        const api = getNumberAPI(opts.profile);
        const req: Record<string, unknown> = {};

        if (opts.label) req.label = opts.label;

        if (opts.sipAddress || opts.sipTransport || opts.sipUser || opts.sipPassword) {
          req.outbound_config = {
            ...(opts.sipAddress && { address: opts.sipAddress }),
            ...(opts.sipTransport && { transport: opts.sipTransport }),
            ...(opts.sipUser && { user: opts.sipUser }),
            ...(opts.sipPassword && { password: opts.sipPassword }),
          };
        }

        const result = await api.update(phoneNumber, req);

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        printSuccess(`Updated: ${result.phone_number}`);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
