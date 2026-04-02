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

interface ChatMessage {
  role: string;
  content: string;
  e2e_ms?: number;
  interrupted?: boolean;
}

function wrapText(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) return [text];
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxWidth) { lines.push(remaining); break; }
    let cut = remaining.lastIndexOf(' ', maxWidth);
    if (cut <= 0) cut = maxWidth;
    lines.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  return lines;
}

function fmtLatency(ms: number): string {
  if (ms < 1000) return chalk.green(`${ms}ms`);
  const s = (ms / 1000).toFixed(1);
  if (ms < 2000) return chalk.yellow(`${s}s`);
  return chalk.red(`${s}s`);
}

class TerminalUI {
  private messages: ChatMessage[] = [];
  private agentSpeaking = false;
  private agentId = '';
  private channel = '';

  setAgent(id: string, ch: string) { this.agentId = id; this.channel = ch; }
  setAgentSpeaking(s: boolean) { this.agentSpeaking = s; this.render(); }

  updateMessages(msgs: ChatMessage[]) {
    if (msgs.length > this.messages.length || msgs.some((m, i) => m.e2e_ms !== this.messages[i]?.e2e_ms)) {
      this.messages = msgs;
      this.render();
    }
  }

  render() {
    const P = chalk.hex('#786af4');
    const B = chalk.hex('#5b8eff');
    const W = chalk.hex('#c8c8ff');
    const termWidth = process.stdout.columns || 80;
    const termHeight = process.stdout.rows || 24;
    const msgWidth = Math.max(termWidth - 20, 30);

    const lines: string[] = [];

    // Banner (7 lines)
    lines.push('');
    lines.push(`  ${P('▗▄▄▄▄▄▄▄▄▄▄▄▄▄▖')}`);
    lines.push(`  ${P('▐')}${B('  ')}${W('██')}${B('    ')}${W('██')}${B('   ')}${P('▌')}  ${chalk.bold.hex('#786af4')('ConvoAI Voice Chat')}`);
    lines.push(`  ${P('▐')}${B('    ')}${W('▀▀▀▀')}${B('    ')}${P('▌')}  ${chalk.dim(`Channel: ${this.channel}`)}`);
    lines.push(`  ${P('▝▀▀▀▀▀▀▀█▀▀▀▀▘')}  ${chalk.dim(`Agent: ${this.agentId.slice(0, 16)}...`)}`);
    lines.push(`  ${P('         ▀▚')}`);
    lines.push('');
    lines.push(chalk.dim('  ─────────────────────────────────────────'));
    lines.push('');

    // Messages
    if (this.messages.length === 0) {
      lines.push(chalk.dim('  Waiting for conversation...'));
    } else {
      const show = this.messages.slice(-12);
      for (const msg of show) {
        if (msg.role === 'assistant') {
          const latencyTag = msg.e2e_ms
            ? chalk.dim('[') + fmtLatency(msg.e2e_ms) + chalk.dim('] ')
            : '';
          const wrapped = wrapText(msg.content, msgWidth);
          lines.push(`  ${chalk.green('[assistant]')} ${latencyTag}${wrapped[0]}`);
          for (let i = 1; i < wrapped.length; i++) {
            lines.push(`               ${wrapped[i]}`);
          }
        } else {
          const wrapped = wrapText(msg.content, msgWidth);
          lines.push(`  ${chalk.cyan('[you]      ')} ${wrapped[0]}`);
          for (let i = 1; i < wrapped.length; i++) {
            lines.push(`               ${wrapped[i]}`);
          }
        }
      }
    }

    lines.push('');
    lines.push(chalk.dim('  ─────────────────────────────────────────'));
    lines.push(this.agentSpeaking
      ? `  ${chalk.green('🔊 Agent speaking...')}`
      : `  ${chalk.cyan('🎙  Listening...')} ${chalk.dim('(speak now)')}`);
    lines.push('');
    lines.push(chalk.dim('  Press Ctrl+C to exit'));

    // Pad to fill terminal height (prevents leftover lines from previous render)
    while (lines.length < termHeight) lines.push('');

    // Write all at once — cursor home, then overwrite
    process.stdout.write('\x1b[H' + lines.join('\n') + '\x1b[J');
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
            ui.render();
            break;
          case 'agent_speaking':
            ui.setAgentSpeaking(msg.speaking);
            break;
          case 'agent_left':
            ui.render();
            break;
          case 'error':
            ui.render();
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

  // ── 5. Poll history + turns for transcription & latency ─────────────────────
  const historyTimer = setInterval(async () => {
    try {
      const [h, t] = await Promise.all([
        api.history(result.agent_id).catch(() => null),
        api.turns(result.agent_id).catch(() => null),
      ]);

      const entries = h?.contents ?? [];
      const turns = t?.turns ?? [];

      // Build latency map from turns: match assistant responses with e2e latency
      const latencyMap = new Map<number, { e2e_ms?: number; interrupted?: boolean }>();
      for (let i = 0; i < turns.length; i++) {
        latencyMap.set(i, {
          e2e_ms: turns[i].e2e_latency_ms,
          interrupted: turns[i].end_reason === 'interrupted',
        });
      }

      // Merge history entries with latency data
      const msgs: ChatMessage[] = [];
      let turnIdx = 0;
      for (const e of entries) {
        const msg: ChatMessage = { role: e.role, content: e.content || '' };
        if (e.role === 'assistant' && turnIdx < turns.length) {
          msg.e2e_ms = turns[turnIdx]?.e2e_latency_ms;
          msg.interrupted = turns[turnIdx]?.end_reason === 'interrupted';
          turnIdx++;
        }
        msgs.push(msg);
      }

      ui.updateMessages(msgs);
    } catch { /* agent may have stopped */ }
  }, 1500);

  // Initial render
  ui.render();

  // ── 6. Cleanup on exit ─────────────────────────────────────────────────────
  let cleaningUp = false;
  const cleanup = async () => {
    if (cleaningUp) return;
    cleaningUp = true;
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

    // ── Session Report ──────────────────────────────────────────────────────
    process.stdout.write('\x1b[2J\x1b[H');
    const P = chalk.hex('#786af4');

    console.log('');
    console.log(`  ${chalk.bold.hex('#786af4')('⚡🐦 ConvoAI Session Report')}`);
    console.log(chalk.dim('  ─────────────────────────────────────────'));
    console.log('');

    try {
      const [h, t] = await Promise.all([
        api.history(result.agent_id).catch(() => null),
        api.turns(result.agent_id).catch(() => null),
      ]);

      const entries = h?.contents ?? [];
      const turns = t?.turns ?? [];

      // ── Conversation ────────────────────────────────────────────────
      if (entries.length > 0) {
        console.log(chalk.bold('  Conversation:'));
        console.log('');
        let turnIdx = 0;
        for (const e of entries) {
          if (e.role === 'assistant') {
            const latency = turnIdx < turns.length ? turns[turnIdx]?.e2e_latency_ms : undefined;
            const tag = latency ? chalk.dim('[') + fmtLatency(latency) + chalk.dim('] ') : '';
            const interrupted = turnIdx < turns.length && turns[turnIdx]?.end_reason === 'interrupted';
            const suffix = interrupted ? chalk.yellow(' ⚡interrupted') : '';
            console.log(`  ${chalk.green('[assistant]')} ${tag}${e.content || ''}${suffix}`);
            turnIdx++;
          } else {
            console.log(`  ${chalk.cyan('[you]      ')} ${e.content || chalk.dim('(empty)')}`);
          }
        }
        console.log('');
      }

      // ── Performance ────────────────────────────────────────────────
      if (turns.length > 0) {
        console.log(chalk.bold('  Performance:'));
        console.log('');
        console.log(chalk.dim('  #  Turn                E2E       ASR      LLM      TTS'));
        console.log(chalk.dim('  ── ─────────────────── ──────── ──────── ──────── ────────'));

        for (let i = 0; i < turns.length; i++) {
          const turn = turns[i];
          const num = String(i + 1).padStart(2);
          const type = (turn.type || 'voice').padEnd(18).slice(0, 18);
          const e2e = turn.e2e_latency_ms ? fmtLatency(turn.e2e_latency_ms).padStart(8) : chalk.dim('     —  ');
          const asr = turn.segmented_latency_ms?.asr_ms ? fmtLatency(turn.segmented_latency_ms.asr_ms).padStart(8) : chalk.dim('     —  ');
          const llm = turn.segmented_latency_ms?.llm_ms ? fmtLatency(turn.segmented_latency_ms.llm_ms).padStart(8) : chalk.dim('     —  ');
          const tts = turn.segmented_latency_ms?.tts_ms ? fmtLatency(turn.segmented_latency_ms.tts_ms).padStart(8) : chalk.dim('     —  ');
          console.log(`  ${num}  ${type} ${e2e} ${asr} ${llm} ${tts}`);
        }

        // ── Summary ────────────────────────────────────────────────
        console.log('');
        console.log(chalk.dim('  ─────────────────────────────────────────'));

        const e2eValues = turns.map(t => t.e2e_latency_ms).filter((v): v is number => v != null);
        const llmValues = turns.map(t => t.segmented_latency_ms?.llm_ms).filter((v): v is number => v != null);
        const interrupted = turns.filter(t => t.end_reason === 'interrupted').length;

        if (e2eValues.length > 0) {
          const avgE2E = Math.round(e2eValues.reduce((a, b) => a + b, 0) / e2eValues.length);
          console.log(`  Avg E2E:        ${fmtLatency(avgE2E)}`);
        }
        if (llmValues.length > 0) {
          const avgLLM = Math.round(llmValues.reduce((a, b) => a + b, 0) / llmValues.length);
          console.log(`  Avg LLM:        ${fmtLatency(avgLLM)}`);
        }
        console.log(`  Turns:          ${turns.length}`);
        console.log(`  Messages:       ${entries.length}`);
        if (interrupted > 0) {
          console.log(`  Interrupted:    ${chalk.yellow(String(interrupted))}`);
        }
        console.log(`  Response rate:  ${entries.filter(e => e.role === 'assistant').length}/${entries.filter(e => e.role === 'user').length} user turns got replies`);
      } else {
        console.log(chalk.dim('  No turn data available.'));
      }
    } catch { /* */ }

    console.log('');

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
