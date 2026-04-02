import { Command } from 'commander';
import { loadConfig, saveConfig } from '../../config/manager.js';
import { printSuccess, printError } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';
import type { ConvoAIConfig } from '../../api/types.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAuthLogout(program: Command): void {
  program
    .command('logout')
    .description('Remove stored credentials')
    .option('--profile <name>', 'Remove a specific named profile')
    .option('--force', 'Skip confirmation prompt')
    .action(async (opts) => {
      try {
        await logoutAction(opts);
      } catch (error) {
        handleError(error);
      }
    });
}

// ─── Action ────────────────────────────────────────────────────────────────

interface LogoutOptions {
  profile?: string;
  force?: boolean;
}

async function logoutAction(opts: LogoutOptions): Promise<void> {
  const { default: inquirer } = await import('inquirer');
  const config = loadConfig();

  if (opts.profile) {
    // Remove a specific profile
    if (!config.profiles?.[opts.profile]) {
      printError(`Profile "${opts.profile}" does not exist.`);
      process.exit(1);
    }

    if (!opts.force) {
      const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
        {
          type: 'confirm',
          name: 'confirmed',
          message: `Remove credentials for profile "${opts.profile}"?`,
          default: false,
        },
      ]);
      if (!confirmed) {
        return;
      }
    }

    delete config.profiles[opts.profile];

    // Clean up empty profiles object
    if (Object.keys(config.profiles).length === 0) {
      delete config.profiles;
    }

    // If the deleted profile was the default, clear that reference
    if (config.default_profile === opts.profile) {
      delete config.default_profile;
    }

    saveConfig(config);
    printSuccess(`Profile "${opts.profile}" has been removed.`);
  } else {
    // Clear all credentials
    if (!opts.force) {
      const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Remove all stored credentials? This cannot be undone.',
          default: false,
        },
      ]);
      if (!confirmed) {
        return;
      }
    }

    clearAllCredentials(config);
    saveConfig(config);
    printSuccess('All credentials have been removed.');
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function clearAllCredentials(config: ConvoAIConfig): void {
  delete config.app_id;
  delete config.customer_id;
  delete config.customer_secret;
  delete config.region;
  delete config.base_url;
  delete config.default_profile;
  delete config.profiles;
}
