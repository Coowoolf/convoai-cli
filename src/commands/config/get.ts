import { Command } from 'commander';
import { loadConfig, getActiveProfile } from '../../config/manager.js';
import { printError } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';
import type { ConvoAIConfig, ProfileConfig } from '../../api/types.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerConfigGet(program: Command): void {
  program
    .command('get <key>')
    .description('Get a configuration value (supports dot notation, e.g. llm.model)')
    .option('--profile <name>', 'Read value from a named profile')
    .action(async (key: string, opts: { profile?: string }) => {
      try {
        getAction(key, opts);
      } catch (error) {
        handleError(error);
      }
    });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  const parts = keyPath.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// ─── Action ────────────────────────────────────────────────────────────────

function getAction(key: string, opts: { profile?: string }): void {
  const config = loadConfig();
  let source: Record<string, unknown>;

  if (opts.profile) {
    const profile = config.profiles?.[opts.profile];
    if (!profile) {
      printError(`Profile "${opts.profile}" not found.`);
      process.exit(1);
    }
    source = profile as Record<string, unknown>;
  } else {
    // For top-level keys, read from root config; for nested keys like llm.*,
    // merge with the active profile so we pick up profile-level settings too.
    source = config as Record<string, unknown>;

    // If the key starts with llm/tts/asr, also check active profile
    const topSegment = key.split('.')[0];
    if (['llm', 'tts', 'asr'].includes(topSegment)) {
      const profile = getActiveProfile() as unknown as Record<string, unknown>;
      const profileValue = getNestedValue(profile, key);
      const rootValue = getNestedValue(source, key);
      // Profile-level value takes precedence when root is not set
      if (rootValue === undefined && profileValue !== undefined) {
        outputValue(profileValue);
        return;
      }
    }
  }

  const value = getNestedValue(source, key);

  if (value === undefined) {
    printError(`Key "${key}" is not set.`);
    process.exit(1);
  }

  outputValue(value);
}

function outputValue(value: unknown): void {
  if (typeof value === 'object' && value !== null) {
    console.log(JSON.stringify(value, null, 2));
  } else {
    console.log(String(value));
  }
}
