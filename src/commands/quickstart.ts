import { Command } from 'commander';
import { createServer } from 'node:http';
import { createWebHandler } from '../web/serve.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config/manager.js';
import { createClient } from '../api/client.js';
import { AgentAPI } from '../api/agents.js';
import { generateRtcToken } from '../utils/token.js';
import { withSpinner } from '../ui/spinner.js';
import { printSuccess, printError, printHint } from '../ui/output.js';
import { printKeyValue } from '../ui/table.js';
import { handleError } from '../utils/errors.js';
import { track } from '../utils/telemetry.js';
import { gradientBox, gradientBoxGreen, gradientProgress } from '../ui/gradient.js';
import { runPanel } from './agent/panel.js';
import { getStrings } from '../ui/i18n.js';
import { LLM_PROVIDERS, TTS_PROVIDERS, ASR_PROVIDERS, ASR_LANGUAGES } from '../providers/catalog.js';
import type { StepStrings } from '../ui/i18n.js';
import type { StartAgentRequest, LLMConfig } from '../api/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findClientHtml(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'src', 'web', 'client.html');
    try { readFileSync(candidate); return candidate; } catch { /* */ }
    dir = dirname(dir);
  }
  throw new Error('Could not find web client HTML.');
}

// ─── Registration ──────────────────────────────────────────────────────────

export function registerQuickstart(program: Command): void {
  program
    .command('quickstart')
    .alias('qs')
    .description('Full guided experience: configure, start agent, voice chat, review')
    .action(async () => {
      try {
        await quickstartAction();
      } catch (error) {
        handleError(error);
      }
    });
}

// ─── Greeting by Language ──────────────────────────────────────────────────

const GREETINGS: Record<string, string> = {
  'zh-CN': '你好，我是声网 ConvoAI 语音助手，有什么可以帮你的吗？',
  'zh-HK': '你好，我是聲網 ConvoAI 語音助手，有什麼可以幫你的嗎？',
  'zh-TW': '你好，我是聲網 ConvoAI 語音助手，有什麼可以幫你的嗎？',
  'en-US': 'Hi, I\'m your Agora ConvoAI voice assistant. How can I help you?',
  'en-IN': 'Hi, I\'m your Agora ConvoAI voice assistant. How can I help you?',
  'ja-JP': 'こんにちは、Agora ConvoAI 音声アシスタントです。何かお手伝いできますか？',
  'ko-KR': '안녕하세요, Agora ConvoAI 음성 어시스턴트입니다. 무엇을 도와드릴까요?',
  'fr-FR': 'Bonjour, je suis votre assistant vocal Agora ConvoAI. Comment puis-je vous aider ?',
  'de-DE': 'Hallo, ich bin Ihr Agora ConvoAI Sprachassistent. Wie kann ich Ihnen helfen?',
  'es-ES': 'Hola, soy tu asistente de voz Agora ConvoAI. ¿En qué puedo ayudarte?',
  'pt-PT': 'Olá, sou o seu assistente de voz Agora ConvoAI. Como posso ajudar?',
  'ru-RU': 'Здравствуйте, я ваш голосовой ассистент Agora ConvoAI. Чем могу помочь?',
  'hi-IN': 'नमस्ते, मैं आपका Agora ConvoAI वॉइस असिस्टेंट हूँ। मैं आपकी कैसे मदद कर सकता हूँ?',
  'ar-SA': 'مرحبًا، أنا مساعدك الصوتي Agora ConvoAI. كيف يمكنني مساعدتك؟',
  'th-TH': 'สวัสดีค่ะ ฉันคือผู้ช่วยเสียง Agora ConvoAI ช่วยอะไรได้บ้างคะ?',
  'vi-VN': 'Xin chào, tôi là trợ lý giọng nói Agora ConvoAI. Tôi có thể giúp gì cho bạn?',
  'id-ID': 'Halo, saya asisten suara Agora ConvoAI. Ada yang bisa saya bantu?',
  'tr-TR': 'Merhaba, ben Agora ConvoAI sesli asistanınızım. Size nasıl yardımcı olabilirim?',
  'it-IT': 'Ciao, sono il tuo assistente vocale Agora ConvoAI. Come posso aiutarti?',
};

function getGreeting(language: string): string {
  return GREETINGS[language] ?? GREETINGS['en-US'];
}

// ─── Step Rendering ───────────────────────────────────────────────────────

function showStep(stepStrings: StepStrings, current: number, total: number): void {
  const box = stepStrings === step6Strings ? gradientBoxGreen(stepStrings) : gradientBox(stepStrings);
  for (const line of box) console.log(line);
  console.log(gradientProgress(current, total));
}

// Will be set after platform selection
let step6Strings: StepStrings;

function mascot(ver: string): void {
  const P = chalk.hex('#786af4');
  const B = chalk.hex('#5b8eff');
  const W = chalk.hex('#c8c8ff');
  console.log('');
  console.log(`  ${P('   ▗▄▄▄▄▄▄▄▄▄▄▄▄▄▖')}`);
  console.log(`  ${P('   ▐')}${B('             ')}${P('▌')}`);
  console.log(`  ${P('   ▐')}${B('  ')}${W('██')}${B('     ')}${W('██')}${B('  ')}${P('▌')}    ${chalk.bold.hex('#786af4')('ConvoAI CLI')} v${ver}`);
  console.log(`  ${P('   ▐')}${B('    ')}${W('▀▀▀▀▀')}${B('    ')}${P('▌')}    Voice AI in 2 minutes`);
  console.log(`  ${P('   ▐')}${B('             ')}${P('▌')}    ${chalk.dim('Powered by Agora')}`);
  console.log(`  ${P('   ▝▀▀▀▀▀▀▀█▀▀▀▀▀▘')}`);
  console.log(`  ${P('            ▀▚')}`);
  console.log('');
}

// ─── LLM Provider Ordering ───────────────────────────────────────────────

const LLM_ORDER_CN = [
  'dashscope', 'deepseek', 'openai', 'groq', 'anthropic',
  'gemini', 'azure', 'bedrock', 'dify', 'custom',
];

const LLM_ORDER_EN = [
  'openai', 'groq', 'anthropic', 'gemini', 'dashscope',
  'deepseek', 'azure', 'bedrock', 'dify', 'custom',
];

const LLM_CN_NAMES: Record<string, string> = {
  dashscope: '阿里通义千问',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  groq: 'Groq',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  azure: 'Azure',
  bedrock: 'Bedrock',
  dify: 'Dify',
  custom: 'Custom',
};

function getOrderedLlmChoices(lang: 'cn' | 'global'): Array<{ name: string; value: string }> {
  const order = lang === 'cn' ? LLM_ORDER_CN : LLM_ORDER_EN;
  return order
    .map((value) => {
      const provider = LLM_PROVIDERS.find((p) => p.value === value);
      if (!provider) return null;
      let name = lang === 'cn' ? (LLM_CN_NAMES[value] ?? provider.name) : provider.name;
      if (provider.builtin) {
        name += lang === 'cn'
          ? chalk.green(' (内置，无需 API Key)')
          : chalk.green(' (built-in, no API key needed)');
      }
      return { name, value: provider.value };
    })
    .filter((c): c is { name: string; value: string } => c !== null);
}

// ─── Main Action ───────────────────────────────────────────────────────────

async function quickstartAction(): Promise<void> {
  // Graceful exit on Ctrl+C during prompts
  process.on('SIGINT', () => {
    console.log('\n');
    console.log(chalk.dim('  Interrupted. Run `convoai quickstart` to resume.'));
    process.exit(0);
  });

  const { default: inquirer } = await import('inquirer');

  // Read version for mascot (walk up to find convoai's package.json)
  let ver = 'unknown';
  let verDir = __dirname;
  for (let i = 0; i < 5; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(verDir, 'package.json'), 'utf-8'));
      if (pkg.name === 'convoai') { ver = pkg.version ?? ver; break; }
    } catch { /* keep searching */ }
    verDir = dirname(verDir);
  }

  // Mascot first, then welcome box
  mascot(ver);

  track('qs_start');

  // ═══════════════════════════════════════════════════════════════════════
  // Platform choice FIRST — determines language for all subsequent text
  // ═══════════════════════════════════════════════════════════════════════

  let config = loadConfig();

  const welcomeStrings = getStrings('global').welcome;
  for (const line of gradientBox({
    emoji: '👋',
    title: welcomeStrings.title,
    subtitle: welcomeStrings.subtitle,
  })) console.log(line);

  const { platform } = await inquirer.prompt([
    {
      type: 'list',
      name: 'platform',
      message: 'Choose your platform:',
      choices: [
        { name: 'Shengwang.cn', value: 'cn' },
        { name: 'Agora.io (Global)', value: 'global' },
      ],
      default: config.region ?? 'cn',
    },
  ]);

  const lang = platform as 'cn' | 'global';
  const str = getStrings(lang);
  step6Strings = str.step6;

  config.region = platform;
  saveConfig(config);

  const TOTAL_STEPS = 6;
  const needsConfig = !config.app_id || !config.customer_id || !config.customer_secret || !config.app_certificate;

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Agora Credentials
  // ═══════════════════════════════════════════════════════════════════════
  console.log('');
  showStep(str.step1, 1, TOTAL_STEPS);

  if (needsConfig) {
    let credentialsValid = false;

    while (!credentialsValid) {
      const consoleUrl = platform === 'cn' ? 'console.shengwang.cn' : 'console.agora.io';
      const overviewHint = platform === 'cn' ? '总览 → 项目信息' : 'Overview → Project Info';
      const restHint = platform === 'cn' ? 'Developer Toolkit → RESTful API → 添加密钥 → 下载' : 'Developer Toolkit → RESTful API → Add Secret → Download';

      const creds = await inquirer.prompt([
        {
          type: 'input',
          name: 'appId',
          message: `${str.appId} ${chalk.dim(`(${consoleUrl} → ${overviewHint})`)}:`,
          default: config.app_id,
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
        {
          type: 'password',
          name: 'appCertificate',
          message: `${str.appCert} ${chalk.dim(`(${overviewHint})`)}:`,
          mask: '*',
          default: config.app_certificate,
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
        {
          type: 'input',
          name: 'customerId',
          message: `${str.customerId} ${chalk.dim(`(${restHint})`)}:`,
          default: config.customer_id,
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
        {
          type: 'password',
          name: 'customerSecret',
          message: `${str.customerSecret} ${chalk.dim(`(${restHint})`)}:`,
          mask: '*',
          default: config.customer_secret,
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
      ]);

      config.app_id = creds.appId;
      config.app_certificate = creds.appCertificate;
      config.customer_id = creds.customerId;
      config.customer_secret = creds.customerSecret;

      // Validate credentials immediately
      try {
        const testClient = createClient({
          appId: config.app_id!,
          customerId: config.customer_id!,
          customerSecret: config.customer_secret!,
          region: config.region as 'global' | 'cn' | undefined,
        });
        const testApi = new AgentAPI(testClient);
        await withSpinner(
          lang === 'cn' ? '正在验证凭证...' : 'Validating credentials...',
          () => testApi.list({ limit: 1 }),
        );
        saveConfig(config);
        credentialsValid = true;
        printSuccess(str.credentialsSaved);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('401')) {
          printError(lang === 'cn'
            ? '凭证验证失败 — Customer ID 或 Customer Secret 不正确，请重新输入'
            : 'Credential validation failed — Customer ID or Secret is incorrect. Please re-enter.');
        } else if (msg.includes('400') || msg.includes('appid')) {
          printError(lang === 'cn'
            ? '凭证验证失败 — App ID 无效，请检查后重新输入'
            : 'Credential validation failed — App ID is invalid. Please re-enter.');
        } else {
          printError(lang === 'cn'
            ? `凭证验证失败: ${msg}，请重新输入`
            : `Credential validation failed: ${msg}. Please re-enter.`);
        }
        // Loop back — defaults will show what user just entered
      }
    }
    track('qs_step1');
  } else {
    // Credentials exist — validate them before proceeding
    try {
      const testClient = createClient({
        appId: config.app_id!,
        customerId: config.customer_id!,
        customerSecret: config.customer_secret!,
        region: config.region as 'global' | 'cn' | undefined,
      });
      const testApi = new AgentAPI(testClient);
      await withSpinner(
        lang === 'cn' ? '正在验证凭证...' : 'Validating credentials...',
        () => testApi.list({ limit: 1 }),
      );
      printSuccess(`${str.alreadyConfigured} (App ID: ${config.app_id!.slice(0, 8)}...)`);
    } catch {
      // Existing credentials are invalid — enter retry loop
      printError(lang === 'cn'
        ? '已保存的凭证无效，请重新输入'
        : 'Saved credentials are invalid. Please re-enter.');

      let credentialsValid = false;
      while (!credentialsValid) {
        const consoleUrl = platform === 'cn' ? 'console.shengwang.cn' : 'console.agora.io';
        const overviewHint = platform === 'cn' ? '总览 → 项目信息' : 'Overview → Project Info';
        const restHint = platform === 'cn' ? 'Developer Toolkit → RESTful API → 添加密钥 → 下载' : 'Developer Toolkit → RESTful API → Add Secret → Download';

        const creds = await inquirer.prompt([
          { type: 'input', name: 'appId', message: `${str.appId}:`, default: config.app_id, validate: (v: string) => v.trim().length > 0 || 'Required' },
          { type: 'password', name: 'appCertificate', message: `${str.appCert}:`, mask: '*', default: config.app_certificate, validate: (v: string) => v.trim().length > 0 || 'Required' },
          { type: 'input', name: 'customerId', message: `${str.customerId} ${chalk.dim(`(${restHint})`)}:`, default: config.customer_id, validate: (v: string) => v.trim().length > 0 || 'Required' },
          { type: 'password', name: 'customerSecret', message: `${str.customerSecret}:`, mask: '*', default: config.customer_secret, validate: (v: string) => v.trim().length > 0 || 'Required' },
        ]);

        config.app_id = creds.appId;
        config.app_certificate = creds.appCertificate;
        config.customer_id = creds.customerId;
        config.customer_secret = creds.customerSecret;

        try {
          const retryClient = createClient({ appId: config.app_id!, customerId: config.customer_id!, customerSecret: config.customer_secret!, region: config.region as 'global' | 'cn' | undefined });
          const retryApi = new AgentAPI(retryClient);
          await withSpinner(lang === 'cn' ? '正在验证凭证...' : 'Validating credentials...', () => retryApi.list({ limit: 1 }));
          saveConfig(config);
          credentialsValid = true;
          printSuccess(str.credentialsSaved);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          printError(lang === 'cn' ? `凭证验证失败: ${msg}，请重新输入` : `Validation failed: ${msg}. Please re-enter.`);
        }
      }
    }
    track('qs_step1');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: ASR Setup (was step 4 in old version)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('');
  showStep(str.step2, 2, TOTAL_STEPS);

  if (!config.profiles) config.profiles = {};
  if (!config.default_profile) config.default_profile = 'default';
  const profile = config.profiles['default'] ?? {};

  const hasAsr = profile.asr?.vendor;

  if (!hasAsr) {
    // Build ASR provider choices
    const asrChoices = ASR_PROVIDERS.map((p) => {
      let label = p.name;
      if (p.vendor === 'ares') label += chalk.dim(` — ${str.asrRecommend}`);
      else if (p.note) label += chalk.dim(` — ${p.note}`);
      if (p.beta) label += chalk.dim(' (Beta)');
      return { name: label, value: p.vendor };
    });

    const { vendor: asrVendor } = await inquirer.prompt([
      {
        type: 'list',
        name: 'vendor',
        message: str.asrProvider + ':',
        choices: asrChoices,
        default: 'ares',
      },
    ]);

    const selectedAsr = ASR_PROVIDERS.find((p) => p.vendor === asrVendor)!;

    // API Key — not needed for ARES
    let asrKey: string | undefined;
    if (asrVendor !== 'ares') {
      const { key } = await inquirer.prompt([
        {
          type: 'password',
          name: 'key',
          message: str.apiKey + ':',
          mask: '*',
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
      ]);
      asrKey = key;
    }

    // Microsoft ASR needs region
    let asrRegion: string | undefined;
    if (selectedAsr.requiresRegion) {
      const { region } = await inquirer.prompt([
        {
          type: 'input',
          name: 'region',
          message: 'Azure ASR Region:',
          default: 'eastus',
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
      ]);
      asrRegion = region;
    }

    // Language selection
    const defaultLang = lang === 'cn' ? 'zh-CN' : 'en-US';
    const langChoices = ASR_LANGUAGES.map((l) => ({ name: l.name, value: l.value }));

    const { language: asrLanguage } = await inquirer.prompt([
      {
        type: 'list',
        name: 'language',
        message: str.language + ':',
        choices: langChoices,
        default: defaultLang,
      },
    ]);

    // Build ASR config
    if (asrVendor === 'ares') {
      profile.asr = {
        vendor: 'ares',
        language: asrLanguage,
      };
    } else {
      const asrParams: Record<string, unknown> = { key: asrKey };
      if (asrRegion) asrParams.region = asrRegion;
      if (asrLanguage) asrParams.language = asrLanguage;
      // Auto-fill vendor defaults (url, model, etc.)
      if (selectedAsr.defaultParams) {
        for (const [k, v] of Object.entries(selectedAsr.defaultParams)) {
          if (!(k in asrParams)) asrParams[k] = v;
        }
      }
      profile.asr = {
        vendor: asrVendor,
        language: asrLanguage,
        params: asrParams,
      };
    }

    config.profiles['default'] = profile;
    saveConfig(config);
    printSuccess(`${str.asrConfigured}: ${asrVendor} (${asrLanguage})`);
    track('qs_step2');
  } else {
    printSuccess(`${str.asrConfigured}: ${profile.asr!.vendor} (${profile.asr!.language ?? 'default'})`);
    track('qs_step2');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: LLM Setup (was step 2 in old version)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('');
  showStep(str.step3, 3, TOTAL_STEPS);

  const hasLlm = profile.llm?.url && (profile.llm?.api_key || profile.llm?.url?.includes('key='));

  if (!hasLlm) {
    // Build LLM provider choices — ordered by language, names only (no descriptions)
    const llmChoices = getOrderedLlmChoices(lang);

    const { provider: llmProvider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: str.llmProvider + ':',
        choices: llmChoices,
      },
    ]);

    const selectedLlm = LLM_PROVIDERS.find((p) => p.value === llmProvider)!;

    let llmApiKey: string;
    if (selectedLlm.builtin) {
      llmApiKey = '__embedded__';
      printSuccess(lang === 'cn' ? '使用内置 API Key' : 'Using built-in API key');
    } else {
      // API Key — allow skip (empty = skip this step)
      const skipHint = platform === 'cn' ? '留空跳过此步骤' : 'Leave empty to skip';
      const { apiKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: `${str.apiKey} ${chalk.dim(`(${skipHint})`)}:`,
          mask: '*',
        },
      ]);
      llmApiKey = apiKey;
    }

    if (!llmApiKey) {
      printSuccess(lang === 'cn'
        ? '已跳过 LLM 配置。配置完成后运行 convoai go --setup 补全 LLM 和 TTS。'
        : 'LLM skipped. Run convoai go --setup to configure LLM and TTS later.');
      saveConfig(config);
      track('qs_step3');
      console.log('');
      console.log(chalk.bold(lang === 'cn' ? '  下一步:' : '  Next:'));
      console.log(chalk.cyan('    convoai go --setup'));
      console.log('');
      return; // Don't proceed to TTS/agent without LLM
    } else {

    // Model — list if provider has models, otherwise free input
    let llmModel: string;
    if (selectedLlm.models.length > 0) {
      const { model } = await inquirer.prompt([
        {
          type: 'list',
          name: 'model',
          message: str.model + ':',
          choices: selectedLlm.models,
          default: selectedLlm.defaultModel,
        },
      ]);
      llmModel = model;
    } else {
      const { model } = await inquirer.prompt([
        {
          type: 'input',
          name: 'model',
          message: str.model + ':',
          default: selectedLlm.defaultModel || undefined,
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
      ]);
      llmModel = model;
    }

    // URL — use provider default or prompt
    let llmUrl: string;
    if (selectedLlm.url) {
      const { url } = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'API URL:',
          default: selectedLlm.url,
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
      ]);
      llmUrl = url;
    } else {
      const { url } = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'API URL:',
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
      ]);
      llmUrl = url;
    }

    // Build LLM config based on provider style
    const llmConfig: LLMConfig = {};

    if (selectedLlm.style === 'gemini') {
      // Gemini: key is embedded in the URL template
      const resolvedUrl = llmUrl
        .replace('{model}', llmModel)
        .replace('{api_key}', llmApiKey);
      llmConfig.url = resolvedUrl;
      llmConfig.style = 'gemini';
      llmConfig.system_messages = [
        { parts: [{ text: 'You are a friendly AI voice assistant. Please respond concisely.' }], role: 'user' },
      ];
      llmConfig.params = {
        model: llmModel,
        max_tokens: 512,
        temperature: 0.7,
      };
    } else if (selectedLlm.style === 'anthropic') {
      // Anthropic: add style + headers
      llmConfig.url = llmUrl;
      llmConfig.api_key = llmApiKey;
      llmConfig.style = 'anthropic';
      llmConfig.headers = '{"anthropic-version":"2023-06-01"}';
      llmConfig.system_messages = [
        { role: 'system', content: 'You are a friendly AI voice assistant. Please respond concisely.' },
      ];
      llmConfig.params = {
        model: llmModel,
        max_tokens: 512,
        temperature: 0.7,
      };
    } else {
      // Normal providers: dashscope, deepseek, openai, groq, azure, bedrock, dify, custom
      llmConfig.url = llmUrl;
      llmConfig.api_key = llmApiKey;
      llmConfig.system_messages = [
        { role: 'system', content: 'You are a friendly AI voice assistant. Please respond concisely.' },
      ];
      llmConfig.params = {
        model: llmModel,
        max_tokens: 512,
        temperature: 0.7,
      };
    }

    profile.llm = llmConfig;
    config.profiles['default'] = profile;
    saveConfig(config);
    printSuccess(`${str.llmConfigured}: ${llmModel} via ${selectedLlm.name}`);
    track('qs_step3');
    } // close the else (API key not skipped)
  } else {
    const model = profile.llm?.params?.model ?? profile.llm?.model ?? 'unknown';
    printSuccess(`${str.llmConfigured}: ${model}`);
    track('qs_step3');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: TTS Setup (was step 3 in old version)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('');
  showStep(str.step4, 4, TOTAL_STEPS);

  const hasTts = profile.tts?.vendor;

  if (!hasTts) {
    // Build TTS provider choices
    const ttsChoices = TTS_PROVIDERS.map((p) => {
      let label = p.name;
      if (p.builtin) {
        label += lang === 'cn'
          ? chalk.green(' (内置，无需 API Key)')
          : chalk.green(' (built-in, no API key needed)');
      } else if (p.beta) {
        label += chalk.dim(' (Beta)');
      }
      return { name: label, value: p.vendor };
    });

    const { vendor: ttsVendor } = await inquirer.prompt([
      {
        type: 'list',
        name: 'vendor',
        message: str.ttsProvider + ':',
        choices: ttsChoices,
      },
    ]);

    const selectedTts = TTS_PROVIDERS.find((p) => p.vendor === ttsVendor)!;

    let ttsKey: string;
    if (selectedTts.builtin) {
      ttsKey = '__embedded__';
      printSuccess(lang === 'cn' ? '使用内置 API Key' : 'Using built-in API key');
    } else {
      const { key } = await inquirer.prompt([
        {
          type: 'password',
          name: 'key',
          message: str.ttsApiKey + ':',
          mask: '*',
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
      ]);
      ttsKey = key;
    }

    const ttsParams: Record<string, unknown> = { key: ttsKey };

    // Microsoft-specific: region + voice name
    if (ttsVendor === 'microsoft') {
      const msAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'region',
          message: 'Azure TTS Region:',
          default: 'eastus',
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
        {
          type: 'input',
          name: 'voiceName',
          message: 'Voice Name:',
          default: 'en-US-AndrewMultilingualNeural',
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
      ]);
      ttsParams.region = msAnswers.region;
      ttsParams.voice_name = msAnswers.voiceName;
    }

    // MiniMax-specific: group_id
    if (selectedTts.requiresGroupId && !selectedTts.builtin) {
      const { groupId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'groupId',
          message: str.groupId + ':',
          validate: (v: string) => v.trim().length > 0 || 'Required — find it at minimax.chat console',
        },
      ]);
      ttsParams.group_id = groupId;
    }

    // OpenAI TTS uses api_key instead of key
    if (ttsVendor === 'openai') {
      ttsParams.api_key = ttsParams.key;
      delete ttsParams.key;
    }

    // Cartesia uses api_key instead of key
    if (ttsVendor === 'cartesia') {
      ttsParams.api_key = ttsParams.key;
      delete ttsParams.key;
    }

    // Auto-fill vendor defaults (base_url, model, voice, etc.)
    if (selectedTts.defaultParams) {
      for (const [k, v] of Object.entries(selectedTts.defaultParams)) {
        if (!(k in ttsParams)) { // don't override user-provided values
          ttsParams[k] = v;
        }
      }
    }

    profile.tts = {
      vendor: ttsVendor,
      params: ttsParams,
    };
    config.profiles['default'] = profile;
    saveConfig(config);
    printSuccess(`${str.ttsConfigured}: ${selectedTts.name}`);
    track('qs_step4');
  } else {
    printSuccess(`${str.ttsConfigured}: ${profile.tts!.vendor}`);
    track('qs_step4');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 5: Start agent & voice chat
  // ═══════════════════════════════════════════════════════════════════════
  console.log('');
  showStep(str.step5, 5, TOTAL_STEPS);

  // Detect OpenClaw
  let hasOpenClaw = false;
  try {
    const { execSync: exec } = await import('node:child_process');
    exec('which openclaw', { stdio: 'ignore' });
    hasOpenClaw = true;
  } catch { /* not installed */ }

  // Always offer mode choice
  const modeChoices = [
    { name: lang === 'cn' ? '🎙 语音对话 (浏览器)' : '🎙 Voice chat (browser)', value: 'voice' },
    { name: lang === 'cn' ? '📞 打电话' : '📞 Make a phone call', value: 'phone' },
  ];
  if (hasOpenClaw) {
    modeChoices.push({ name: '🦞 OpenClaw voice mode', value: 'openclaw' });
  }

  const { mode } = await inquirer.prompt([{
    type: 'list', name: 'mode',
    message: lang === 'cn' ? '选择体验方式:' : 'How to experience?',
    choices: modeChoices,
  }]);

  if (mode === 'openclaw') {
    printSuccess('Launching OpenClaw voice mode...');
    track('qs_openclaw');
    const { execSync: exec } = await import('node:child_process');
    const convoaiBin = process.argv[1];
    exec(`node ${convoaiBin} openclaw`, { stdio: 'inherit' });
    process.exit(0);
  }

  if (mode === 'phone') {
    // Phone call flow
    try {
      const { getCallAPI, getNumberAPI, getConfig, validateE164, pickOutboundNumber } = await import('./phone/_helpers.js');
      const { generateRtcToken } = await import('../utils/token.js');

      const numberApi = getNumberAPI();
      const callApi = getCallAPI();
      let numbers = await numberApi.list();

      if (numbers.length === 0) {
        printHint(lang === 'cn' ? '没有电话号码，请先导入' : 'No phone numbers. Import one first.');
        printHint('convoai phone import');
        process.exit(0);
      }

      const picked = await pickOutboundNumber(numbers);

      const { to } = await inquirer.prompt([{
        type: 'input', name: 'to',
        message: lang === 'cn' ? '拨打号码 (E.164):' : 'To number (E.164):',
        validate: (v: string) => /^\+[1-9]\d{1,14}$/.test(v.trim()) || 'Invalid E.164',
      }]);

      const channelName = `qs-call-${Date.now().toString(36)}`;
      const appCert = process.env.AGORA_APP_CERTIFICATE ?? config.app_certificate;
      const agentToken = await generateRtcToken(channelName, 0, 86400, config.app_id, appCert);
      const sipToken = await generateRtcToken(channelName, 1, 86400, config.app_id, appCert);

      if (!agentToken || !sipToken) {
        printError(lang === 'cn' ? 'Token 生成失败' : 'Token generation failed');
        process.exit(1);
      }

      const llm: Record<string, unknown> = { ...(profile.llm ?? {}) };
      const request = {
        name: `qs-call-${Date.now()}`,
        sip: { to_number: validateE164(to), from_number: picked.phone_number, rtc_uid: '1', rtc_token: sipToken },
        properties: {
          channel: channelName, token: agentToken, agent_rtc_uid: '0', remote_rtc_uids: ['1'],
          idle_timeout: 600, llm, tts: profile.tts ?? {}, asr: profile.asr ?? {},
        },
      };

      const result = await withSpinner(lang === 'cn' ? '正在拨号...' : 'Calling...', () => callApi.send(request));
      printSuccess(`${lang === 'cn' ? '呼叫已发起' : 'Call initiated'} (${result.agent_id})`);
      track('qs_step5_phone');

      // Wait for call to finish
      const { default: ora } = await import('ora');
      const spinner = ora(lang === 'cn' ? '通话中...' : 'In call...').start();
      const startTime = Date.now();
      const maxMs = 10 * 60 * 1000;

      while (Date.now() - startTime < maxMs) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const status = await callApi.status(result.agent_id);
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const mm = String(Math.floor(elapsed / 60));
          const ss = String(elapsed % 60).padStart(2, '0');
          spinner.text = `${lang === 'cn' ? '通话中' : 'In call'} (${mm}:${ss})`;
          if (status.status === 'STOPPED' || status.status === 'FAILED') break;
        } catch { /* ignore */ }
      }

      const totalSec = Math.floor((Date.now() - startTime) / 1000);
      spinner.succeed(`${lang === 'cn' ? '通话结束' : 'Call ended'} (${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')})`);
      process.exit(0);
    } catch (err) {
      handleError(err);
      process.exit(1);
    }
  }

  // mode === 'voice': continue with existing voice chat flow below

  const client = createClient({
    appId: config.app_id!,
    customerId: config.customer_id!,
    customerSecret: config.customer_secret!,
    region: config.region as 'global' | 'cn' | undefined,
  });
  const api = new AgentAPI(client);

  // Verify credentials (should already be validated in Step 1, but just in case)
  try {
    await withSpinner(str.verifying, () => api.list({ limit: 1 }));
    printSuccess(str.verified);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    printError(lang === 'cn' ? `凭证验证失败: ${msg}` : `Credential check failed: ${msg}`);
    printHint(lang === 'cn' ? '运行 convoai quickstart 重新配置' : 'Run `convoai quickstart` to reconfigure.');
    process.exit(1);
  }

  const channelName = `quickstart-${Date.now().toString(36)}`;
  const agentUid = 0;
  const clientUid = 12345;

  const agentToken = await generateRtcToken(channelName, agentUid);
  const clientToken = await generateRtcToken(channelName, clientUid);

  if (!agentToken || !clientToken) {
    printError('Token generation failed. Check app_certificate.');
    process.exit(1);
  }

  // Auto-generate greeting based on ASR language
  const asrLang = profile.asr?.language ?? 'en-US';
  const greeting = getGreeting(asrLang);

  // Build request from config
  const llmWithGreeting: Record<string, unknown> = { ...profile.llm };
  if (greeting) {
    llmWithGreeting.greeting_message = greeting;
  }

  const request: StartAgentRequest = {
    name: `qs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    properties: {
      channel: channelName,
      token: agentToken,
      agent_rtc_uid: String(agentUid),
      remote_rtc_uids: ['*'],
      idle_timeout: 600,
      llm: llmWithGreeting as typeof profile.llm,
      tts: profile.tts,
      asr: profile.asr,
      parameters: {
        enable_metrics: true,
      },
    },
  };

  let result;
  try {
    result = await withSpinner(str.starting, () => api.start(request));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    track('error', { error_type: 'agent_start_failed' });

    // Check if it's a credential/appid error
    if (msg.includes('appid') || msg.includes('401') || msg.includes('allocate failed')) {
      printError(lang === 'cn'
        ? `启动失败: ${msg}`
        : `Agent start failed: ${msg}`);
      printHint(lang === 'cn'
        ? '凭证可能有误，运行 convoai quickstart 重新配置'
        : 'Credentials may be wrong. Run `convoai quickstart` to reconfigure.');
      process.exit(1);
    }
    throw err;
  }

  printSuccess(str.agentLive);
  track('qs_step5_agent');
  printKeyValue([
    ['Agent ID', result.agent_id],
    ['Channel', channelName],
  ]);

  // Start local server
  const port = 3210;
  const htmlPath = findClientHtml();
  const html = readFileSync(htmlPath, 'utf-8');
  const server = createServer(createWebHandler(html));
  await new Promise<void>((resolve, reject) => {
    server.listen(port, () => resolve());
    server.on('error', reject);
  });

  const params = new URLSearchParams({
    appId: config.app_id!,
    channel: channelName,
    token: clientToken,
    uid: String(clientUid),
  });
  const url = `http://localhost:${port}?${params}`;

  try {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    execSync(`${cmd} "${url}"`);
  } catch { /* */ }
  track('qs_step5_voice');

  console.log('');
  console.log(chalk.green.bold(`  ${str.voiceLive}`));
  console.log(chalk.dim(`  ${str.browserHint}`));
  console.log('');

  // Hand off to the runtime control panel (handles status display, key
  // interaction, and the session report on exit).
  await runPanel({
    api,
    agentId: result.agent_id,
    channel: channelName,
    lang: platform,
    config: profile,
    onExit: async () => {
      server.close();
      try { await api.stop(result.agent_id); } catch {}
    },
  });
}
