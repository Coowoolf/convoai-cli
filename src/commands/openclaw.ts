import { Command } from 'commander';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { resolveConfig } from '../config/manager.js';
import { createClient } from '../api/client.js';
import { AgentAPI } from '../api/agents.js';
import { generateRtcToken } from '../utils/token.js';
import { withSpinner } from '../ui/spinner.js';
import { printSuccess, printError, printHint } from '../ui/output.js';
import { printKeyValue } from '../ui/table.js';
import { handleError } from '../utils/errors.js';
import { track } from '../utils/telemetry.js';
import type { StartAgentRequest } from '../api/types.js';

// ─── Registration ───────────────────────────────────────────────────────────

export function registerOpenClaw(program: Command): void {
  program
    .command('openclaw')
    .description('Voice-enable your local OpenClaw — talk to it instead of typing')
    .option('--agent <id>', 'OpenClaw agent ID', 'main')
    .option('--port <port>', 'Local LLM bridge port', '3456')
    .option('--channel <name>', 'RTC channel name', 'openclaw-voice')
    .option('--profile <name>', 'ConvoAI config profile')
    .action(async (opts) => {
      try {
        await openclawAction(opts);
      } catch (error) {
        handleError(error);
      }
    });
}

// ─── OpenClaw → OpenAI-compatible Bridge ────────────────────────────────────

function createOpenClawBridge(agentId: string, port: number, onRequest?: () => void): Promise<ReturnType<typeof createServer>> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      // CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method !== 'POST' || !req.url?.includes('chat/completions')) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      // Read request body
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString());

      // Extract the last user message
      const messages: Array<{ role: string; content: string }> = body.messages ?? [];
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      const userText = lastUserMsg?.content ?? '';

      if (!userText) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No user message' }));
        return;
      }

      try {
        const id = `chatcmpl-openclaw-${Date.now()}`;
        const ts = () => Math.floor(Date.now() / 1000);
        const chunk = (content: string, finish?: string) => `data: ${JSON.stringify({
          id, object: 'chat.completion.chunk', created: ts(),
          choices: [{ index: 0, delta: content ? { content } : {}, finish_reason: finish ?? null }],
        })}\n\n`;

        // Always stream (Agora requires it)
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        // ── A. Send filler AS REAL CONTENT (not speak API) ─────────
        // Agora ConvoAI has an internal LLM timeout (~10s). If we send
        // filler via speak API (separate channel) but leave the SSE stream
        // empty for 19s while OpenClaw processes, Agora kills the connection.
        // Fix: send filler as actual SSE content chunks. Agora TTS will
        // speak the filler, and when OpenClaw replies, TTS continues with
        // the real response — seamless.
        res.write(`data: ${JSON.stringify({
          id, object: 'chat.completion.chunk', created: ts(),
          choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
        })}\n\n`);

        if (userText.length > 1) {
          const fillers = [
            '好的，让我想一想。',
            '收到了，我来看一看。',
            '嗯，让我处理一下。',
            '好，我来帮你查一下。',
            '收到，稍等我一下。',
            '好的，马上回复你。',
            '嗯嗯，让我看看。',
          ];
          const filler = fillers[Math.floor(Math.random() * fillers.length)];
          res.write(chunk(filler + ' '));
        }

        // ── B. Keep-alive padding every 5s (real content, not comment) ──
        const keepAlive = setInterval(() => {
          try {
            // Send a space as content — keeps Agora's LLM timeout from firing
            res.write(chunk(' '));
          } catch { clearInterval(keepAlive); }
        }, 5000);

        // ── C. Call OpenClaw ASYNC ───────────────────────────────────
        const { execFile } = await import('node:child_process');

        const replyText = await new Promise<string>((resolve) => {
          execFile('openclaw', [
            'agent', '--agent', agentId,
            '--message', userText,
            '--json',
          ], { timeout: 120000 }, (err, stdout) => {
            if (err) {
              resolve('抱歉，我暂时无法处理这个请求。');
              return;
            }
            try {
              // stdout may have plugin log lines before JSON
              const jsonStart = stdout.indexOf('{');
              const jsonStr = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout;
              const parsed = JSON.parse(jsonStr);
              resolve(parsed.result?.payloads?.[0]?.text ?? '抱歉，我没能处理这个请求。');
            } catch {
              resolve('抱歉，解析回复时出错了。');
            }
          });
        });

        clearInterval(keepAlive);

        // ── D. Stream the reply by sentences ─────────────────────────
        const sentences = replyText.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) ?? [replyText];
        for (const sentence of sentences) {
          res.write(chunk(sentence));
        }

        res.write(chunk('', 'stop'));
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.dim(`  [bridge] OpenClaw error: ${msg}`));
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: msg }));
      }
    });

    server.listen(port, () => resolve(server));
    server.on('error', reject);
  });
}

// ─── Action ─────────────────────────────────────────────────────────────────

async function openclawAction(opts: {
  agent: string;
  port: string;
  channel: string;
  profile?: string;
}): Promise<void> {
  const P = chalk.hex('#786af4');

  // ── 1. Check OpenClaw is available ──────────────────────────────────────
  try {
    execSync('which openclaw', { stdio: 'ignore' });
  } catch {
    printError('OpenClaw is not installed.');
    printHint('Install: curl -fsSL https://openclaw.ai/install.sh | bash');
    process.exit(1);
  }

  console.log('');
  console.log(`  ${P('▗▄▄▄▄▄▄▄▄▄▄▄▄▄▖')}`);
  console.log(`  ${P('▐')}${chalk.hex('#5b8eff')('  ')}${chalk.hex('#c8c8ff')('██')}${chalk.hex('#5b8eff')('    ')}${chalk.hex('#c8c8ff')('██')}${chalk.hex('#5b8eff')('   ')}${P('▌')}  ${chalk.bold.hex('#786af4')('ConvoAI')} ${chalk.red('× 🦞 OpenClaw')}`);
  console.log(`  ${P('▐')}${chalk.hex('#5b8eff')('    ')}${chalk.hex('#c8c8ff')('▀▀▀▀')}${chalk.hex('#5b8eff')('    ')}${P('▌')}  ${chalk.dim('Voice-enable your AI assistant')}`);
  console.log(`  ${P('▝▀▀▀▀▀▀▀█▀▀▀▀▘')}`);
  console.log(`  ${P('         ▀▚')}`);
  console.log('');

  const config = resolveConfig(opts.profile);
  if (!config.app_id) {
    printError('ConvoAI not configured. Run `convoai quickstart` first.');
    process.exit(1);
  }

  // ── 2. Check ngrok ──────────────────────────────────────────────────────
  try {
    execSync('which ngrok', { stdio: 'ignore' });
  } catch {
    printError('ngrok is not installed (needed to expose local bridge to Agora cloud).');
    printHint('Install: brew install ngrok && ngrok authtoken YOUR_TOKEN');
    printHint('Sign up free: https://dashboard.ngrok.com/signup');
    process.exit(1);
  }

  // ── 3. Start the OpenClaw → OpenAI bridge ────────────────────────────────
  // These get set after agent starts, so bridge callback can use them
  let fillerApi: AgentAPI | null = null;
  let fillerAgentId: string | null = null;
  const bridgePort = parseInt(opts.port, 10);

  const bridge = await withSpinner(
    `Starting OpenClaw bridge (port ${bridgePort})...`,
    () => createOpenClawBridge(opts.agent, bridgePort, () => {
      // Fire-and-forget: send random filler via speak API
      if (fillerApi && fillerAgentId) {
        const fillers = [
          '好的，让我想一想。',
          '收到了，我来看一看。',
          '嗯，让我处理一下。',
          '好，我来帮你查一下。',
          '收到，稍等我一下。',
          '好的，马上回复你。',
          '嗯嗯，让我看看。',
        ];
        const filler = fillers[Math.floor(Math.random() * fillers.length)];
        fillerApi.speak(fillerAgentId, { text: filler }).catch(() => {});
      }
    }),
  );
  printSuccess(`OpenClaw bridge on localhost:${bridgePort}`);

  // ── 4. Start ngrok tunnel ────────────────────────────────────────────────
  let ngrokUrl = '';
  const { spawn } = await import('node:child_process');

  const ngrokProcess = spawn('ngrok', ['http', String(bridgePort), '--log', 'stdout', '--log-format', 'json'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  // Wait for ngrok to provide the public URL
  ngrokUrl = await withSpinner('Starting ngrok tunnel...', () => new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('ngrok startup timed out')), 15000);
    let buffer = '';

    ngrokProcess.stdout!.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          if (log.url && log.url.startsWith('https://')) {
            clearTimeout(timeout);
            resolve(log.url);
            return;
          }
        } catch { /* not JSON or no url */ }
      }
    });

    ngrokProcess.on('error', (err) => { clearTimeout(timeout); reject(err); });
    ngrokProcess.on('exit', (code) => {
      if (!ngrokUrl) { clearTimeout(timeout); reject(new Error(`ngrok exited with code ${code}`)); }
    });
  }));

  printSuccess(`ngrok tunnel: ${ngrokUrl}`);

  // ── 5. Start ConvoAI agent pointing to ngrok URL ─────────────────────────
  const agentUid = 0;
  const clientUid = 12345;
  const agentToken = await generateRtcToken(opts.channel, agentUid);
  const clientToken = await generateRtcToken(opts.channel, clientUid);

  if (!agentToken) {
    printError('Token generation failed.');
    ngrokProcess.kill();
    bridge.close();
    process.exit(1);
  }

  const request: StartAgentRequest = {
    name: `openclaw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    properties: {
      channel: opts.channel,
      token: agentToken,
      agent_rtc_uid: String(agentUid),
      remote_rtc_uids: ['*'],
      idle_timeout: 600,
      llm: {
        url: `${ngrokUrl}/v1/chat/completions`,
        api_key: 'openclaw-local',
        system_messages: [{ role: 'system', content: 'You are a helpful assistant. Respond concisely in the same language as the user.' }],
        greeting_message: '你好，我是你的 OpenClaw 语音助手，有什么可以帮你的？',
        params: { model: 'openclaw', max_tokens: 2048 },
      },
      tts: config.tts,
      asr: config.asr?.vendor ? config.asr : { vendor: 'ares', language: 'zh-CN' },
      // ── VAD tuning: longer silence = less premature cutoff ──
      turn_detection: {
        silence_duration_ms: 1000,     // wait 1s of silence before ending turn (default 480ms)
        interrupt_duration_ms: 160,
        prefix_padding_ms: 800,
      },
    },
  };

  const client = createClient({
    appId: config.app_id!,
    customerId: config.customer_id!,
    customerSecret: config.customer_secret!,
    region: config.region as 'global' | 'cn' | undefined,
  });
  const api = new AgentAPI(client);

  // Stop any leftover agents
  try {
    const existing = await api.list({ state: 2, limit: 10 });
    for (const a of existing.data.list) {
      try { await api.stop(a.agent_id); } catch { /* */ }
    }
  } catch { /* */ }

  const result = await withSpinner('Starting ConvoAI agent...', () => api.start(request));
  track('openclaw_integrate');

  // Wire up filler callback now that we have agent ID
  fillerApi = api;
  fillerAgentId = result.agent_id;

  printSuccess('Voice bridge is live!');
  console.log('');
  printKeyValue([
    ['Agent ID', result.agent_id],
    ['OpenClaw Agent', opts.agent],
    ['Local Bridge', `localhost:${bridgePort}`],
    ['Tunnel', ngrokUrl],
    ['Channel', opts.channel],
  ]);

  // ── 4. Headless Chrome + PTT + Panel ──────────────────────────────────────
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const { WebSocketServer } = await import('ws');
  const { findChrome } = await import('../utils/find-chrome.js');
  const { runPanel, handleTranscriptMessage } = await import('./agent/panel.js');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Find chat-client.html
  let htmlPath = '';
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const c = join(dir, 'src', 'web', 'chat-client.html');
    try { readFileSync(c); htmlPath = c; break; } catch { /* */ }
    dir = dirname(dir);
  }
  if (!htmlPath) {
    printError('Could not find chat-client.html');
    ngrokProcess.kill();
    bridge.close();
    process.exit(1);
  }

  const html = readFileSync(htmlPath, 'utf-8');
  const httpPort = 3210;
  const wsPort = 3211;

  const webServer = createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise<void>((resolve) => webServer.listen(httpPort, resolve));

  const wss = new WebSocketServer({ port: wsPort });

  // Shared panel state for live transcript
  const panelState = {
    history: [] as any[], turns: [] as any[], inSubmenu: false, printedCount: 0,
    transcriptEntries: [] as any[], transcriptPrintedCount: 0,
    ephemeral: null as any, lastEphemeralText: '', hasLiveTranscript: false,
  };

  // WebSocket broadcast helper
  const wsBroadcast = (msg: Record<string, unknown>) => {
    const data = JSON.stringify(msg);
    for (const client of wss.clients) {
      try { client.send(data); } catch { /* */ }
    }
  };

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'transcript' && msg.data) {
          handleTranscriptMessage(panelState, msg.data);
        }
      } catch { /* */ }
    });
  });

  // Launch headless Chrome (hidden, for audio I/O)
  const chromePath = findChrome();
  let browser: { close(): Promise<void> } | null = null;

  if (chromePath) {
    const puppeteer = await import('puppeteer-core');
    const launched = await puppeteer.default.launch({
      executablePath: chromePath,
      headless: false,
      args: [
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--no-sandbox',
        '--enable-features=WebRtcAecAudioProcessing',
        // Keep window visible for audio output (macOS may block hidden windows)
      ],
    });
    browser = launched as unknown as { close(): Promise<void> };

    const page = await launched.newPage();
    const context = launched.defaultBrowserContext();
    await context.overridePermissions(`http://localhost:${httpPort}`, ['microphone']);

    const params = new URLSearchParams({
      appId: config.app_id!,
      channel: opts.channel,
      token: clientToken ?? '',
      uid: String(clientUid),
      wsPort: String(wsPort),
      ptt: '1', // Enable push-to-talk
    });

    await page.goto(`http://localhost:${httpPort}?${params}`);

    // macOS: keep Chrome visible for now (hiding may block audio)
    if (false && process.platform === 'darwin') {
      try {
        execSync(`osascript -e 'tell application "System Events" to set visible of process "Google Chrome" to false' 2>/dev/null`, { stdio: 'ignore' });
      } catch { /* */ }
    }
  } else {
    // Fallback: open browser (no PTT in browser mode)
    const params = new URLSearchParams({
      appId: config.app_id!,
      channel: opts.channel,
      token: clientToken ?? '',
      uid: String(clientUid),
    });
    try {
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      execSync(`${cmd} "http://localhost:${httpPort}?${params}"`);
    } catch { /* */ }
  }

  console.log('');
  console.log(chalk.green.bold('  🎙  Talk to OpenClaw!'));
  console.log(chalk.dim(chromePath
    ? '  Hold space to talk → OpenClaw 🦞 → hear response'
    : '  Browser opened — allow microphone and speak.'));
  console.log('');

  // ── Enter panel with PTT enabled ──────────────────────────────────────────
  const lang: 'cn' | 'global' = config.region === 'cn' ? 'cn' : 'global';

  // Override config display for panel — show "openclaw" instead of config's LLM model
  const panelConfig = { ...config };
  if (!panelConfig.llm) panelConfig.llm = {};
  panelConfig.llm = { ...panelConfig.llm, params: { ...panelConfig.llm.params, model: '🦞 openclaw' } };

  await runPanel({
    api,
    agentId: result.agent_id,
    channel: opts.channel,
    lang,
    config: panelConfig,
    ptt: !!chromePath,
    wsBroadcast,
    _sharedState: panelState,
    onExit: async () => {
      wss.close();
      webServer.close();
      if (browser) try { await browser.close(); } catch { /* */ }
      ngrokProcess.kill();
      bridge.close();
      try { await api.stop(result.agent_id); } catch { /* */ }
    },
  });
}
