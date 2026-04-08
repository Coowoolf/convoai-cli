import { Command } from 'commander';
import chalk from 'chalk';
import { getCallAPI, getNumberAPI, getConfig, validateE164, pickOutboundNumber } from './_helpers.js';
import { generateRtcToken } from '../../utils/token.js';
import { printSuccess, printError, printHint } from '../../ui/output.js';
import { withSpinner } from '../../ui/spinner.js';
import { handleError } from '../../utils/errors.js';
import { track } from '../../utils/telemetry.js';
import type { SendCallRequest } from '../../api/calls.js';

async function runInlineImport(profileName?: string): Promise<void> {
  const { default: inquirer } = await import('inquirer');
  const { getNumberAPI: getNumAPI, validateE164: valE164 } = await import('./_helpers.js');

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

  const api = getNumAPI(profileName);
  await api.import({
    provider: ans.provider,
    phone_number: valE164(ans.number),
    label: ans.label,
    outbound: true,
    inbound: false,
    outbound_config: { address: ans.address, transport: ans.transport, user: ans.user || undefined, password: ans.password || undefined },
  });

  printSuccess(`Number imported: ${ans.number}`);
  console.log('');
}

export function registerPhoneSend(phone: Command): void {
  phone
    .command('send')
    .description('Make an outbound phone call')
    .option('--from <number>', 'Caller ID (E.164)')
    .option('--to <number>', 'Target number (E.164)')
    .option('--task <prompt>', 'What the AI should do')
    .option('--greeting <text>', 'Opening line')
    .option('--model <model>', 'LLM model override')
    .option('--wait', 'Wait and show status until call ends')
    .option('--max-duration <mins>', 'Max call length in minutes', '10')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .option('--dry-run', 'Show request without sending')
    .action(async (opts) => {
      try {
        const config = getConfig(opts.profile);
        const numberApi = getNumberAPI(opts.profile);
        const callApi = getCallAPI(opts.profile);

        // 1. Resolve "from" number
        let fromNumber = opts.from;
        if (!fromNumber && process.stdin.isTTY) {
          let numbers = await numberApi.list();
          if (numbers.length === 0) {
            await runInlineImport(opts.profile);
            numbers = await numberApi.list();
          }
          const picked = await pickOutboundNumber(numbers);
          fromNumber = picked.phone_number;
        }
        if (!fromNumber) {
          printError('--from is required. Provide a caller number or run interactively.');
          process.exit(1);
        }
        fromNumber = validateE164(fromNumber);

        // Validate from number is outbound-capable
        try {
          const numDetail = await numberApi.get(fromNumber);
          if (!numDetail.outbound) {
            printError(`${fromNumber} does not support outbound calls.`);
            printHint('Import an outbound number: convoai phone import');
            process.exit(1);
          }
        } catch {
          printError(`Number ${fromNumber} not found in your account.`);
          printHint('List numbers: convoai phone numbers');
          process.exit(1);
        }

        // 2. Resolve "to" number
        let toNumber = opts.to;
        if (!toNumber && process.stdin.isTTY) {
          const { default: inquirer } = await import('inquirer');
          const ans = await inquirer.prompt([{
            type: 'input', name: 'to', message: 'To number (E.164):',
            validate: (v: string) => /^\+[1-9]\d{1,14}$/.test(v.trim()) || 'Invalid E.164 format',
          }]);
          toNumber = ans.to;
        }
        if (!toNumber) {
          printError('--to is required.');
          process.exit(1);
        }
        toNumber = validateE164(toNumber);

        // 3. Resolve task/prompt
        let task = opts.task;
        if (!task && process.stdin.isTTY) {
          const { default: inquirer } = await import('inquirer');
          const ans = await inquirer.prompt([{
            type: 'input', name: 'task', message: 'Task/prompt:',
            validate: (v: string) => v.trim().length > 0 || 'Required',
          }]);
          task = ans.task;
        }

        // 4. Confirm
        if (process.stdin.isTTY && !opts.json && !opts.dryRun) {
          const { default: inquirer } = await import('inquirer');
          const { confirm } = await inquirer.prompt([{
            type: 'confirm', name: 'confirm',
            message: `Call ${toNumber} from ${fromNumber}?`,
            default: true,
          }]);
          if (!confirm) return;
        }

        // 5. Generate tokens
        const channelName = `call-${Date.now().toString(36)}`;
        const agentUid = 0;
        const sipUid = 1;

        const configObj = (await import('../../config/manager.js')).loadConfig();
        const appCert = process.env.AGORA_APP_CERTIFICATE ?? configObj.app_certificate;

        const agentToken = await generateRtcToken(channelName, agentUid, 86400, config.app_id, appCert);
        const sipToken = await generateRtcToken(channelName, sipUid, 86400, config.app_id, appCert);

        if (!agentToken || !sipToken) {
          printError('Token generation failed. Check app_certificate.');
          process.exit(1);
        }

        // 6. Build LLM config
        const llm: Record<string, unknown> = { ...(config.llm ?? {}) };
        if (task) {
          llm.system_messages = [{ role: 'system', content: task }];
        }
        if (opts.greeting) {
          llm.greeting_message = opts.greeting;
        }
        if (opts.model) {
          if (!llm.params) llm.params = {};
          (llm.params as Record<string, unknown>).model = opts.model;
        }

        // 7. Build request
        const request: SendCallRequest = {
          name: `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sip: {
            to_number: toNumber,
            from_number: fromNumber,
            rtc_uid: String(sipUid),
            rtc_token: sipToken,
          },
          properties: {
            channel: channelName,
            token: agentToken,
            agent_rtc_uid: String(agentUid),
            remote_rtc_uids: [String(sipUid)],
            idle_timeout: parseInt(opts.maxDuration, 10) * 60 || 600,
            llm,
            tts: config.tts ?? {},
            asr: config.asr ?? {},
          },
        };

        if (opts.dryRun) {
          console.log(JSON.stringify(request, null, 2));
          return;
        }

        // 8. Send call
        const result = await withSpinner('Initiating call...', () => callApi.send(request));
        track('phone_send');

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        printSuccess(`Call initiated (agent_id: ${result.agent_id})`);

        // 9. --wait mode
        if (opts.wait) {
          const maxMs = (parseInt(opts.maxDuration, 10) || 10) * 60 * 1000;
          const startTime = Date.now();
          const { default: ora } = await import('ora');
          const spinner = ora('Ringing...').start();

          const cleanup = () => {
            spinner.stop();
            console.log('');
            printHint(`Call still active. Run: convoai phone hangup ${result.agent_id}`);
            process.exit(0);
          };
          process.on('SIGINT', cleanup);

          let lastStatus = '';
          while (Date.now() - startTime < maxMs) {
            await new Promise(r => setTimeout(r, 2000));
            try {
              const status = await callApi.status(result.agent_id);
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              const mm = String(Math.floor(elapsed / 60));
              const ss = String(elapsed % 60).padStart(2, '0');

              if (status.status !== lastStatus) {
                lastStatus = status.status;
                if (status.status === 'RUNNING') spinner.text = `In conversation (${mm}:${ss})`;
                else if (status.status === 'STARTING') spinner.text = 'Ringing...';
                else if (status.status === 'STOPPED' || status.status === 'FAILED') break;
                else spinner.text = `${status.status} (${mm}:${ss})`;
              } else {
                spinner.text = spinner.text.replace(/\(\d+:\d+\)/, `(${mm}:${ss})`);
              }
            } catch { /* ignore poll errors */ }
          }

          process.removeListener('SIGINT', cleanup);
          const totalSec = Math.floor((Date.now() - startTime) / 1000);
          const totalMm = String(Math.floor(totalSec / 60));
          const totalSs = String(totalSec % 60).padStart(2, '0');

          if (lastStatus === 'STOPPED' || lastStatus === 'FAILED') {
            spinner.succeed(`Call ended (duration: ${totalMm}:${totalSs})`);
          } else {
            // Wait timed out but call may still be active
            spinner.warn(`Wait timeout (${totalMm}:${totalSs}). Call may still be active.`);
            printHint(`convoai phone status ${result.agent_id}`);
            printHint(`convoai phone hangup ${result.agent_id}`);
          }
        } else {
          printHint(`Run: convoai phone status ${result.agent_id}`);
        }
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
