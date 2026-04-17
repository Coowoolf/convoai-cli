import { Command } from 'commander';
import { getNumberAPI, validateE164 } from './_helpers.js';
import { printSuccess } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneImport(phone: Command): void {
  phone
    .command('import')
    .description('Import a new phone number')
    .option('--number <number>', 'Phone number (E.164)')
    .option('--provider <provider>', 'Provider (twilio / byo)')
    .option('--label <label>', 'Label for this number')
    .option('--sip-address <address>', 'SIP server address')
    .option('--sip-transport <transport>', 'Transport (tls / tcp / udp)')
    .option('--sip-user <user>', 'SIP username')
    .option('--sip-password <password>', 'SIP password')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      try {
        let phoneNumber = opts.number;
        let provider = opts.provider;
        let label = opts.label;
        let sipAddress = opts.sipAddress;
        let sipTransport = opts.sipTransport;
        let sipUser = opts.sipUser;
        let sipPassword = opts.sipPassword;

        if (!phoneNumber || !provider || !label || !sipAddress) {
          const { safePrompt } = await import('../../ui/prompt.js');

          if (!provider) {
            const ans = await safePrompt([{
              type: 'list', name: 'provider', message: 'Provider:',
              choices: [{ name: 'Twilio', value: 'twilio' }, { name: 'BYO (Bring Your Own)', value: 'byo' }],
            }]);
            provider = ans.provider;
          }

          if (!phoneNumber) {
            const ans = await safePrompt([{
              type: 'input', name: 'number', message: 'Phone number (E.164):',
              validate: (v: string) => /^\+[1-9]\d{1,14}$/.test(v.trim()) || 'Invalid E.164 format',
            }]);
            phoneNumber = ans.number;
          }

          if (!label) {
            const ans = await safePrompt([{
              type: 'input', name: 'label', message: 'Label:',
              validate: (v: string) => v.trim().length > 0 || 'Required',
            }]);
            label = ans.label;
          }

          if (!sipAddress) {
            const ans = await safePrompt([
              { type: 'input', name: 'address', message: 'SIP address:', validate: (v: string) => v.trim().length > 0 || 'Required' },
              { type: 'list', name: 'transport', message: 'Transport:', choices: ['tls', 'tcp', 'udp'], default: 'tls' },
              { type: 'input', name: 'user', message: 'SIP username (optional):' },
              { type: 'password', name: 'password', message: 'SIP password (optional):', mask: '*' },
            ]);
            sipAddress = ans.address;
            sipTransport = ans.transport;
            sipUser = ans.user || undefined;
            sipPassword = ans.password || undefined;
          }
        }

        phoneNumber = validateE164(phoneNumber);

        const api = getNumberAPI(opts.profile);
        const result = await api.import({
          provider,
          phone_number: phoneNumber,
          label,
          outbound: true,
          inbound: false,
          outbound_config: {
            address: sipAddress,
            transport: sipTransport || 'tls',
            user: sipUser,
            password: sipPassword,
          },
        });

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        printSuccess(`Number imported: ${result.phone_number}`);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
