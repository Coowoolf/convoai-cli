import { Command } from 'commander';
import { loadConfig, saveConfig } from '../../config/manager.js';
import { printSuccess, printError } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';
import type { ConvoAIConfig } from '../../api/types.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerConfigSet(program: Command): void {
  program
    .command('set <key> <value>')
    .description('Set a configuration value (supports dot notation, e.g. llm.model)')
    .option('--profile <name>', 'Set value within a named profile')
    .action(async (key: string, value: string, opts: { profile?: string }) => {
      try {
        setAction(key, value, opts);
      } catch (error) {
        handleError(error);
      }
    });
}

// ─── Known Config Paths ────────────────────────────────────────────────────

/**
 * Allowlist of valid dot-notation key paths. Top-level keys apply to the root
 * config; all others can also target a profile.
 */
const VALID_KEYS = new Set([
  // Top-level credentials
  'app_id',
  'customer_id',
  'customer_secret',
  'base_url',
  'region',
  'default_profile',

  // LLM
  'llm.url',
  'llm.api_key',
  'llm.vendor',
  'llm.style',
  'llm.model',
  'llm.greeting_message',
  'llm.failure_message',
  'llm.max_history',

  // TTS
  'tts.vendor',
  'tts.params.key',
  'tts.params.region',
  'tts.params.voice_name',
  'tts.params.speed',
  'tts.params.volume',

  // ASR
  'asr.vendor',
  'asr.language',
  'asr.params.key',
  'asr.params.model',
  'asr.params.language',
]);

// ─── String-only Keys (never coerce to number) ───────────────────────────

const STRING_KEYS = new Set([
  'app_id', 'customer_id', 'customer_secret', 'base_url', 'region',
  'default_profile', 'llm.url', 'llm.api_key', 'llm.vendor', 'llm.style',
  'llm.model', 'llm.greeting_message', 'llm.failure_message',
  'tts.vendor', 'tts.params.key', 'tts.params.region', 'tts.params.voice_name',
  'asr.vendor', 'asr.language', 'asr.params.key', 'asr.params.model', 'asr.params.language',
]);

// ─── Helpers ───────────────────────────────────────────────────────────────

function setNestedValue(obj: Record<string, unknown>, keyPath: string, value: string): void {
  const parts = keyPath.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const leaf = parts[parts.length - 1];
  // Attempt to coerce obvious numeric / boolean values, but keep string keys as strings
  current[leaf] = STRING_KEYS.has(keyPath) ? value : coerceValue(value);
}

function coerceValue(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!Number.isNaN(num) && value.trim().length > 0 && !/^0[^.]/.test(value)) {
    return num;
  }
  return value;
}

// ─── Action ────────────────────────────────────────────────────────────────

function setAction(key: string, value: string, opts: { profile?: string }): void {
  if (!VALID_KEYS.has(key)) {
    printError(
      `Unknown config key "${key}". Valid keys:\n  ${[...VALID_KEYS].sort().join('\n  ')}`,
    );
    process.exit(1);
  }

  const config = loadConfig();

  if (opts.profile) {
    // Set within a named profile
    if (!config.profiles) {
      config.profiles = {};
    }
    if (!config.profiles[opts.profile]) {
      config.profiles[opts.profile] = {};
    }
    setNestedValue(config.profiles[opts.profile] as Record<string, unknown>, key, value);
  } else {
    // Set at the root level
    setNestedValue(config as Record<string, unknown>, key, value);
  }

  saveConfig(config);

  const target = opts.profile ? ` (profile: ${opts.profile})` : '';
  printSuccess(`Set ${key} = ${value}${target}`);
}
