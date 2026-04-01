import { Command } from 'commander';
import type { InitiateCallRequest } from '../../api/calls.js';
import { resolveConfig } from '../../config/manager.js';
import { getCallAPI, formatTimestamp } from './_helpers.js';
import { withSpinner } from '../../ui/spinner.js';
import { printKeyValue } from '../../ui/table.js';
import { printSuccess, printError, printHint } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';
import { shortId } from '../../utils/hints.js';

// ─── Name Generation ───────────────────────────────────────────────────────

function generateCallName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `call-${timestamp}-${random}`;
}

function generateChannelName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `call-ch-${timestamp}-${random}`;
}

// ─── Interactive Prompts ───────────────────────────────────────────────────

async function promptForPhone(): Promise<string> {
  const { default: inquirer } = await import('inquirer');
  const { phone } = await inquirer.prompt([
    {
      type: 'input',
      name: 'phone',
      message: 'Phone number (E.164 format, e.g. +15551234567):',
    },
  ]);
  return phone;
}

// ─── Request Builder ───────────────────────────────────────────────────────

function buildRequest(opts: {
  phone: string;
  channel?: string;
  model?: string;
  systemMessage?: string;
  greeting?: string;
  profile?: string;
}): InitiateCallRequest {
  const config = resolveConfig(opts.profile);

  const properties: InitiateCallRequest['properties'] = {
    channel: opts.channel ?? generateChannelName(),
    phone_number: opts.phone,
  };

  // Build LLM config from CLI flags and config defaults
  const llm: NonNullable<InitiateCallRequest['properties']['llm']> = {};
  let hasLlm = false;

  if (opts.model) {
    llm.params = { model: opts.model };
    hasLlm = true;
  }
  if (opts.systemMessage) {
    llm.system_messages = [{ role: 'system', content: opts.systemMessage }];
    hasLlm = true;
  }
  if (opts.greeting) {
    llm.greeting_message = opts.greeting;
    hasLlm = true;
  }

  // Apply config-level LLM defaults if present
  if (config.llm) {
    if (config.llm.url && !llm.params) {
      llm.url = config.llm.url;
      hasLlm = true;
    }
    if (config.llm.api_key) {
      llm.api_key = config.llm.api_key;
      hasLlm = true;
    }
  }

  if (hasLlm) {
    properties.llm = llm;
  }

  // Apply TTS from config
  if (config.tts) {
    properties.tts = config.tts;
  }

  // Apply ASR from config
  if (config.asr) {
    properties.asr = config.asr;
  }

  return {
    name: generateCallName(),
    properties,
  };
}

// ─── Command Registration ──────────────────────────────────────────────────

export function registerCallInitiate(program: Command): void {
  program
    .command('initiate')
    .description('Initiate an outbound phone call')
    .option('--phone <number>', 'Phone number in E.164 format (required)')
    .option('-c, --channel <name>', 'Channel name (auto-generated if omitted)')
    .option('--model <model>', 'LLM model name (e.g. gpt-4o-mini)')
    .option('--system-message <msg>', 'System prompt for the LLM')
    .option('--greeting <msg>', 'Greeting message spoken on connect')
    .option('--profile <name>', 'Config profile to use')
    .option('--json', 'Output result as JSON')
    .option('--dry-run', 'Show the request payload without sending it')
    .action(async (opts) => {
      try {
        let phone: string | undefined = opts.phone;

        // Interactive prompt if running in a TTY and phone is missing
        if (!phone && process.stdin.isTTY) {
          phone = await promptForPhone();
        }

        if (!phone) {
          printError('--phone is required. Provide it as a flag or run interactively in a TTY.');
          process.exit(1);
        }

        const request = buildRequest({
          phone,
          channel: opts.channel,
          model: opts.model,
          systemMessage: opts.systemMessage,
          greeting: opts.greeting,
          profile: opts.profile,
        });

        // Dry-run mode: print request and exit
        if (opts.dryRun) {
          console.log(JSON.stringify(request, null, 2));
          return;
        }

        const api = getCallAPI(opts.profile);
        const result = await withSpinner('Initiating call...', () => api.initiate(request));

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        printSuccess('Call initiated successfully.');
        printKeyValue([
          ['Agent ID', result.agent_id],
          ['Status', result.status],
          ['Phone', phone],
          ['Channel', request.properties.channel],
        ]);
        printHint(`Run \`convoai call status ${shortId(result.agent_id)}\` to check call status.`);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
