import { Command } from 'commander';
import { cpSync, existsSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config/manager.js';
import { LLM_PROVIDERS, TTS_PROVIDERS } from '../providers/catalog.js';
import { createClient } from '../api/client.js';
import { AgentAPI } from '../api/agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findStarterDir(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'src', 'starters', 'web');
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    dir = dirname(dir);
  }
  throw new Error('Could not find starter template. Reinstall the package: npm install -g convoai');
}

function generateEnv(config: Record<string, any>): string {
  const profile = config.profiles?.default ?? config.profiles?.[config.default_profile ?? ''] ?? {};

  const lines: string[] = [
    '# Agora Credentials',
    `AGORA_APP_ID=${config.app_id ?? ''}`,
    `AGORA_APP_CERTIFICATE=${config.app_certificate ?? ''}`,
    `AGORA_CUSTOMER_ID=${config.customer_id ?? ''}`,
    `AGORA_CUSTOMER_SECRET=${config.customer_secret ?? ''}`,
    '',
    '# Region',
    `AGORA_REGION=${config.region ?? 'global'}`,
    '',
    '# LLM Configuration',
    `LLM_VENDOR=${profile.llm?.vendor ?? ''}`,
    `LLM_MODEL=${profile.llm?.params?.model ?? profile.llm?.model ?? ''}`,
    `LLM_API_KEY=${profile.llm?.api_key ?? ''}`,
    `LLM_URL=${profile.llm?.url ?? ''}`,
    `LLM_STYLE=${profile.llm?.style ?? ''}`,
    '',
    '# TTS Configuration',
    `TTS_VENDOR=${profile.tts?.vendor ?? ''}`,
    `TTS_PARAMS=${profile.tts?.params ? JSON.stringify(profile.tts.params) : ''}`,
    '',
    '# ASR Configuration',
    `ASR_VENDOR=${profile.asr?.vendor ?? 'ares'}`,
    `ASR_LANGUAGE=${profile.asr?.language ?? 'en-US'}`,
  ];

  return lines.join('\n') + '\n';
}

// ─── Inline credential setup (runs when no config exists) ──────────────────

async function runInlineSetup(): Promise<void> {
  const { default: inquirer } = await import('inquirer');
  let config = loadConfig();

  console.log('');
  console.log(chalk.bold('  First-time setup — configure your Agora credentials'));
  console.log(chalk.dim('  (Same as "convoai quickstart", but just the essentials)'));
  console.log('');

  // Platform
  const { platform } = await inquirer.prompt([{
    type: 'list',
    name: 'platform',
    message: 'Platform:',
    choices: [
      { name: 'Shengwang.cn (声网)', value: 'cn' },
      { name: 'Agora.io (Global)', value: 'global' },
    ],
    default: config.region ?? 'cn',
  }]);
  config.region = platform;

  const isCN = platform === 'cn';
  const consoleUrl = isCN ? 'console.shengwang.cn' : 'console.agora.io';
  const overviewHint = isCN ? '总览 → 项目信息' : 'Overview → Project Info';
  const restHint = isCN ? 'RESTful API → 添加密钥' : 'RESTful API → Add Secret';

  // Agora credentials — validate immediately, loop on failure
  let credentialsValid = false;

  while (!credentialsValid) {
    const creds = await inquirer.prompt([
      {
        type: 'input', name: 'appId',
        message: `App ID ${chalk.dim(`(${consoleUrl} → ${overviewHint})`)}:`,
        default: config.app_id,
        validate: (v: string) => v.trim().length > 0 || 'Required',
      },
      {
        type: 'password', name: 'appCertificate',
        message: `App Certificate ${chalk.dim(`(${overviewHint})`)}:`,
        mask: '*', default: config.app_certificate,
        validate: (v: string) => v.trim().length > 0 || 'Required',
      },
      {
        type: 'input', name: 'customerId',
        message: `Customer ID ${chalk.dim(`(${restHint})`)}:`,
        default: config.customer_id,
        validate: (v: string) => v.trim().length > 0 || 'Required',
      },
      {
        type: 'password', name: 'customerSecret',
        message: `Customer Secret ${chalk.dim(`(${restHint})`)}:`,
        mask: '*', default: config.customer_secret,
        validate: (v: string) => v.trim().length > 0 || 'Required',
      },
    ]);

    config.app_id = creds.appId;
    config.app_certificate = creds.appCertificate;
    config.customer_id = creds.customerId;
    config.customer_secret = creds.customerSecret;

    // Validate credentials
    const { default: ora } = await import('ora');
    const spinner = ora(isCN ? '正在验证凭证...' : 'Validating credentials...').start();
    try {
      const testClient = createClient({
        appId: config.app_id!,
        customerId: config.customer_id!,
        customerSecret: config.customer_secret!,
        region: config.region as 'global' | 'cn' | undefined,
      });
      const testApi = new AgentAPI(testClient);
      await testApi.list({ limit: 1 });
      spinner.succeed(isCN ? '凭证验证通过' : 'Credentials verified');
      credentialsValid = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('401')) {
        spinner.fail(isCN ? 'Customer ID 或 Customer Secret 不正确' : 'Customer ID or Secret is incorrect');
      } else if (msg.includes('400') || msg.includes('appid')) {
        spinner.fail(isCN ? 'App ID 无效' : 'App ID is invalid');
      } else {
        spinner.fail(isCN ? `验证失败: ${msg}` : `Validation failed: ${msg}`);
      }
      console.log(chalk.dim(isCN ? '  请重新输入\n' : '  Please re-enter.\n'));
    }
  }

  // LLM
  const llmChoices = LLM_PROVIDERS.map(p => ({ name: `${p.name}${p.note ? ' ' + chalk.dim(p.note) : ''}`, value: p.value }));
  const defaultLlm = isCN ? 'dashscope' : 'openai';

  const { llmVendor } = await inquirer.prompt([{
    type: 'list', name: 'llmVendor',
    message: isCN ? 'LLM 供应商:' : 'LLM provider:',
    choices: llmChoices,
    default: defaultLlm,
  }]);

  const llmProvider = LLM_PROVIDERS.find(p => p.value === llmVendor);
  const { llmApiKey } = await inquirer.prompt([{
    type: 'password', name: 'llmApiKey',
    message: 'LLM API Key:',
    mask: '*',
  }]);

  const llmModels = llmProvider?.models ?? [];
  let llmModel = llmModels[0] ?? llmProvider?.defaultModel ?? '';
  if (llmModels.length > 1) {
    const { model } = await inquirer.prompt([{
      type: 'list', name: 'model',
      message: isCN ? '模型:' : 'Model:',
      choices: llmModels,
      default: llmModels[0],
    }]);
    llmModel = model;
  }

  // Determine LLM style
  const styleMap: Record<string, string> = {
    openai: 'openai', groq: 'openai', deepseek: 'openai', dashscope: 'openai',
    azure: 'openai', bedrock: 'openai', dify: 'dify', custom: 'openai',
    anthropic: 'anthropic', gemini: 'gemini',
  };
  const llmStyle = styleMap[llmVendor] ?? 'openai';

  // LLM URL: resolve template placeholders + prompt if needed
  let llmUrl = llmProvider?.url ?? '';
  // Replace {model} and {api_key} placeholders (e.g. Gemini URL template)
  if (llmUrl.includes('{model}')) llmUrl = llmUrl.replace('{model}', llmModel);
  if (llmUrl.includes('{api_key}')) llmUrl = llmUrl.replace('{api_key}', llmApiKey);

  const needsUrlPrompt = !llmUrl || ['custom', 'azure', 'bedrock'].includes(llmVendor);
  if (needsUrlPrompt) {
    const { url } = await inquirer.prompt([{
      type: 'input', name: 'url',
      message: isCN ? 'LLM API URL:' : 'LLM API URL:',
      default: llmUrl || undefined,
      validate: (v: string) => v.trim().length > 0 || 'Required',
    }]);
    llmUrl = url;
  }

  // TTS
  const ttsChoices = TTS_PROVIDERS.map(p => ({ name: `${p.name}${p.note ? ' ' + chalk.dim(p.note) : ''}`, value: p.vendor }));
  const defaultTts = isCN ? 'minimax' : 'microsoft';

  const { ttsVendor } = await inquirer.prompt([{
    type: 'list', name: 'ttsVendor',
    message: isCN ? 'TTS 供应商:' : 'TTS provider:',
    choices: ttsChoices,
    default: defaultTts,
  }]);

  const selectedTts = TTS_PROVIDERS.find(p => p.vendor === ttsVendor);

  const { ttsApiKey } = await inquirer.prompt([{
    type: 'password', name: 'ttsApiKey',
    message: 'TTS API Key:',
    mask: '*',
    validate: (v: string) => v.trim().length > 0 || 'Required',
  }]);

  const ttsParams: Record<string, unknown> = { key: ttsApiKey };

  // Microsoft: region + voice name
  if (ttsVendor === 'microsoft') {
    const ms = await inquirer.prompt([
      { type: 'input', name: 'region', message: 'Azure TTS Region:', default: 'eastus' },
      { type: 'input', name: 'voiceName', message: 'Voice Name:', default: 'en-US-AndrewMultilingualNeural' },
    ]);
    ttsParams.region = ms.region;
    ttsParams.voice_name = ms.voiceName;
  }

  // MiniMax: group_id
  if (selectedTts?.requiresGroupId) {
    const { groupId } = await inquirer.prompt([{
      type: 'input', name: 'groupId',
      message: isCN ? 'MiniMax Group ID (minimax.chat 控制台):' : 'MiniMax Group ID (from minimax.chat):',
      validate: (v: string) => v.trim().length > 0 || 'Required',
    }]);
    ttsParams.group_id = groupId;
  }

  // OpenAI/Cartesia use api_key instead of key
  if (ttsVendor === 'openai' || ttsVendor === 'cartesia') {
    ttsParams.api_key = ttsParams.key;
    delete ttsParams.key;
  }

  // Auto-fill vendor defaults (base_url, model, voice, etc.)
  if (selectedTts?.defaultParams) {
    for (const [k, v] of Object.entries(selectedTts.defaultParams)) {
      if (!(k in ttsParams)) ttsParams[k] = v;
    }
  }

  // Save to CLI config
  if (!config.profiles) config.profiles = {};
  config.profiles.default = {
    ...config.profiles.default,
    llm: {
      vendor: llmVendor === 'anthropic' || llmVendor === 'gemini' ? llmVendor : undefined,
      style: llmStyle as any,
      api_key: llmApiKey,
      url: llmUrl,
      model: llmModel,
      params: { model: llmModel, max_tokens: 512, temperature: 0.7 },
    },
    tts: {
      vendor: ttsVendor,
      params: ttsParams,
    },
    asr: {
      vendor: 'ares',
      language: isCN ? 'zh-CN' : 'en-US',
    },
  };
  config.default_profile = 'default';

  saveConfig(config);
  console.log('');
  console.log(chalk.green('  ✓ Credentials saved'));
}

// ─── Main command ──────────────────────────────────────────────────────────

export function registerInit(program: Command): void {
  program
    .command('init [project-name]')
    .description('Create a new ConvoAI starter project')
    .action(async (projectName?: string) => {
      const name = projectName || 'my-convoai-app';
      const targetDir = join(process.cwd(), name);

      // 1. Check target directory
      if (existsSync(targetDir)) {
        try {
          const entries = readdirSync(targetDir);
          if (entries.length > 0) {
            console.error(chalk.red(`\n  Error: Directory "${name}" already exists and is not empty.\n`));
            process.exit(1);
          }
        } catch {
          console.error(chalk.red(`\n  Error: Cannot read directory "${name}".\n`));
          process.exit(1);
        }
      }

      // 2. If no credentials, run inline setup first
      let config = loadConfig();
      const hasCredentials = !!(config.app_id && config.customer_id && config.customer_secret && config.app_certificate);

      if (!hasCredentials && process.stdin.isTTY) {
        await runInlineSetup();
        config = loadConfig();
      }

      // 3. Find and copy template
      try {
        const starterDir = findStarterDir();
        cpSync(starterDir, targetDir, { recursive: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(chalk.red(`\n  Error: ${msg}\n`));
        process.exit(1);
      }

      // 4. Generate .env from CLI config
      const envContent = generateEnv(config);
      writeFileSync(join(targetDir, '.env'), envContent, 'utf-8');

      // 5. Update package name
      try {
        const pkgPath = join(targetDir, 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        pkg.name = name;
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      } catch { /* non-critical */ }

      // 6. Print success
      console.log('');
      console.log(chalk.green(`  ✓ Project created: ${name}/`));
      console.log('');
      console.log(chalk.bold('  Next steps:'));
      console.log(chalk.cyan(`    cd ${name}`));
      console.log(chalk.cyan('    npm install'));
      console.log(chalk.cyan('    convoai dev'));
      console.log('');
      console.log(chalk.dim('  Project structure:'));
      console.log(chalk.dim('    frontend/       ← customize your UI'));
      console.log(chalk.dim('    server/         ← add your business logic'));
      console.log(chalk.dim('    python-server/  ← alternative Python server'));
      console.log('');
    });
}
