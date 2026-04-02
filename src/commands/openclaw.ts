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

function createOpenClawBridge(agentId: string, port: number): Promise<ReturnType<typeof createServer>> {
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

        // ── A. Send filler immediately (user hears "让我想想" within 1s) ──
        res.write(`data: ${JSON.stringify({
          id, object: 'chat.completion.chunk', created: ts(),
          choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
        })}\n\n`);

        // ── A. Random filler — only for real user messages ───────────
        const needsFiller = userText.length > 1;
        if (needsFiller) {
          const fillers = [
            '好的，让我想一想。',
            '收到了，我来看一看。',
            '嗯，让我处理一下。',
            '好，我来帮你查一下。',
            '收到，稍等我一下。',
            '我看到了，让我想想怎么回答。',
            '好的，马上回复你。',
            '嗯嗯，让我看看。',
          ];
          const filler = fillers[Math.floor(Math.random() * fillers.length)];
          res.write(chunk(filler));
          if (typeof (res as any).flush === 'function') (res as any).flush();
        }

        // ── B. Call OpenClaw ASYNC (non-blocking, so filler can flush) ──
        const { execFile } = await import('node:child_process');
        const escaped = userText.replace(/"/g, '\\"');

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
              const parsed = JSON.parse(stdout);
              resolve(parsed.result?.payloads?.[0]?.text ?? '抱歉，我没能处理这个请求。');
            } catch {
              resolve('抱歉，解析回复时出错了。');
            }
          });
        });

        // ── C. Stream the real reply by sentences ──────────────────────
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
  const bridgePort = parseInt(opts.port, 10);

  const bridge = await withSpinner(
    `Starting OpenClaw bridge (port ${bridgePort})...`,
    () => createOpenClawBridge(opts.agent, bridgePort),
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
        // greeting sent via speak API with 1s delay (see below)
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

  printSuccess('Voice bridge is live!');
  console.log('');
  printKeyValue([
    ['Agent ID', result.agent_id],
    ['OpenClaw Agent', opts.agent],
    ['Local Bridge', `localhost:${bridgePort}`],
    ['Tunnel', ngrokUrl],
    ['Channel', opts.channel],
  ]);

  // ── 4. Open browser for voice chat ────────────────────────────────────────
  // Reuse the existing web client
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  let htmlPath = '';
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const c = join(dir, 'src', 'web', 'client.html');
    try { readFileSync(c); htmlPath = c; break; } catch { /* */ }
    dir = dirname(dir);
  }

  if (htmlPath) {
    const html = readFileSync(htmlPath, 'utf-8');
    const webPort = 3210;
    const webServer = createServer((_, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    await new Promise<void>((resolve) => webServer.listen(webPort, resolve));

    const params = new URLSearchParams({
      appId: config.app_id!,
      channel: opts.channel,
      token: clientToken ?? '',
      uid: String(clientUid),
    });
    const url = `http://localhost:${webPort}?${params}`;

    try {
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      execSync(`${cmd} "${url}"`);
    } catch { /* */ }

    console.log('');
    console.log(chalk.green.bold('  🎙  Talk to OpenClaw!'));
    console.log(chalk.dim('  Browser opened — allow microphone and speak.'));
    console.log('');
    console.log(chalk.dim('  You → mic → ASR → OpenClaw 🦞 → TTS → speaker'));
    console.log('');
    console.log(chalk.dim('  Press Ctrl+C to stop.'));

    // Delayed greeting via speak API (4s — wait for browser to join channel)
    setTimeout(async () => {
      try {
        await api.speak(result.agent_id, {
          text: '你好，我是你的 OpenClaw 语音助手，有什么可以帮你的？',
        });
      } catch { /* greeting is nice-to-have, not critical */ }
    }, 4000);

    // Cleanup
    const cleanup = async () => {
      console.log('');
      try { await api.stop(result.agent_id); } catch { /* */ }
      ngrokProcess.kill();
      bridge.close();
      webServer.close();
      printSuccess('OpenClaw voice session ended.');
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    await new Promise(() => {});
  }
}
