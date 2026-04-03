import { Command } from 'commander';
import { createServer as createHttpServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import type { StartAgentRequest, LLMConfig, ProfileConfig } from '../api/types.js';
import { resolveConfig, loadConfig, saveConfig } from '../config/manager.js';
import { getAgentAPI } from './agent/_helpers.js';
import { runPanel } from './agent/panel.js';
import { generateRtcToken } from '../utils/token.js';
import { findChrome } from '../utils/find-chrome.js';
import { withSpinner } from '../ui/spinner.js';
import { printSuccess, printError, printHint } from '../ui/output.js';
import { printKeyValue } from '../ui/table.js';
import { handleError } from '../utils/errors.js';
import { track } from '../utils/telemetry.js';
import { getStrings } from '../ui/i18n.js';
import {
  LLM_PROVIDERS,
  TTS_PROVIDERS,
  ASR_PROVIDERS,
  ASR_LANGUAGES,
} from '../providers/catalog.js';
import type { LLMProvider } from '../providers/catalog.js';

// ─── __dirname for ESM ──────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Greeting by Language ───────────────────────────────────────────────────

const GREETINGS: Record<string, string> = {
  'zh-CN': '\u4F60\u597D\uFF0C\u6211\u662F\u58F0\u7F51 ConvoAI \u8BED\u97F3\u52A9\u624B\uFF0C\u6709\u4EC0\u4E48\u53EF\u4EE5\u5E2E\u4F60\u7684\u5417\uFF1F',
  'zh-HK': '\u4F60\u597D\uFF0C\u6211\u662F\u8072\u7DB2 ConvoAI \u8A9E\u97F3\u52A9\u624B\uFF0C\u6709\u4EC0\u9EBC\u53EF\u4EE5\u5E6B\u4F60\u7684\u55CE\uFF1F',
  'zh-TW': '\u4F60\u597D\uFF0C\u6211\u662F\u8072\u7DB2 ConvoAI \u8A9E\u97F3\u52A9\u624B\uFF0C\u6709\u4EC0\u9EBC\u53EF\u4EE5\u5E6B\u4F60\u7684\u55CE\uFF1F',
  'en-US': 'Hi, I\'m your Agora ConvoAI voice assistant. How can I help you?',
  'ja-JP': '\u3053\u3093\u306B\u3061\u306F\u3001Agora ConvoAI \u97F3\u58F0\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u3067\u3059\u3002\u4F55\u304B\u304A\u624B\u4F1D\u3044\u3067\u304D\u307E\u3059\u304B\uFF1F',
  'ko-KR': '\uC548\uB155\uD558\uC138\uC694, Agora ConvoAI \uC74C\uC131 \uC5B4\uC2DC\uC2A4\uD134\uD2B8\uC785\uB2C8\uB2E4. \uBB34\uC5C7\uC744 \uB3C4\uC640\uB4DC\uB9B4\uAE4C\uC694?',
};

function getGreeting(language: string): string {
  return GREETINGS[language] ?? GREETINGS['en-US'];
}

// ─── Locate HTML Clients ────────────────────────────────────────────────────

function findClientHtml(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'src', 'web', 'client.html');
    try {
      readFileSync(candidate);
      return candidate;
    } catch { /* keep looking */ }
    dir = dirname(dir);
  }
  throw new Error('Could not find web client HTML. Reinstall the package.');
}

function findChatClientHtml(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'src', 'web', 'chat-client.html');
    try {
      readFileSync(candidate);
      return candidate;
    } catch { /* keep looking */ }
    dir = dirname(dir);
  }
  throw new Error('Could not find chat-client.html. Reinstall the package.');
}

// ─── LLM Provider Ordering ─────────────────────────────────────────────────

const LLM_ORDER_CN = [
  'dashscope', 'deepseek', 'openai', 'groq', 'anthropic',
  'gemini', 'azure', 'bedrock', 'dify', 'custom',
];

const LLM_ORDER_EN = [
  'openai', 'groq', 'anthropic', 'gemini', 'dashscope',
  'deepseek', 'azure', 'bedrock', 'dify', 'custom',
];

const LLM_CN_NAMES: Record<string, string> = {
  dashscope: '\u963F\u91CC\u901A\u4E49\u5343\u95EE',
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
      const name = lang === 'cn' ? (LLM_CN_NAMES[value] ?? provider.name) : provider.name;
      return { name, value: provider.value };
    })
    .filter((c): c is { name: string; value: string } => c !== null);
}

// ─── Command Registration ───────────────────────────────────────────────────

export function registerGo(program: Command): void {
  program
    .command('go')
    .description('Start a voice conversation (uses last config)')
    .option('-c, --channel <name>', 'Override channel name')
    .option('--setup', 'Re-configure ASR/LLM/TTS before starting')
    .option('--model <model>', 'One-time model override')
    .option('--tts <vendor>', 'One-time TTS override')
    .option('--asr <vendor>', 'One-time ASR override')
    .option('--browser', 'Force browser mode')
    .option('--profile <name>', 'Config profile')
    .action(async (opts) => {
      try {
        await goAction(opts);
      } catch (error) {
        handleError(error);
      }
    });
}

// ─── Action ─────────────────────────────────────────────────────────────────

async function goAction(opts: {
  channel?: string;
  setup?: boolean;
  model?: string;
  tts?: string;
  asr?: string;
  browser?: boolean;
  profile?: string;
}): Promise<void> {

  // ═════════════════════════════════════════════════════════════════════════
  // Step 1: Validate config
  // ═════════════════════════════════════════════════════════════════════════

  const config = resolveConfig(opts.profile);
  const configObj = loadConfig();
  const profileName = opts.profile ?? configObj.default_profile ?? 'default';
  const profile: ProfileConfig = configObj.profiles?.[profileName] ?? {};

  const lang: 'cn' | 'global' = config.region === 'cn' ? 'cn' : 'global';
  const str = getStrings(lang);

  // Check Agora credentials
  if (!config.app_id || !config.customer_id || !config.customer_secret) {
    printError(lang === 'cn'
      ? '\u672A\u914D\u7F6E Agora \u51ED\u8BC1\u3002'
      : 'No Agora credentials configured.');
    printHint(lang === 'cn'
      ? '\u8FD0\u884C: convoai quickstart'
      : 'Run: convoai quickstart');
    process.exit(1);
  }

  // Check App Certificate
  if (!configObj.app_certificate && !process.env.AGORA_APP_CERTIFICATE) {
    printError(lang === 'cn'
      ? '\u672A\u914D\u7F6E App Certificate\u3002'
      : 'No App Certificate configured.');
    printHint(lang === 'cn'
      ? '\u8FD0\u884C: convoai config set app_certificate <cert>'
      : 'Run: convoai config set app_certificate <cert>');
    process.exit(1);
  }

  // Check LLM
  if (!profile.llm?.url && !profile.llm?.api_key && !config.llm?.url && !config.llm?.api_key) {
    printError(lang === 'cn'
      ? '\u672A\u914D\u7F6E LLM\u3002'
      : 'No LLM configured.');
    printHint(lang === 'cn'
      ? '\u8FD0\u884C: convoai go --setup'
      : 'Run: convoai go --setup');
    process.exit(1);
  }

  // Check TTS
  if (!profile.tts?.vendor && !config.tts?.vendor) {
    printError(lang === 'cn'
      ? '\u672A\u914D\u7F6E TTS\u3002'
      : 'No TTS configured.');
    printHint(lang === 'cn'
      ? '\u8FD0\u884C: convoai go --setup'
      : 'Run: convoai go --setup');
    process.exit(1);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Step 2: --setup mode (optional inline config)
  // ═════════════════════════════════════════════════════════════════════════

  if (opts.setup) {
    await runSetupFlow(configObj, profileName, lang, str);
    // Reload config after setup
    const updatedConfig = loadConfig();
    const updatedProfile = updatedConfig.profiles?.[profileName] ?? {};
    Object.assign(profile, updatedProfile);
    Object.assign(config, resolveConfig(opts.profile));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Step 3: Apply one-time overrides (not saved to config)
  // ═════════════════════════════════════════════════════════════════════════

  // Work with a mutable copy for overrides
  const effectiveLlm: Partial<LLMConfig> = { ...config.llm };
  const effectiveTts: ProfileConfig['tts'] = { ...config.tts };
  const effectiveAsr: ProfileConfig['asr'] = { ...config.asr };

  if (opts.model) {
    if (!effectiveLlm.params) effectiveLlm.params = {};
    effectiveLlm.params.model = opts.model;
  }

  if (opts.tts) {
    effectiveTts!.vendor = opts.tts;
  }

  if (opts.asr) {
    effectiveAsr!.vendor = opts.asr;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Step 4: Cleanup leftover agents + ports
  // ═════════════════════════════════════════════════════════════════════════

  // Kill leftover processes on ports 3210 and 3211
  try {
    execSync('lsof -ti:3210,3211 | xargs kill -9 2>/dev/null', { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 300));
  } catch { /* no leftover processes */ }

  // Stop any running agents
  const api = getAgentAPI(opts.profile);
  try {
    const existing = await api.list({ state: 2, limit: 10 });
    if (existing.data.list.length > 0) {
      await withSpinner(
        lang === 'cn'
          ? `\u6B63\u5728\u6E05\u7406 ${existing.data.list.length} \u4E2A\u6B8B\u7559 Agent...`
          : `Cleaning up ${existing.data.list.length} leftover agent(s)...`,
        async () => {
          for (const a of existing.data.list) {
            try { await api.stop(a.agent_id); } catch { /* */ }
          }
        },
      );
    }
  } catch { /* */ }

  // ═════════════════════════════════════════════════════════════════════════
  // Step 5: Generate channel + tokens
  // ═════════════════════════════════════════════════════════════════════════

  const channelName = opts.channel ?? `go-${Date.now().toString(36)}`;
  const agentUid = 0;
  const clientUid = 12345;

  const agentToken = await generateRtcToken(channelName, agentUid);
  const clientToken = await generateRtcToken(channelName, clientUid);

  if (!agentToken) {
    printError(lang === 'cn'
      ? 'RTC Token \u751F\u6210\u5931\u8D25\u3002\u8BF7\u68C0\u67E5 app_certificate\u3002'
      : 'RTC token generation failed. Check app_certificate.');
    printHint(lang === 'cn'
      ? '\u8FD0\u884C: convoai config set app_certificate <cert>'
      : 'Run: convoai config set app_certificate <cert>');
    process.exit(1);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Step 6: Build agent request
  // ═════════════════════════════════════════════════════════════════════════

  // Auto-greeting based on ASR language
  const asrLang = effectiveAsr?.language ?? effectiveAsr?.params?.language ?? 'en-US';
  const greeting = getGreeting(asrLang as string);

  const llmForRequest: Record<string, unknown> = { ...effectiveLlm };
  llmForRequest.greeting_message = greeting;

  // ASR fallback: if no vendor configured, use ares/zh-CN
  const asrForRequest = effectiveAsr?.vendor
    ? effectiveAsr
    : { vendor: 'ares', language: 'zh-CN' };

  const request: StartAgentRequest = {
    name: `go-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    properties: {
      channel: channelName,
      token: agentToken,
      agent_rtc_uid: String(agentUid),
      remote_rtc_uids: ['*'],
      idle_timeout: 600,
      llm: llmForRequest as LLMConfig,
      tts: effectiveTts,
      asr: asrForRequest,
      turn_detection: {
        silence_duration_ms: 1000,
      },
      parameters: {
        data_channel: 'datastream',
        transcript: {
          enable: true,
          protocol_version: 'v2',
        },
        enable_metrics: true,
      },
    },
  };

  // ═════════════════════════════════════════════════════════════════════════
  // Step 7: Start agent
  // ═════════════════════════════════════════════════════════════════════════

  const result = await withSpinner(
    lang === 'cn' ? '\u6B63\u5728\u542F\u52A8 Agent...' : 'Starting agent...',
    () => api.start(request),
  );

  printSuccess(lang === 'cn' ? 'Agent \u5DF2\u542F\u52A8\u3002' : 'Agent started.');
  track('go');

  printKeyValue([
    ['Agent ID', result.agent_id],
    ['Channel', channelName],
    ['Status', result.status],
  ]);

  // ═════════════════════════════════════════════════════════════════════════
  // Step 8: Detect Chrome -> terminal or browser mode
  // ═════════════════════════════════════════════════════════════════════════

  const chromePath = findChrome();
  const useBrowser = opts.browser || !chromePath;

  let server: ReturnType<typeof createHttpServer>;
  let browser: { close(): Promise<void> } | null = null;

  if (!useBrowser && chromePath) {
    // ── Terminal mode: headless Chrome with audio ──────────────────────
    const htmlPath = findChatClientHtml();
    const html = readFileSync(htmlPath, 'utf-8');

    const httpPort = 3210;
    const wsPort = 3211;

    server = createHttpServer((_, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(httpPort, () => resolve());
      server.on('error', reject);
    });

    const wss = new WebSocketServer({ port: wsPort });

    // Launch puppeteer-core headless=false for audio support
    const puppeteer = await import('puppeteer-core');
    const launched = await puppeteer.default.launch({
      executablePath: chromePath,
      headless: false,
      args: [
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--no-sandbox',
        '--window-size=1,1',
        '--window-position=-2000,-2000',
        '--enable-features=WebRtcAecAudioProcessing',
      ],
    });
    browser = launched as unknown as { close(): Promise<void> };

    const page = await launched.newPage();
    const context = launched.defaultBrowserContext();
    await context.overridePermissions(`http://localhost:${httpPort}`, ['microphone']);

    const params = new URLSearchParams({
      appId: config.app_id!,
      channel: channelName,
      token: clientToken ?? '',
      uid: String(clientUid),
      wsPort: String(wsPort),
    });

    await page.goto(`http://localhost:${httpPort}?${params}`);

    // macOS: hide Chrome window and restore terminal focus
    if (process.platform === 'darwin') {
      try {
        execSync(`osascript -e 'tell application "System Events"
          set visible of process "Google Chrome" to false
        end tell' 2>/dev/null`, { stdio: 'ignore' });
        execSync(`osascript -e 'tell application "System Events"
          set frontProcess to first process whose frontmost is false and visible is true and name is not "Google Chrome"
          set frontmost of frontProcess to true
        end tell' 2>/dev/null`, { stdio: 'ignore' });
      } catch { /* osascript may fail, not critical */ }
    }

    console.log('');
    printSuccess(lang === 'cn'
      ? '\u8BED\u97F3\u5BF9\u8BDD\u5DF2\u5F00\u542F\uFF01\u76F4\u63A5\u5F00\u53E3\u8BF4\u8BDD\u5373\u53EF\u3002'
      : 'Voice chat is live! Start speaking.');
    console.log('');

    // ── Wire WebSocket transcript messages to panel state ──────────────
    // panelState will be shared with runPanel — transcript messages update it
    const { handleTranscriptMessage } = await import('./agent/panel.js');
    const panelState = {
      history: [] as any[], turns: [] as any[], inSubmenu: false, printedCount: 0,
      transcriptEntries: [] as any[], transcriptPrintedCount: 0,
      ephemeral: null as any, lastEphemeralText: '', hasLiveTranscript: false,
    };

    wss.on('connection', (ws) => {
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'transcript' && msg.data) {
            handleTranscriptMessage(panelState, msg.data);
          }
        } catch { /* ignore */ }
      });
    });

    // ── Enter panel ─────────────────────────────────────────────────────
    await runPanel({
      api,
      agentId: result.agent_id,
      channel: channelName,
      lang,
      config: profile,
      _sharedState: panelState,
      onExit: async () => {
        wss.close();
        server.close();
        if (browser) try { await browser.close(); } catch { /* */ }
        try { await api.stop(result.agent_id); } catch { /* */ }
      },
    });
  } else {
    // ── Browser mode: open client.html in default browser ──────────────
    const htmlPath = findClientHtml();
    const html = readFileSync(htmlPath, 'utf-8');
    const port = 3210;

    server = createHttpServer((_, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(port, () => resolve());
      server.on('error', reject);
    });

    const params = new URLSearchParams({
      appId: config.app_id!,
      channel: channelName,
      token: clientToken ?? '',
      uid: String(clientUid),
    });
    const url = `http://localhost:${port}?${params}`;

    console.log('');
    console.log(chalk.cyan('  Voice chat: ') + chalk.bold(url));
    console.log('');

    try {
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      execSync(`${cmd} "${url}"`);
      printSuccess(lang === 'cn'
        ? '\u6D4F\u89C8\u5668\u5DF2\u6253\u5F00\u3002\u5141\u8BB8\u9EA6\u514B\u98CE\u540E\u5F00\u59CB\u5BF9\u8BDD\uFF01'
        : 'Browser opened. Allow microphone and start talking!');
    } catch {
      console.log(chalk.dim(lang === 'cn'
        ? '  \u8BF7\u5728\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00\u4E0A\u65B9\u94FE\u63A5\u3002'
        : '  Open the URL above in your browser.'));
    }

    // ── Enter panel ─────────────────────────────────────────────────────
    await runPanel({
      api,
      agentId: result.agent_id,
      channel: channelName,
      lang,
      config: profile,
      onExit: async () => {
        server.close();
        try { await api.stop(result.agent_id); } catch { /* */ }
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// --setup flow: inline ASR/LLM/TTS configuration
// ═══════════════════════════════════════════════════════════════════════════

async function runSetupFlow(
  configObj: ReturnType<typeof loadConfig>,
  profileName: string,
  lang: 'cn' | 'global',
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const { default: inquirer } = await import('inquirer');

  if (!configObj.profiles) configObj.profiles = {};
  const profile = configObj.profiles[profileName] ?? {};

  // ── ASR ──────────────────────────────────────────────────────────────
  console.log('');
  console.log(chalk.bold(`  ${str.step2.emoji}  ${str.step2.title}`));
  console.log(chalk.dim(`  ${str.step2.subtitle}`));
  console.log('');

  const asrChoices = ASR_PROVIDERS.map((p) => {
    let label = p.name;
    if (p.vendor === 'ares') label += chalk.dim(` \u2014 ${str.asrRecommend}`);
    else if (p.note) label += chalk.dim(` \u2014 ${p.note}`);
    if (p.beta) label += chalk.dim(' (Beta)');
    return { name: label, value: p.vendor };
  });

  const { vendor: asrVendor } = await inquirer.prompt([
    {
      type: 'list',
      name: 'vendor',
      message: str.asrProvider + ':',
      choices: asrChoices,
      default: profile.asr?.vendor ?? 'ares',
    },
  ]);

  const selectedAsr = ASR_PROVIDERS.find((p) => p.vendor === asrVendor)!;

  // API Key (not needed for ARES)
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

  // Microsoft ASR region
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
      default: profile.asr?.language ?? defaultLang,
    },
  ]);

  // Build ASR config
  if (asrVendor === 'ares') {
    profile.asr = { vendor: 'ares', language: asrLanguage };
  } else {
    const asrParams: Record<string, unknown> = { key: asrKey };
    if (asrRegion) asrParams.region = asrRegion;
    if (asrLanguage) asrParams.language = asrLanguage;
    if (selectedAsr.defaultParams) {
      for (const [k, v] of Object.entries(selectedAsr.defaultParams)) {
        if (!(k in asrParams)) asrParams[k] = v;
      }
    }
    profile.asr = { vendor: asrVendor, language: asrLanguage, params: asrParams };
  }

  configObj.profiles[profileName] = profile;
  saveConfig(configObj);
  printSuccess(`${str.asrConfigured}: ${asrVendor} (${asrLanguage})`);

  // ── LLM ─────────────────────────────────────────────────────────────
  console.log('');
  console.log(chalk.bold(`  ${str.step3.emoji}  ${str.step3.title}`));
  console.log(chalk.dim(`  ${str.step3.subtitle}`));
  console.log('');

  const llmChoices = getOrderedLlmChoices(lang);

  const { provider: llmProvider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: str.llmProvider + ':',
      choices: llmChoices,
    },
  ]);

  const selectedLlm = LLM_PROVIDERS.find((p) => p.value === llmProvider) as LLMProvider;

  // API Key
  const { apiKey: llmApiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: str.apiKey + ':',
      mask: '*',
      validate: (v: string) => v.trim().length > 0 || 'Required',
    },
  ]);

  // Model
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

  // URL
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
    const resolvedUrl = llmUrl
      .replace('{model}', llmModel)
      .replace('{api_key}', llmApiKey);
    llmConfig.url = resolvedUrl;
    llmConfig.style = 'gemini';
    llmConfig.system_messages = [
      { parts: [{ text: 'You are a friendly AI voice assistant. Please respond concisely.' }], role: 'user' },
    ];
    llmConfig.params = { model: llmModel, max_tokens: 512, temperature: 0.7 };
  } else if (selectedLlm.style === 'anthropic') {
    llmConfig.url = llmUrl;
    llmConfig.api_key = llmApiKey;
    llmConfig.style = 'anthropic';
    llmConfig.headers = '{"anthropic-version":"2023-06-01"}';
    llmConfig.system_messages = [
      { role: 'system', content: 'You are a friendly AI voice assistant. Please respond concisely.' },
    ];
    llmConfig.params = { model: llmModel, max_tokens: 512, temperature: 0.7 };
  } else {
    llmConfig.url = llmUrl;
    llmConfig.api_key = llmApiKey;
    llmConfig.system_messages = [
      { role: 'system', content: 'You are a friendly AI voice assistant. Please respond concisely.' },
    ];
    llmConfig.params = { model: llmModel, max_tokens: 512, temperature: 0.7 };
  }

  profile.llm = llmConfig;
  configObj.profiles[profileName] = profile;
  saveConfig(configObj);
  printSuccess(`${str.llmConfigured}: ${llmModel} via ${selectedLlm.name}`);

  // ── TTS ─────────────────────────────────────────────────────────────
  console.log('');
  console.log(chalk.bold(`  ${str.step4.emoji}  ${str.step4.title}`));
  console.log(chalk.dim(`  ${str.step4.subtitle}`));
  console.log('');

  const ttsChoices = TTS_PROVIDERS.map((p) => {
    let label = p.name;
    if (p.beta) label += chalk.dim(' (Beta)');
    return { name: label, value: p.vendor };
  });

  const { vendor: ttsVendor } = await inquirer.prompt([
    {
      type: 'list',
      name: 'vendor',
      message: str.ttsProvider + ':',
      choices: ttsChoices,
      default: profile.tts?.vendor,
    },
  ]);

  const selectedTts = TTS_PROVIDERS.find((p) => p.vendor === ttsVendor)!;

  // API Key
  const { key: ttsKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'key',
      message: str.ttsApiKey + ':',
      mask: '*',
      validate: (v: string) => v.trim().length > 0 || 'Required',
    },
  ]);

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
  if (selectedTts.requiresGroupId) {
    const { groupId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'groupId',
        message: str.groupId + ':',
        validate: (v: string) => v.trim().length > 0 || 'Required',
      },
    ]);
    ttsParams.group_id = groupId;
  }

  // OpenAI TTS and Cartesia use api_key instead of key
  if (ttsVendor === 'openai' || ttsVendor === 'cartesia') {
    ttsParams.api_key = ttsParams.key;
    delete ttsParams.key;
  }

  // Auto-fill vendor defaults
  if (selectedTts.defaultParams) {
    for (const [k, v] of Object.entries(selectedTts.defaultParams)) {
      if (!(k in ttsParams)) ttsParams[k] = v;
    }
  }

  profile.tts = { vendor: ttsVendor, params: ttsParams };
  configObj.profiles[profileName] = profile;
  saveConfig(configObj);
  printSuccess(`${str.ttsConfigured}: ${selectedTts.name}`);
}
