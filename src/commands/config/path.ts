import { Command } from 'commander';
import path from 'node:path';
import os from 'node:os';
import { handleError } from '../../utils/errors.js';

// ─── Constants ─────────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), '.config', 'convoai');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// ─── Command Registration ──────────────────────────────────────────────────

export function registerConfigPath(program: Command): void {
  program
    .command('path')
    .description('Print the configuration file path')
    .option('--dir', 'Print only the config directory')
    .action((opts: { dir?: boolean }) => {
      try {
        if (opts.dir) {
          console.log(CONFIG_DIR);
        } else {
          console.log(CONFIG_FILE);
        }
      } catch (error) {
        handleError(error);
      }
    });
}
