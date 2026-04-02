import { Command } from 'commander';
import { getConfigDir, getConfigPath } from '../../config/paths.js';
import { handleError } from '../../utils/errors.js';

export function registerConfigPath(program: Command): void {
  program
    .command('path')
    .description('Print the configuration file path')
    .option('--dir', 'Print only the config directory')
    .action((opts: { dir?: boolean }) => {
      try {
        if (opts.dir) {
          console.log(getConfigDir());
        } else {
          console.log(getConfigPath());
        }
      } catch (error) {
        handleError(error);
      }
    });
}
