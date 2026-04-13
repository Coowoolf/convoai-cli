import { Command } from 'commander';
import chalk from 'chalk';
import { getCallAPI, getNumberAPI, getConfig, pickOutboundNumber, buildChannelName, buildCallRequest, buildTTSConfig } from './_helpers.js';
import { generateRtcToken } from '../../utils/token.js';
import { printSuccess, printError, printHint } from '../../ui/output.js';
import { withSpinner } from '../../ui/spinner.js';
import { handleError } from '../../utils/errors.js';
import { track } from '../../utils/telemetry.js';
import { PhoneDashboard } from './_dashboard.js';
import { buildFreeCallConfig, collectFreeParams } from './_modes/free.js';
import { buildTranslateCallConfig, collectTranslateParams } from './_modes/translate.js';
import { buildAgentCallConfig, collectAgentParams } from './_modes/agent.js';
import type { CallConfig } from './_modes/free.js';

type Mode = 'translate' | 'agent' | 'free';

async function selectMode(): Promise<Mode> {
  const { default: inquirer } = await import('inquirer');
  const { mode } = await inquirer.prompt([{
    type: 'list',
    name: 'mode',
    message: 'Choose a mode:',
    choices: [
      { name: '🌐 Translate Call — real-time translation, each side speaks their own language', value: 'translate' },
      { name: '🤖 Agent Outbound — AI completes a task autonomously', value: 'agent' },
      { name: '📱 Free Call — quick dial with optional AI assistance', value: 'free' },
    ],
  }]);
  return mode;
}

async function resolveFromNumber(opts: { from?: string; profile?: string }): Promise<string> {
  const numberApi = getNumberAPI(opts.profile);
  let fromNumber = opts.from;

  if (!fromNumber && process.stdin.isTTY) {
    let numbers = await numberApi.list();
    if (numbers.length === 0) {
      // Inline import wizard
      const { default: inquirer } = await import('inquirer');
      console.log(chalk.yellow('\n  No phone numbers found. Let\'s import one.\n'));
      const ans = await inquirer.prompt([
        { type: 'list', name: 'provider', message: 'Provider:', choices: ['twilio', 'byo'] },
        { type: 'input', name: 'number', message: 'Phone number (E.164):', validate: (v: string) => /^\+[1-9]\d{1,14}$/.test(v.trim()) || 'Invalid format' },
        { type: 'input', name: 'label', message: 'Label:', validate: (v: string) => v.trim().length > 0 || 'Required' },
        { type: 'input', name: 'address', message: 'SIP address:', validate: (v: string) => v.trim().length > 0 || 'Required' },
        { type: 'list', name: 'transport', message: 'Transport:', choices: ['tls', 'tcp', 'udp'], default: 'tls' },
        { type: 'input', name: 'user', message: 'SIP username (optional):' },
        { type: 'password', name: 'password', message: 'SIP password (optional):', mask: '*' },
      ]);
      await numberApi.import({
        provider: ans.provider,
        phone_number: ans.number.trim(),
        label: ans.label,
        outbound: true,
        inbound: false,
        outbound_config: { address: ans.address, transport: ans.transport, user: ans.user || undefined, password: ans.password || undefined },
      });
      printSuccess(`Number imported: ${ans.number}`);
      console.log('');
      numbers = await numberApi.list();
    }
    const picked = await pickOutboundNumber(numbers);
    fromNumber = picked.phone_number;
  }

  if (!fromNumber) {
    throw new Error('--from is required. Provide a caller number or run interactively.');
  }
  return fromNumber;
}

async function goAction(opts: {
  mode?: string;
  to?: string;
  from?: string;
  lang?: string;
  task?: string;
  taskLang?: string;
  dashboard: boolean;
  profile?: string;
  json?: boolean;
  dryRun?: boolean;
}): Promise<void> {
  const config = getConfig(opts.profile);
  const callApi = getCallAPI(opts.profile);

  console.log(chalk.bold('\n📞 ConvoAI Phone\n'));

  // 1. Select mode
  if (opts.mode && !['translate', 'agent', 'free'].includes(opts.mode)) {
    throw new Error(`Invalid mode "${opts.mode}". Use: translate, agent, or free`);
  }
  const mode: Mode = (opts.mode as Mode) || (process.stdin.isTTY ? await selectMode() : (() => { throw new Error('--mode is required in non-TTY'); })());

  // 2. Resolve from number
  const fromNumber = await resolveFromNumber({ from: opts.from, profile: opts.profile });

  // 3. Collect mode-specific params and build call config
  let callConfig: CallConfig;
  let dashboardConfig: Record<string, unknown> = {};

  // Load root config to get voice_profile (which lives on ConvoAIConfig, not ProfileConfig)
  const configObj = (await import('../../config/manager.js')).loadConfig();
  const voiceProfile = configObj.voice_profile;

  if (mode === 'translate') {
    const params = await collectTranslateParams({ to: opts.to, lang: opts.lang });
    callConfig = buildTranslateCallConfig({
      ...params,
      fromNumber,
      llm: config.llm ?? {},
      tts: buildTTSConfig(config.tts ?? {}, voiceProfile),
      asr: config.asr ?? {},
    });
    dashboardConfig = { sourceLang: params.sourceLang, targetLang: params.targetLang };
  } else if (mode === 'agent') {
    const params = await collectAgentParams({ to: opts.to, task: opts.task, taskLang: opts.taskLang });
    callConfig = buildAgentCallConfig({
      ...params,
      fromNumber,
      llm: config.llm ?? {},
      tts: buildTTSConfig(config.tts ?? {}, voiceProfile),
      asr: config.asr ?? {},
    });
    dashboardConfig = { task: params.task, taskLang: params.taskLang };
  } else {
    const params = await collectFreeParams({ to: opts.to, task: opts.task });
    callConfig = buildFreeCallConfig({
      ...params,
      fromNumber,
      llm: config.llm ?? {},
      tts: buildTTSConfig(config.tts ?? {}, voiceProfile),
      asr: config.asr ?? {},
    });
  }

  // 4. Generate tokens
  const channelName = buildChannelName();
  const appCert = process.env.AGORA_APP_CERTIFICATE ?? configObj.app_certificate;

  const agentToken = await generateRtcToken(channelName, 0, 86400, config.app_id!, appCert);
  const sipToken = await generateRtcToken(channelName, 1, 86400, config.app_id!, appCert);

  if (!agentToken || !sipToken) {
    printError('Token generation failed. Check app_certificate.');
    process.exit(1);
  }

  // 5. Build API request
  const { resolveEmbeddedKeys } = await import('../../keys/resolve.js');
  resolveEmbeddedKeys({ llm: callConfig.llm as Record<string, unknown>, tts: callConfig.tts as Record<string, unknown> });

  const request = buildCallRequest({
    fromNumber: callConfig.fromNumber,
    toNumber: callConfig.toNumber,
    channelName,
    agentToken,
    sipToken,
    llm: callConfig.llm,
    tts: callConfig.tts,
    asr: callConfig.asr,
    idleTimeout: callConfig.idleTimeout,
  });

  if (opts.dryRun) {
    console.log(JSON.stringify(request, null, 2));
    return;
  }

  // 6. Initiate call
  const result = await withSpinner('Starting call...', () => callApi.send(request));
  track('phone_go');

  if (opts.json) {
    console.log(JSON.stringify({ agent_id: result.agent_id, mode, channel: channelName }, null, 2));
    return;
  }

  printSuccess(`Call initiated (agent_id: ${result.agent_id})`);

  // 7. Start dashboard (if enabled)
  let dashboard: PhoneDashboard | null = null;
  if (opts.dashboard) {
    dashboard = new PhoneDashboard({
      mode,
      label: callConfig.label,
      agentId: result.agent_id,
      callApi,
      config: dashboardConfig,
    });
    const port = await dashboard.start();
    console.log(chalk.dim(`📊 Dashboard: http://localhost:${port}/phone`));

    // Auto-open browser
    try {
      const { findChrome } = await import('../../utils/find-chrome.js');
      const chromePath = await findChrome();
      if (chromePath) {
        const { execFile } = await import('node:child_process');
        execFile(chromePath, [`http://localhost:${port}/phone`]);
      }
    } catch {
      // Browser auto-open is best-effort
    }
  }

  // 8. CLI status line + graceful shutdown
  const { default: ora } = await import('ora');
  const spinner = ora(callConfig.label).start();
  const startTime = Date.now();

  const cleanup = async () => {
    spinner.stop();
    running = false;
    try {
      await callApi.hangup(result.agent_id);
      printSuccess('Call ended.');
    } catch {
      printHint(`Call may still be active: convoai phone hangup ${result.agent_id}`);
    }
  };

  process.on('SIGINT', cleanup);

  // Poll until call ends
  let running = true;
  while (running) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const status = await callApi.status(result.agent_id);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const ss = String(elapsed % 60).padStart(2, '0');

      if (status.status === 'STOPPED' || status.status === 'FAILED') {
        running = false;
        spinner.succeed(`Call ended (${mm}:${ss})`);
      } else {
        spinner.text = `${callConfig.label} — ${mm}:${ss}`;
      }
    } catch {
      // Ignore poll errors
    }
  }

  process.removeListener('SIGINT', cleanup);
  if (dashboard) await dashboard.stop();
}

export function registerPhoneGo(phone: Command): void {
  phone
    .command('go')
    .description('One-command phone experience — translate, agent, or free call')
    .option('--mode <mode>', 'Skip mode selection (translate|agent|free)')
    .option('--to <number>', 'Target phone number (E.164)')
    .option('--from <number>', 'Caller ID (E.164)')
    .option('--lang <pair>', 'Language pair, e.g. "zh:ja" (translate mode)')
    .option('--task <prompt>', 'Task description (agent/free mode)')
    .option('--task-lang <lang>', 'Language for agent to speak (agent mode)')
    .option('--no-dashboard', 'Skip browser dashboard')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output, no dashboard')
    .option('--dry-run', 'Show request payload without calling')
    .action(async (opts) => {
      try {
        await goAction(opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
