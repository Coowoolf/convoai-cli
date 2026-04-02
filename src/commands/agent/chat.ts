import { Command } from 'commander';
import { createServer as createHttpServer } from 'node:http';
import { WebSocketServer, type WebSocket as WS } from 'ws';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import chalk from 'chalk';
import type { StartAgentRequest, LLMConfig, HistoryEntry } from '../../api/types.js';
import { getAgentAPI } from './_helpers.js';
import { resolveConfig } from '../../config/manager.js';
import { getPreset } from '../../presets/defaults.js';
import { generateRtcToken } from '../../utils/token.js';
import { findChrome } from '../../utils/find-chrome.js';
import { withSpinner } from '../../ui/spinner.js';
import { printSuccess, printError } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';
import { track } from '../../utils/telemetry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Greeting ───────────────────────────────────────────────────────────────

function getGreeting(lang: string): string {
  const m: Record<string, string> = {
    'zh-CN': '你好，我是声网 ConvoAI 语音助手，有什么可以帮你的吗？',
    'zh-HK': '你好，我是聲網 ConvoAI 語音助手，有什麼可以幫你的嗎？',
    'zh-TW': '你好，我是聲網 ConvoAI 語音助手，有什麼可以幫你的嗎？',
    'ja-JP': 'こんにちは、Agora ConvoAI 音声アシスタントです。何かお手伝いできますか？',
    'ko-KR': '안녕하세요, Agora ConvoAI 음성 어시스턴트입니다. 무엇을 도와드릴까요?',
  };
  return m[lang] ?? 'Hi, I\'m your Agora ConvoAI voice assistant. How can I help you?';
}

// ─── Find chat-client.html ──────────────────────────────────────────────────

function findChatHtml(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const c = join(dir, 'src', 'web', 'chat-client.html');
    try { readFileSync(c); return c; } catch { /* */ }
    dir = dirname(dir);
  }
  throw new Error('Could not find chat-client.html');
}

// ─── Terminal UI ────────────────────────────────────────────────────────────

class TerminalUI {
  private messages: { role: string; content: string }[] = [];
  private status = 'Starting...';
  private agentSpeaking = false;
  private agentId = '';
  private channel = '';

  setAgent(id: string, ch: string) { this.agentId = id; this.channel = ch; }
  setStatus(s: string) { this.status = s; this.render(); }
  setAgentSpeaking(s: boolean) { this.agentSpeaking = s; this.render(); }

  updateMessages(entries: HistoryEntry[]) {
    if (entries.length > this.messages.length) {
      this.messages = entries.map(e => ({ role: e.role, content: e.content || '' }));
      this.render();
    }
  }

  render() {
    const P = chalk.hex('#786af4');
    const B = chalk.hex('#5b8eff');
    const W = chalk.hex('#c8c8ff');

    // Clear screen
    process.stdout.write('\x1b[2J\x1b[H');

    // Banner
    console.log('');
    console.log(`  ${P('▗▄▄▄▄▄▄▄▄▄▄▄▄▄▖')}`);
    console.log(`  ${P('▐')}${B('  ')}${W('██')}${B('    ')}${W('██')}${B('   ')}${P('▌')}  ${chalk.bold.hex('#786af4')('ConvoAI Voice Chat')}`);
    console.log(`  ${P('▐')}${B('    ')}${W('▀▀▀▀')}${B('    ')}${P('▌')}  ${chalk.dim(`Channel: ${this.channel}`)}`);
    console.log(`  ${P('▝▀▀▀▀▀▀▀█▀▀▀▀▘')}  ${chalk.dim(`Agent: ${this.agentId.slice(0, 12)}...`)}`);
    console.log(`  ${P('         ▀▚')}`);
    console.log('');
    console.log(chalk.dim('  ─────────────────────────────────────────'));
    console.log('');

    // Messages
    if (this.messages.length === 0) {
      console.log(chalk.dim('  Waiting for conversation...'));
    } else {
      const show = this.messages.slice(-12); // show last 12 messages
      for (const msg of show) {
        if (msg.role === 'assistant') {
          console.log(`  ${chalk.green('[assistant]')}  ${msg.content}`);
        } else {
          console.log(`  ${chalk.cyan('[you]      ')}  ${msg.content}`);
        }
      }
    }

    console.log('');
    console.log(chalk.dim('  ─────────────────────────────────────────'));

    // Status bar
    if (this.agentSpeaking) {
      console.log(`  ${chalk.green('🔊 Agent speaking...')}`);
    } else {
      console.log(`  ${chalk.cyan('🎙  Listening...')} ${chalk.dim('(speak now)')}`);
    }

    console.log('');
    console.log(chalk.dim('  Press Ctrl+C to exit'));
  }
}

// ─── Command Registration ───────────────────────────────────────────────────

export function registerAgentChat(program: Command): void {
  program
    .command('chat')
    .description('Voice chat with an AI agent directly in your terminal (no browser)')
    .requiredOption('-c, --channel <name>', 'Channel name')
    .option('--preset <name>', 'Use a built-in preset')
    .option('--model <model>', 'LLM model name')
    .option('--tts <vendor>', 'TTS vendor')
    .option('--asr <vendor>', 'ASR vendor')
    .option('--system-message <msg>', 'System prompt')
    .option('--greeting <msg>', 'Greeting message')
    .option('--idle-timeout <seconds>', 'Idle timeout', '300')
    .option('--profile <name>', 'Config profile')
    .action(async (opts) => {
      try {
        await chatAction(opts);
      } catch (error) {
        handleError(error);
      }
    });
}

// ─── Action ─────────────────────────────────────────────────────────────────

async function chatAction(opts: {
  channel: string;
  preset?: string;
  model?: string;
  tts?: string;
  asr?: string;
  systemMessage?: string;
  greeting?: string;
  idleTimeout: string;
  profile?: string;
}): Promise<void> {

  // ── Check Chrome ─────────────────────────────────────────────────────────
  const chromePath = findChrome();
  if (!chromePath) {
    printError('Chrome/Chromium not found on your system.');
    console.log(chalk.dim('  Install Chrome: https://www.google.com/chrome'));
    console.log(chalk.dim('  Or use browser mode: convoai agent join -c ' + opts.channel));
    process.exit(1);
  }

  const config = resolveConfig(opts.profile);
  const appId = config.app_id;
  if (!appId) {
    printError('App ID not configured. Run `convoai config init` first.');
    process.exit(1);
  }

  // ── 1. Generate tokens ────────────────────────────────────────────────────
  const agentUid = 0;
  const clientUid = 12345;
  const agentToken = await generateRtcToken(opts.channel, agentUid);
  const clientToken = await generateRtcToken(opts.channel, clientUid);
  if (!agentToken) {
    printError('Token generation failed. Run `convoai config set app_certificate <cert>`.');
    process.exit(1);
  }

  // ── 2. Start agent ────────────────────────────────────────────────────────
  const presetProps = opts.preset ? getPreset(opts.preset) : undefined;
  const llm: LLMConfig = {
    ...config.llm,
    ...presetProps?.llm,
    api_key: config.llm?.api_key ?? presetProps?.llm?.api_key,
    url: config.llm?.url ?? presetProps?.llm?.url,
  };
  if (opts.model) llm.model = opts.model;
  if (opts.systemMessage) llm.system_messages = [{ role: 'system', content: opts.systemMessage }];

  const asrLang = config.asr?.language ?? 'en-US';
  if (opts.greeting) {
    llm.greeting_message = opts.greeting;
  } else {
    llm.greeting_message = getGreeting(asrLang);
  }

  const request: StartAgentRequest = {
    name: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    properties: {
      channel: opts.channel,
      token: agentToken,
      agent_rtc_uid: String(agentUid),
      remote_rtc_uids: ['*'],
      idle_timeout: parseInt(opts.idleTimeout, 10),
      llm: Object.keys(llm).length > 0 ? llm : undefined,
      tts: opts.tts
        ? { ...config.tts, vendor: opts.tts, params: { ...config.tts?.params } }
        : config.tts,
      asr: opts.asr
        ? { ...config.asr, vendor: opts.asr, params: { ...config.asr?.params } }
        : config.asr?.vendor ? config.asr : { vendor: 'ares', language: 'zh-CN' },
    },
  };

  const api = getAgentAPI(opts.profile);

  // Stop any leftover running agents first
  try {
    const existing = await api.list({ state: 2, limit: 10 });
    if (existing.data.list.length > 0) {
      await withSpinner(`Cleaning up ${existing.data.list.length} leftover agent(s)...`, async () => {
        for (const a of existing.data.list) {
          try { await api.stop(a.agent_id); } catch { /* */ }
        }
      });
    }
  } catch { /* */ }

  const result = await withSpinner('Starting agent...', () => api.start(request));
  track('agent_chat');

  // ── 3. Start HTTP + WebSocket servers ──────────────────────────────────────
  const httpPort = 3210;
  const wsPort = 3211;

  // Kill any leftover processes on our ports
  try {
    const { execSync: exec } = await import('node:child_process');
    exec(`lsof -ti:${httpPort},${wsPort} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 300));
  } catch { /* no leftover processes */ }

  const htmlPath = findChatHtml();
  const html = readFileSync(htmlPath, 'utf-8');

  const httpServer = createHttpServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(httpPort, () => resolve());
    httpServer.on('error', reject);
  });

  const wss = new WebSocketServer({ port: wsPort });
  const ui = new TerminalUI();
  ui.setAgent(result.agent_id, opts.channel);

  wss.on('connection', (ws: WS) => {
    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        switch (msg.type) {
          case 'ready':
            ui.setStatus('Connected — speak now!');
            break;
          case 'agent_speaking':
            ui.setAgentSpeaking(msg.speaking);
            break;
          case 'agent_left':
            ui.setStatus('Agent disconnected');
            break;
          case 'error':
            ui.setStatus(`Error: ${msg.text}`);
            break;
        }
      } catch { /* ignore */ }
    });
  });

  // ── 4. Launch headless Chrome ──────────────────────────────────────────────
  const puppeteer = await import('puppeteer-core');
  // headless: false is required for audio playback (headless Chrome has no audio output)
  // We minimize the window so it's out of the way — user sees only the terminal
  const browser = await puppeteer.default.launch({
    executablePath: chromePath,
    headless: false,
    args: [
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
      '--window-size=1,1',
      '--window-position=-2000,-2000', // negative = off left/top edge
      '--enable-features=WebRtcAecAudioProcessing',
    ],
  });

  const page = await browser.newPage();

  // Grant microphone permission
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(`http://localhost:${httpPort}`, ['microphone']);

  const params = new URLSearchParams({
    appId: appId,
    channel: opts.channel,
    token: clientToken ?? '',
    uid: String(clientUid),
    wsPort: String(wsPort),
  });

  await page.goto(`http://localhost:${httpPort}?${params}`);

  // macOS: hide Chrome window and bring terminal back to focus
  if (process.platform === 'darwin') {
    try {
      const { execSync: exec } = await import('node:child_process');
      // Hide Chrome, activate Terminal/iTerm
      exec(`osascript -e 'tell application "System Events"
        set visible of process "Google Chrome" to false
      end tell' 2>/dev/null`, { stdio: 'ignore' });
      // Bring terminal back
      exec(`osascript -e 'tell application "System Events"
        set frontProcess to first process whose frontmost is false and visible is true and name is not "Google Chrome"
        set frontmost of frontProcess to true
      end tell' 2>/dev/null`, { stdio: 'ignore' });
    } catch { /* osascript may fail, not critical */ }
  }

  // ── 5. Poll history for transcription ──────────────────────────────────────
  const historyTimer = setInterval(async () => {
    try {
      const h = await api.history(result.agent_id);
      const entries = h.contents ?? [];
      ui.updateMessages(entries);
    } catch { /* agent may have stopped */ }
  }, 2000);

  // Initial render
  ui.setStatus('Connecting...');

  // ── 6. Cleanup on exit ─────────────────────────────────────────────────────
  const cleanup = async () => {
    clearInterval(historyTimer);

    // Tell headless page to leave channel
    for (const client of wss.clients) {
      try { client.send(JSON.stringify({ type: 'stop' })); } catch { /* */ }
    }

    // Small delay for graceful disconnect
    await new Promise(r => setTimeout(r, 500));

    try { await browser.close(); } catch { /* */ }
    wss.close();
    httpServer.close();

    // Show final conversation
    process.stdout.write('\x1b[2J\x1b[H');
    console.log('');

    try {
      const h = await api.history(result.agent_id);
      const entries = h.contents ?? [];
      if (entries.length > 0) {
        console.log(chalk.bold('  Conversation:'));
        console.log('');
        for (const e of entries) {
          const role = e.role === 'assistant'
            ? chalk.green('[assistant]')
            : chalk.cyan('[you]      ');
          console.log(`  ${role}  ${e.content || chalk.dim('(empty)')}`);
        }
        console.log('');
        console.log(chalk.dim(`  ${entries.length} messages`));
      }
    } catch { /* */ }

    try {
      await withSpinner('Stopping agent...', () => api.stop(result.agent_id));
      printSuccess('Session ended.');
    } catch {
      printSuccess('Session ended.');
    }

    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep alive
  await new Promise(() => {});
}
