import { Command } from 'commander';
import chalk from 'chalk';
import { getCallAPI, getNumberAPI, getConfig, validateE164, pickOutboundNumber } from '../phone/_helpers.js';
import { generateRtcToken } from '../../utils/token.js';
import { printSuccess, printError, printHint } from '../../ui/output.js';
import { withSpinner } from '../../ui/spinner.js';
import { handleError } from '../../utils/errors.js';
import { loadConfig } from '../../config/manager.js';

export function registerCallInitiate(program: Command): void {
  program
    .command('initiate')
    .description('(deprecated) Use "phone send" instead')
    .option('--phone <number>', 'Phone number (maps to --to)')
    .option('--channel <name>', 'Channel name (ignored)')
    .option('--model <model>', 'LLM model')
    .option('--system-message <msg>', 'System prompt (maps to --task)')
    .option('--greeting <msg>', 'Greeting message')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .option('--dry-run', 'Dry run')
    .action(async (opts) => {
      console.log(chalk.yellow('  ⚠ "call initiate" is deprecated. Use "convoai phone send" instead.'));

      try {
        const config = getConfig(opts.profile);
        const numberApi = getNumberAPI(opts.profile);
        const callApi = getCallAPI(opts.profile);

        // Map old flags to new
        let toNumber = opts.phone;
        const task = opts.systemMessage;

        // If no phone flag, try interactive
        if (!toNumber && process.stdin.isTTY) {
          const { default: inquirer } = await import('inquirer');
          const ans = await inquirer.prompt([{
            type: 'input', name: 'to', message: 'To number (E.164):',
            validate: (v: string) => /^\+[1-9]\d{1,14}$/.test(v.trim()) || 'Invalid E.164',
          }]);
          toNumber = ans.to;
        }
        if (!toNumber) { printError('--phone is required.'); process.exit(1); }
        toNumber = validateE164(toNumber);

        // Pick from number
        const numbers = await numberApi.list();
        if (numbers.length === 0) {
          printError('No phone numbers. Run: convoai phone import');
          process.exit(1);
        }
        const picked = await pickOutboundNumber(numbers);

        const channelName = `call-${Date.now().toString(36)}`;
        const configObj = loadConfig();
        const appCert = process.env.AGORA_APP_CERTIFICATE ?? configObj.app_certificate;
        const agentToken = await generateRtcToken(channelName, 0, 86400, config.app_id, appCert);
        const sipToken = await generateRtcToken(channelName, 1, 86400, config.app_id, appCert);

        if (!agentToken || !sipToken) { printError('Token generation failed.'); process.exit(1); }

        const llm: Record<string, unknown> = { ...(config.llm ?? {}) };
        if (task) llm.system_messages = [{ role: 'system', content: task }];
        if (opts.greeting) llm.greeting_message = opts.greeting;
        if (opts.model) { if (!llm.params) llm.params = {}; (llm.params as any).model = opts.model; }

        const request = {
          name: `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sip: { to_number: toNumber, from_number: picked.phone_number, rtc_uid: '1', rtc_token: sipToken },
          properties: {
            channel: channelName, token: agentToken, agent_rtc_uid: '0', remote_rtc_uids: ['1'],
            idle_timeout: 600, llm, tts: config.tts ?? {}, asr: config.asr ?? {},
          },
        };

        if (opts.dryRun) { console.log(JSON.stringify(request, null, 2)); return; }

        const result = await withSpinner('Initiating call...', () => callApi.send(request));
        if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
        printSuccess(`Call initiated (${result.agent_id})`);
        printHint(`convoai phone status ${result.agent_id}`);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
