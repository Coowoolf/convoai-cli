import { Command } from 'commander';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import type { StartAgentRequest, LLMConfig } from '../../api/types.js';
import { getAgentAPI, formatTimestamp } from './_helpers.js';
import { resolveConfig, loadConfig } from '../../config/manager.js';
import { getPreset } from '../../presets/defaults.js';
import { generateRtcToken } from '../../utils/token.js';
import { withSpinner } from '../../ui/spinner.js';
import { printSuccess, printError, printHint } from '../../ui/output.js';
import { printKeyValue } from '../../ui/table.js';
import { handleError } from '../../utils/errors.js';
import { shortId } from '../../utils/hints.js';

// ─── Locate HTML Client ───────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findClientHtml(): string {
  // Walk up to find src/web/client.html (works from dist/ and src/)
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

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAgentJoin(program: Command): void {
  program
    .command('join')
    .description('Start an agent and open voice chat in your browser')
    .requiredOption('-c, --channel <name>', 'Channel name')
    .option('--preset <name>', 'Use a built-in preset')
    .option('--model <model>', 'LLM model name')
    .option('--tts <vendor>', 'TTS vendor (overrides preset)')
    .option('--asr <vendor>', 'ASR vendor (overrides preset)')
    .option('--system-message <msg>', 'System prompt for the LLM')
    .option('--greeting <msg>', 'Greeting message')
    .option('--idle-timeout <seconds>', 'Idle timeout in seconds', '300')
    .option('--port <port>', 'Local server port', '3210')
    .option('--profile <name>', 'Config profile')
    .option('--no-open', 'Do not auto-open the browser')
    .action(async (opts) => {
      try {
        await joinAction(opts);
      } catch (error) {
        handleError(error);
      }
    });
}

// ─── Action ────────────────────────────────────────────────────────────────

async function joinAction(opts: {
  channel: string;
  preset: string;
  model?: string;
  tts?: string;
  asr?: string;
  systemMessage?: string;
  greeting?: string;
  idleTimeout: string;
  port: string;
  profile?: string;
  open: boolean;
}): Promise<void> {
  const config = resolveConfig(opts.profile);
  const appId = config.app_id;

  if (!appId) {
    printError('App ID not configured. Run `convoai config init` first.');
    process.exit(1);
  }

  // ── 1. Generate tokens ─────────────────────────────────────────────────
  const agentUid = 0;
  const clientUid = 12345;

  const agentToken = await generateRtcToken(opts.channel, agentUid);
  const clientToken = await generateRtcToken(opts.channel, clientUid);

  if (!agentToken) {
    printError('Cannot generate RTC token. Run `convoai config set app_certificate <cert>` first.');
    process.exit(1);
  }

  // ── 2. Start the agent ─────────────────────────────────────────────────
  const presetProps = getPreset(opts.preset);

  const llm: LLMConfig = {
    ...config.llm,
    ...presetProps?.llm,
    api_key: config.llm?.api_key ?? presetProps?.llm?.api_key,
    url: config.llm?.url ?? presetProps?.llm?.url,
  };
  if (opts.model) llm.model = opts.model;
  if (opts.systemMessage) llm.system_messages = [{ role: 'system', content: opts.systemMessage }];
  if (opts.greeting) llm.greeting_message = opts.greeting;

  const request: StartAgentRequest = {
    name: `join-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    properties: {
      channel: opts.channel,
      token: agentToken,
      agent_rtc_uid: String(agentUid),
      remote_rtc_uids: ['*'],
      idle_timeout: parseInt(opts.idleTimeout, 10),
      llm: Object.keys(llm).length > 0 ? llm : undefined,
      tts: opts.tts
        ? { ...config.tts, vendor: opts.tts, params: { ...config.tts?.params } }
        : { ...config.tts, ...presetProps?.tts, params: { ...config.tts?.params, ...presetProps?.tts?.params } },
      asr: opts.asr
        ? { ...config.asr, vendor: opts.asr, params: { ...config.asr?.params } }
        : { ...config.asr, ...presetProps?.asr, params: { ...config.asr?.params, ...presetProps?.asr?.params } },
    },
  };

  const api = getAgentAPI(opts.profile);
  const result = await withSpinner('Starting agent...', () => api.start(request));

  printSuccess('Agent started.');
  printKeyValue([
    ['Agent ID', result.agent_id],
    ['Channel', opts.channel],
    ['Status', result.status],
  ]);

  // ── 3. Start local web server ──────────────────────────────────────────
  const port = parseInt(opts.port, 10);
  const htmlPath = findClientHtml();
  const html = readFileSync(htmlPath, 'utf-8');

  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(port, () => resolve());
    server.on('error', reject);
  });

  // ── 4. Open browser ────────────────────────────────────────────────────
  const params = new URLSearchParams({
    appId: appId,
    channel: opts.channel,
    token: clientToken ?? '',
    uid: String(clientUid),
  });
  const url = `http://localhost:${port}?${params}`;

  console.log('');
  console.log(chalk.cyan('  Voice chat: ') + chalk.bold(url));
  console.log('');

  if (opts.open) {
    try {
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      execSync(`${cmd} "${url}"`);
      printSuccess('Browser opened. Allow microphone and start talking!');
    } catch {
      console.log(chalk.dim('  Open the URL above in your browser.'));
    }
  }

  console.log(chalk.dim('  Press Ctrl+C to stop the agent and exit.\n'));

  // ── 5. Handle shutdown ─────────────────────────────────────────────────
  const cleanup = async () => {
    console.log('');
    try {
      await withSpinner(`Stopping agent ${shortId(result.agent_id)}...`, () =>
        api.stop(result.agent_id),
      );
      printSuccess('Agent stopped.');
    } catch {
      // Agent may have already stopped
    }
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep alive
  await new Promise(() => {});
}
