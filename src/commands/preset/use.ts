import { Command } from 'commander';
import { getPreset, PRESETS } from '../../presets/defaults.js';
import { loadConfig, saveConfig } from '../../config/manager.js';
import { printSuccess, printHint, printError } from '../../ui/output.js';
import { printKeyValue } from '../../ui/table.js';
import { handleError } from '../../utils/errors.js';
import type { ProfileConfig } from '../../api/types.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerPresetUse(program: Command): void {
  program
    .command('use <name>')
    .description('Apply a preset to your profile as default settings')
    .option('--profile <name>', 'Save preset settings into a named profile')
    .action(async (name: string, opts: UseOptions) => {
      try {
        useAction(name, opts);
      } catch (error) {
        handleError(error);
      }
    });
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface UseOptions {
  profile?: string;
}

// ─── Action ────────────────────────────────────────────────────────────────

function useAction(name: string, opts: UseOptions): void {
  const properties = getPreset(name);
  const presetInfo = PRESETS[name];

  if (!properties || !presetInfo) {
    printError(`Preset "${name}" not found. Run \`convoai preset list\` to see available presets.`);
    process.exit(1);
  }

  const config = loadConfig();

  // Extract llm, tts, asr from the preset's AgentProperties
  const presetLlm = properties.llm;
  const presetTts = properties.tts;
  const presetAsr = properties.asr;

  if (opts.profile) {
    // Save into a named profile
    if (!config.profiles) {
      config.profiles = {};
    }
    const profile: ProfileConfig = config.profiles[opts.profile] ?? {};
    if (presetLlm) profile.llm = presetLlm;
    if (presetTts) profile.tts = presetTts;
    if (presetAsr) profile.asr = presetAsr;
    config.profiles[opts.profile] = profile;
  } else {
    // Save into the default profile (create one named "default" if needed)
    if (!config.profiles) {
      config.profiles = {};
    }
    const profileName = config.default_profile ?? 'default';
    const profile: ProfileConfig = config.profiles[profileName] ?? {};
    if (presetLlm) profile.llm = presetLlm;
    if (presetTts) profile.tts = presetTts;
    if (presetAsr) profile.asr = presetAsr;
    config.profiles[profileName] = profile;

    if (!config.default_profile) {
      config.default_profile = profileName;
    }
  }

  saveConfig(config);

  // ── Display what was saved ────────────────────────────────────────────
  const target = opts.profile ?? config.default_profile ?? 'default';
  printSuccess(`Preset "${name}" applied to profile "${target}".`);
  console.log();

  const pairs: [string, string][] = [
    ['LLM', presetInfo.llm],
    ['TTS', presetInfo.tts],
    ['ASR', presetInfo.asr],
  ];

  if (presetLlm?.model) {
    pairs.push(['Model', presetLlm.model]);
  }
  if (presetLlm?.greeting_message) {
    pairs.push(['Greeting', presetLlm.greeting_message]);
  }
  if (presetAsr?.language) {
    pairs.push(['Language', presetAsr.language]);
  }

  printKeyValue(pairs);

  console.log();
  printHint('Run `convoai agent start --channel <name>` to start an agent with these settings.');
}
