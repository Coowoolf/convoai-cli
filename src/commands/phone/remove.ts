import { Command } from 'commander';
import { getNumberAPI } from './_helpers.js';
import { printSuccess } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneRemove(phone: Command): void {
  phone
    .command('remove <phone-number>')
    .description('Remove a phone number')
    .option('--force', 'Skip confirmation')
    .option('--profile <name>', 'Config profile')
    .action(async (phoneNumber, opts) => {
      try {
        if (!opts.force && process.stdin.isTTY) {
          const { default: inquirer } = await import('inquirer');
          const { confirm } = await inquirer.prompt([{
            type: 'confirm', name: 'confirm',
            message: `Remove ${phoneNumber}?`,
            default: false,
          }]);
          if (!confirm) return;
        }

        const api = getNumberAPI(opts.profile);
        await api.delete(phoneNumber);
        printSuccess(`Number removed: ${phoneNumber}`);
      } catch (error) {
        handleError(error);
      }
    });
}
