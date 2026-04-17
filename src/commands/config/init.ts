import { Command } from 'commander';
import { loadConfig, saveConfig } from '../../config/manager.js';
import { createClient } from '../../api/client.js';
import { AgentAPI } from '../../api/agents.js';
import { printSuccess, printError, printHint } from '../../ui/output.js';
import { printKeyValue } from '../../ui/table.js';
import { withSpinner } from '../../ui/spinner.js';
import { handleError } from '../../utils/errors.js';
import { hintAfterLogin } from '../../utils/hints.js';
import type { ConvoAIConfig } from '../../api/types.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerConfigInit(program: Command): void {
  program
    .command('init')
    .description('Interactive setup wizard for ConvoAI configuration')
    .action(async () => {
      try {
        await initAction();
      } catch (error) {
        handleError(error);
      }
    });
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface InitAnswers {
  appId: string;
  appCertificate: string;
  customerId: string;
  customerSecret: string;
  region: 'global' | 'cn';
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  ttsVendor: string;
  ttsApiKey: string;
}

// ─── LLM Provider Metadata ────────────────────────────────────────────────

const LLM_PROVIDERS: Record<string, { style: string; defaultModel: string }> = {
  openai: { style: 'openai', defaultModel: 'gpt-4o' },
  anthropic: { style: 'anthropic', defaultModel: 'claude-sonnet-4-20250514' },
  gemini: { style: 'gemini', defaultModel: 'gemini-2.0-flash' },
  custom: { style: 'openai', defaultModel: '' },
};

const TTS_VENDORS_NEEDING_KEY = ['microsoft', 'elevenlabs', 'openai', 'minimax'];

// ─── Action ────────────────────────────────────────────────────────────────

async function initAction(): Promise<void> {
  const { safePrompt } = await import('../../ui/prompt.js');
  const answers = await safePrompt<InitAnswers>([
    {
      type: 'input',
      name: 'appId',
      message: 'Agora App ID:',
      validate: (v: string) => (v.trim().length > 0 ? true : 'App ID is required'),
    },
    {
      type: 'input',
      name: 'customerId',
      message: 'Customer ID:',
      validate: (v: string) => (v.trim().length > 0 ? true : 'Customer ID is required'),
    },
    {
      type: 'password',
      name: 'customerSecret',
      message: 'Customer Secret:',
      mask: '*',
      validate: (v: string) => (v.trim().length > 0 ? true : 'Customer Secret is required'),
    },
    {
      type: 'password',
      name: 'appCertificate',
      message: 'App Certificate (for RTC token generation):',
      mask: '*',
      validate: (v: string) => (v.trim().length > 0 ? true : 'App Certificate is required for agent RTC connections'),
    },
    {
      type: 'list',
      name: 'region',
      message: 'Region:',
      choices: [
        { name: 'Global', value: 'global' },
        { name: 'China', value: 'cn' },
      ],
      default: 'global',
    },
    {
      type: 'list',
      name: 'llmProvider',
      message: 'Default LLM provider:',
      choices: [
        { name: 'OpenAI', value: 'openai' },
        { name: 'Anthropic', value: 'anthropic' },
        { name: 'Gemini', value: 'gemini' },
        { name: 'Custom', value: 'custom' },
      ],
    },
    {
      type: 'password',
      name: 'llmApiKey',
      message: 'LLM API key:',
      mask: '*',
      validate: (v: string) => (v.trim().length > 0 ? true : 'API key is required'),
    },
    {
      type: 'input',
      name: 'llmModel',
      message: 'LLM model name:',
      default: (prev: InitAnswers) => LLM_PROVIDERS[prev.llmProvider]?.defaultModel ?? '',
      validate: (v: string) => (v.trim().length > 0 ? true : 'Model name is required'),
    },
    {
      type: 'list',
      name: 'ttsVendor',
      message: 'TTS vendor:',
      choices: [
        { name: 'Microsoft Azure', value: 'microsoft' },
        { name: 'ElevenLabs', value: 'elevenlabs' },
        { name: 'OpenAI', value: 'openai' },
        { name: 'MiniMax', value: 'minimax' },
      ],
    },
    {
      type: 'password',
      name: 'ttsApiKey',
      message: 'TTS API key:',
      mask: '*',
      when: (prev: InitAnswers) => TTS_VENDORS_NEEDING_KEY.includes(prev.ttsVendor),
      validate: (v: string) => (v.trim().length > 0 ? true : 'TTS API key is required'),
    },
  ]);

  // Build config object
  const config = loadConfig();
  config.app_id = answers.appId;
  config.app_certificate = answers.appCertificate;
  config.customer_id = answers.customerId;
  config.customer_secret = answers.customerSecret;
  config.region = answers.region;

  // Initialize the default profile with LLM and TTS settings
  if (!config.profiles) {
    config.profiles = {};
  }
  const defaultProfile = config.profiles['default'] ?? {};

  const provider = LLM_PROVIDERS[answers.llmProvider] ?? LLM_PROVIDERS.custom;
  defaultProfile.llm = {
    vendor: answers.llmProvider === 'custom' ? undefined : answers.llmProvider,
    style: provider.style as 'openai' | 'gemini' | 'anthropic',
    api_key: answers.llmApiKey,
    model: answers.llmModel,
  };

  defaultProfile.tts = {
    vendor: answers.ttsVendor,
    params: answers.ttsApiKey ? { key: answers.ttsApiKey } : undefined,
  };

  config.profiles['default'] = defaultProfile;
  config.default_profile = 'default';

  saveConfig(config);

  // Verify connectivity
  let connected = false;
  try {
    const client = createClient({
      appId: answers.appId,
      customerId: answers.customerId,
      customerSecret: answers.customerSecret,
      region: answers.region,
    });
    const api = new AgentAPI(client);
    await withSpinner('Verifying credentials...', async () => {
      await api.list({ limit: 1 });
    });
    connected = true;
  } catch {
    printError('Credential verification failed. Config has been saved; check your credentials.');
  }

  // Show summary
  console.log('');
  printSuccess('Configuration saved.');
  console.log('');
  printKeyValue([
    ['App ID', answers.appId],
    ['Customer ID', answers.customerId],
    ['Region', answers.region],
    ['LLM Provider', answers.llmProvider],
    ['LLM Model', answers.llmModel],
    ['TTS Vendor', answers.ttsVendor],
    ['Connectivity', connected ? 'Verified' : 'Failed'],
  ]);
  console.log('');
  printHint(hintAfterLogin());
}
