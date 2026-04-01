import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, getActiveProfile } from '../../config/manager.js';
import { createClient } from '../../api/client.js';
import { AgentAPI } from '../../api/agents.js';
import { printError, printHint } from '../../ui/output.js';
import { printKeyValue } from '../../ui/table.js';
import { withSpinner } from '../../ui/spinner.js';
import { handleError } from '../../utils/errors.js';
import type { ConvoAIConfig, ProfileConfig } from '../../api/types.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAuthStatus(program: Command): void {
  program
    .command('status')
    .description('Show current authentication status')
    .option('--profile <name>', 'Show status for a named profile')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        await statusAction(opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

interface StatusOptions {
  profile?: string;
  json?: boolean;
}

function maskSecret(secret: string | undefined): string {
  if (!secret) return '(not set)';
  if (secret.length <= 4) return '****';
  return secret.slice(0, 4) + '****';
}

async function testConnectivity(profile: ProfileConfig): Promise<boolean> {
  if (!profile.app_id || !profile.customer_id || !profile.customer_secret) {
    return false;
  }

  const client = createClient({
    appId: profile.app_id,
    customerId: profile.customer_id,
    customerSecret: profile.customer_secret,
    region: profile.region,
  });
  const api = new AgentAPI(client);

  try {
    await api.list({ limit: 1 });
    return true;
  } catch {
    return false;
  }
}

// ─── Action ────────────────────────────────────────────────────────────────

async function statusAction(opts: StatusOptions): Promise<void> {
  const config = loadConfig();
  let profile: ProfileConfig;
  let profileName: string;

  if (opts.profile) {
    if (!config.profiles?.[opts.profile]) {
      if (opts.json) {
        console.log(JSON.stringify({ error: `Profile "${opts.profile}" not found` }));
      } else {
        printError(`Profile "${opts.profile}" not found.`);
      }
      process.exit(1);
    }
    profile = config.profiles[opts.profile];
    profileName = opts.profile;
  } else {
    profile = getActiveProfile();
    profileName = config.default_profile ?? 'default';
  }

  const hasCredentials = Boolean(profile.app_id && profile.customer_id && profile.customer_secret);

  let connected = false;
  if (hasCredentials) {
    connected = await withSpinner('Testing connectivity...', () => testConnectivity(profile));
  }

  if (opts.json) {
    outputJson(profile, profileName, hasCredentials, connected);
  } else {
    outputFormatted(profile, profileName, hasCredentials, connected);
  }
}

function outputJson(
  profile: ProfileConfig,
  profileName: string,
  hasCredentials: boolean,
  connected: boolean,
): void {
  console.log(
    JSON.stringify(
      {
        profile: profileName,
        app_id: profile.app_id ?? null,
        customer_id: profile.customer_id ?? null,
        customer_secret: maskSecret(profile.customer_secret),
        region: profile.region ?? 'global',
        authenticated: hasCredentials,
        connected,
      },
      null,
      2,
    ),
  );
}

function outputFormatted(
  profile: ProfileConfig,
  profileName: string,
  hasCredentials: boolean,
  connected: boolean,
): void {
  const connStatus = connected
    ? chalk.green('\u2714 Connected')
    : hasCredentials
      ? chalk.red('\u2718 Connection failed')
      : chalk.yellow('Not configured');

  printKeyValue([
    ['Profile', profileName],
    ['App ID', profile.app_id ?? '(not set)'],
    ['Customer ID', profile.customer_id ?? '(not set)'],
    ['Customer Secret', maskSecret(profile.customer_secret)],
    ['Region', profile.region ?? 'global'],
    ['Status', connStatus],
  ]);

  if (!hasCredentials) {
    printHint('Run `convoai auth login` to configure credentials.');
  }
}
