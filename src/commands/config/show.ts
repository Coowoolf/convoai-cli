import { Command } from 'commander';
import { loadConfig, getActiveProfile } from '../../config/manager.js';
import { printError, printHint } from '../../ui/output.js';
import { printKeyValue } from '../../ui/table.js';
import { handleError } from '../../utils/errors.js';
import type { ConvoAIConfig, ProfileConfig } from '../../api/types.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerConfigShow(program: Command): void {
  program
    .command('show')
    .description('Display the full configuration')
    .option('--profile <name>', 'Show a specific profile')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        showAction(opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

interface ShowOptions {
  profile?: string;
  json?: boolean;
}

function maskSecret(value: string | undefined): string {
  if (!value) return '(not set)';
  if (value.length <= 4) return '****';
  return value.slice(0, 4) + '****';
}

/**
 * Deep-clone a config object and mask all sensitive fields.
 */
function maskConfig(config: ConvoAIConfig): Record<string, unknown> {
  const masked = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;

  // Mask top-level secret
  if (typeof masked.customer_secret === 'string') {
    masked.customer_secret = maskSecret(masked.customer_secret as string);
  }

  // Mask profile-level secrets
  const profiles = masked.profiles as Record<string, Record<string, unknown>> | undefined;
  if (profiles) {
    for (const name of Object.keys(profiles)) {
      const p = profiles[name];
      if (typeof p.customer_secret === 'string') {
        p.customer_secret = maskSecret(p.customer_secret);
      }
      // Mask LLM API keys inside profiles
      const llm = p.llm as Record<string, unknown> | undefined;
      if (llm && typeof llm.api_key === 'string') {
        llm.api_key = maskSecret(llm.api_key);
      }
      // Mask TTS keys inside profiles
      const tts = p.tts as Record<string, unknown> | undefined;
      const ttsParams = tts?.params as Record<string, unknown> | undefined;
      if (ttsParams && typeof ttsParams.key === 'string') {
        ttsParams.key = maskSecret(ttsParams.key);
      }
    }
  }

  return masked;
}

function maskProfileConfig(profile: ProfileConfig): Record<string, unknown> {
  const masked = JSON.parse(JSON.stringify(profile)) as Record<string, unknown>;

  if (typeof masked.customer_secret === 'string') {
    masked.customer_secret = maskSecret(masked.customer_secret as string);
  }
  const llm = masked.llm as Record<string, unknown> | undefined;
  if (llm && typeof llm.api_key === 'string') {
    llm.api_key = maskSecret(llm.api_key);
  }
  const tts = masked.tts as Record<string, unknown> | undefined;
  const ttsParams = tts?.params as Record<string, unknown> | undefined;
  if (ttsParams && typeof ttsParams.key === 'string') {
    ttsParams.key = maskSecret(ttsParams.key);
  }

  return masked;
}

// ─── Action ────────────────────────────────────────────────────────────────

function showAction(opts: ShowOptions): void {
  const config = loadConfig();

  if (opts.profile) {
    const profile = config.profiles?.[opts.profile];
    if (!profile) {
      if (opts.json) {
        console.log(JSON.stringify({ error: `Profile "${opts.profile}" not found` }));
      } else {
        printError(`Profile "${opts.profile}" not found.`);
      }
      process.exit(1);
    }

    const masked = maskProfileConfig(profile);

    if (opts.json) {
      console.log(JSON.stringify(masked, null, 2));
      return;
    }

    showProfileFormatted(opts.profile, profile);
    return;
  }

  // Full config
  const masked = maskConfig(config);

  if (opts.json) {
    console.log(JSON.stringify(masked, null, 2));
    return;
  }

  showFullFormatted(config);
}

function showProfileFormatted(name: string, profile: ProfileConfig): void {
  const pairs: [string, string][] = [
    ['Profile', name],
    ['App ID', profile.app_id ?? '(not set)'],
    ['Customer ID', profile.customer_id ?? '(not set)'],
    ['Customer Secret', maskSecret(profile.customer_secret)],
    ['Region', profile.region ?? '(not set)'],
  ];

  if (profile.llm) {
    pairs.push(
      ['LLM Vendor', profile.llm.vendor ?? '(not set)'],
      ['LLM Model', profile.llm.model ?? '(not set)'],
      ['LLM API Key', maskSecret(profile.llm.api_key)],
    );
  }

  if (profile.tts) {
    pairs.push(['TTS Vendor', profile.tts.vendor ?? '(not set)']);
    if (profile.tts.params?.key) {
      pairs.push(['TTS API Key', maskSecret(profile.tts.params.key)]);
    }
  }

  printKeyValue(pairs);
}

function showFullFormatted(config: ConvoAIConfig): void {
  const pairs: [string, string][] = [
    ['App ID', config.app_id ?? '(not set)'],
    ['Customer ID', config.customer_id ?? '(not set)'],
    ['Customer Secret', maskSecret(config.customer_secret)],
    ['Region', config.region ?? 'global'],
    ['Base URL', config.base_url ?? '(default)'],
    ['Default Profile', config.default_profile ?? '(none)'],
  ];

  printKeyValue(pairs);

  // Show profiles summary
  const profileNames = Object.keys(config.profiles ?? {});
  if (profileNames.length > 0) {
    console.log('');
    console.log(`Profiles: ${profileNames.join(', ')}`);
    console.log('');
    for (const name of profileNames) {
      showProfileFormatted(name, config.profiles![name]);
      console.log('');
    }
  }
}
