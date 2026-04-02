import { Command } from 'commander';
import { loadConfig, saveConfig } from '../../config/manager.js';
import { createClient } from '../../api/client.js';
import { AgentAPI } from '../../api/agents.js';
import { printSuccess, printError, printHint } from '../../ui/output.js';
import { withSpinner } from '../../ui/spinner.js';
import { handleError } from '../../utils/errors.js';
import { hintAfterLogin } from '../../utils/hints.js';
import type { ConvoAIConfig, ProfileConfig } from '../../api/types.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAuthLogin(program: Command): void {
  program
    .command('login')
    .description('Authenticate with the Agora ConvoAI platform')
    .option('--app-id <id>', 'Agora App ID')
    .option('--customer-id <id>', 'Customer ID')
    .option('--customer-secret <secret>', 'Customer Secret')
    .option('--profile <name>', 'Save credentials under a named profile')
    .action(async (opts) => {
      try {
        await loginAction(opts);
      } catch (error) {
        handleError(error);
      }
    });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

interface LoginOptions {
  appId?: string;
  customerId?: string;
  customerSecret?: string;
  profile?: string;
}

interface Credentials {
  appId: string;
  customerId: string;
  customerSecret: string;
  region: 'global' | 'cn';
}

async function promptCredentials(opts: LoginOptions): Promise<Credentials> {
  const { default: inquirer } = await import('inquirer');
  const answers = await inquirer.prompt<Credentials>([
    {
      type: 'input',
      name: 'appId',
      message: 'Agora App ID:',
      when: () => !opts.appId,
      validate: (v: string) => (v.trim().length > 0 ? true : 'App ID is required'),
    },
    {
      type: 'input',
      name: 'customerId',
      message: 'Customer ID:',
      when: () => !opts.customerId,
      validate: (v: string) => (v.trim().length > 0 ? true : 'Customer ID is required'),
    },
    {
      type: 'password',
      name: 'customerSecret',
      message: 'Customer Secret:',
      mask: '*',
      when: () => !opts.customerSecret,
      validate: (v: string) => (v.trim().length > 0 ? true : 'Customer Secret is required'),
    },
    {
      type: 'list',
      name: 'region',
      message: 'Default region:',
      choices: [
        { name: 'Global', value: 'global' },
        { name: 'China', value: 'cn' },
      ],
      default: 'global',
    },
  ]);

  return {
    appId: opts.appId ?? answers.appId,
    customerId: opts.customerId ?? answers.customerId,
    customerSecret: opts.customerSecret ?? answers.customerSecret,
    region: answers.region,
  };
}

async function verifyConnectivity(creds: Credentials): Promise<boolean> {
  const client = createClient({
    appId: creds.appId,
    customerId: creds.customerId,
    customerSecret: creds.customerSecret,
    region: creds.region,
  });
  const api = new AgentAPI(client);

  try {
    await withSpinner('Verifying credentials...', async () => {
      await api.list({ limit: 1 });
    });
    return true;
  } catch {
    printError('Could not verify credentials. They have been saved, but connectivity failed.');
    printHint('Check that your App ID, Customer ID, and Customer Secret are correct.');
    return false;
  }
}

// ─── Action ────────────────────────────────────────────────────────────────

async function loginAction(opts: LoginOptions): Promise<void> {
  const creds = await promptCredentials(opts);
  const config = loadConfig();

  if (opts.profile) {
    // Save under a named profile
    if (!config.profiles) {
      config.profiles = {};
    }
    const profile: ProfileConfig = config.profiles[opts.profile] ?? {};
    profile.app_id = creds.appId;
    profile.customer_id = creds.customerId;
    profile.customer_secret = creds.customerSecret;
    profile.region = creds.region;
    config.profiles[opts.profile] = profile;
  } else {
    // Save as top-level (default) credentials
    config.app_id = creds.appId;
    config.customer_id = creds.customerId;
    config.customer_secret = creds.customerSecret;
    config.region = creds.region;
  }

  saveConfig(config);

  await verifyConnectivity(creds);

  const target = opts.profile ? `profile "${opts.profile}"` : 'default profile';
  printSuccess(`Credentials saved to ${target}.`);
  printHint(hintAfterLogin());
}
