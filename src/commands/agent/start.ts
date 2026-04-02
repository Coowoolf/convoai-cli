import { Command } from 'commander';
import type { StartAgentRequest, AgentProperties, LLMConfig } from '../../api/types.js';
import { getAgentAPI, formatTimestamp } from './_helpers.js';
import { resolveConfig } from '../../config/manager.js';
import { getPreset } from '../../presets/defaults.js';
import { generateRtcToken } from '../../utils/token.js';
import { withSpinner } from '../../ui/spinner.js';
import { printKeyValue } from '../../ui/table.js';
import { printSuccess, printError, printHint } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';
import { hintAfterStart } from '../../utils/hints.js';

// ─── Name Generation ───────────────────────────────────────────────────────

function generateAgentName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `agent-${timestamp}-${random}`;
}

// ─── Interactive Prompts ───────────────────────────────────────────────────

interface PromptAnswers {
  channel: string;
  preset?: string;
  model?: string;
}

async function promptForMissing(opts: {
  channel?: string;
  preset?: string;
  model?: string;
}): Promise<PromptAnswers> {
  // Dynamic import so inquirer is only loaded when needed
  const { default: inquirer } = await import('inquirer');

  const questions: Array<{
    type: string;
    name: string;
    message: string;
    default?: string;
    when?: boolean;
  }> = [];

  if (!opts.channel) {
    questions.push({
      type: 'input',
      name: 'channel',
      message: 'Channel name:',
    });
  }

  if (!opts.preset) {
    questions.push({
      type: 'input',
      name: 'preset',
      message: 'Preset (leave empty for none):',
    });
  }

  if (!opts.model) {
    questions.push({
      type: 'input',
      name: 'model',
      message: 'LLM model (leave empty for config default):',
    });
  }

  if (questions.length === 0) {
    return {
      channel: opts.channel!,
      preset: opts.preset,
      model: opts.model,
    };
  }

  const answers = await inquirer.prompt(questions);

  return {
    channel: opts.channel ?? answers.channel,
    preset: (opts.preset ?? answers.preset) || undefined,
    model: (opts.model ?? answers.model) || undefined,
  };
}

// ─── Request Builder ───────────────────────────────────────────────────────

function buildRequest(opts: {
  channel: string;
  name?: string;
  preset?: string;
  model?: string;
  llmUrl?: string;
  llmKey?: string;
  tts?: string;
  asr?: string;
  systemMessage?: string;
  greeting?: string;
  uid?: string;
  remoteUids?: string;
  idleTimeout?: string;
  token?: string;
  profile?: string;
}): StartAgentRequest {
  const config = resolveConfig(opts.profile);

  // Start with preset properties if specified
  const presetProps = opts.preset ? getPreset(opts.preset) : undefined;

  // Build LLM config by layering: config defaults -> preset -> CLI flags
  // Deep merge so config api_key/url are preserved when preset sets vendor/model
  const llm: LLMConfig = {
    ...config.llm,
    ...presetProps?.llm,
    // Preserve config credentials that presets don't provide
    api_key: config.llm?.api_key ?? presetProps?.llm?.api_key,
    url: config.llm?.url ?? presetProps?.llm?.url,
  };

  if (opts.model) {
    llm.model = opts.model;
  }
  if (opts.llmUrl) {
    llm.url = opts.llmUrl;
  }
  if (opts.llmKey) {
    llm.api_key = opts.llmKey;
  }
  if (opts.systemMessage) {
    llm.system_messages = [{ role: 'system', content: opts.systemMessage }];
  }
  if (opts.greeting) {
    llm.greeting_message = opts.greeting;
  }

  // Build the agent properties
  const properties: AgentProperties = {
    ...presetProps,
    channel: opts.channel,
    token: opts.token,
    agent_rtc_uid: opts.uid ?? presetProps?.agent_rtc_uid ?? '0',
    remote_rtc_uids: opts.remoteUids
      ? opts.remoteUids.split(',').map((u) => u.trim())
      : presetProps?.remote_rtc_uids ?? ['*'],
    idle_timeout: opts.idleTimeout
      ? parseInt(opts.idleTimeout, 10)
      : presetProps?.idle_timeout ?? 30,
    llm: Object.keys(llm).length > 0 ? llm : undefined,
  };

  // Apply TTS: deep merge config + preset + CLI flag (config keys preserved)
  if (opts.tts) {
    properties.tts = { ...config.tts, vendor: opts.tts, params: { ...config.tts?.params } };
  } else {
    properties.tts = {
      ...config.tts,
      ...presetProps?.tts,
      params: { ...config.tts?.params, ...presetProps?.tts?.params },
    };
  }

  // Apply ASR: deep merge config + preset + CLI flag
  if (opts.asr) {
    properties.asr = { ...config.asr, vendor: opts.asr, params: { ...config.asr?.params } };
  } else {
    properties.asr = {
      ...config.asr,
      ...presetProps?.asr,
      params: { ...config.asr?.params, ...presetProps?.asr?.params },
    };
  }

  const request: StartAgentRequest = {
    name: opts.name ?? generateAgentName(),
    properties,
  };

  return request;
}

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAgentStart(program: Command): void {
  program
    .command('start')
    .description('Start a new conversational AI agent')
    .option('-c, --channel <name>', 'RTC channel name (required)')
    .option('-n, --name <name>', 'Agent name (auto-generated if omitted)')
    .option('--preset <name>', 'Use a built-in preset configuration')
    .option('--model <model>', 'LLM model name (e.g. gpt-4o-mini)')
    .option('--llm-url <url>', 'LLM API URL')
    .option('--llm-key <key>', 'LLM API key')
    .option('--tts <vendor>', 'TTS vendor')
    .option('--asr <vendor>', 'ASR vendor')
    .option('--system-message <msg>', 'System prompt for the LLM')
    .option('--greeting <msg>', 'Greeting message spoken on join')
    .option('--uid <uid>', 'Agent RTC UID (default: "0" for random assignment)')
    .option('--remote-uids <uids>', 'Comma-separated remote UIDs (default: "*")')
    .option('--idle-timeout <seconds>', 'Idle timeout in seconds (default: 30)')
    .option('--token <token>', 'RTC token (auto-generated if app_certificate is configured)')
    .option('--profile <name>', 'Config profile to use')
    .option('--json', 'Output result as JSON')
    .option('--dry-run', 'Show the request payload without sending it')
    .action(async (opts) => {
      try {
        let channel: string | undefined = opts.channel;
        let model: string | undefined = opts.model;
        let preset: string | undefined = opts.preset;

        // Interactive prompts if running in a TTY and channel is missing
        if (!channel && process.stdin.isTTY) {
          const answers = await promptForMissing({ channel, preset, model });
          channel = answers.channel;
          preset = answers.preset ?? preset;
          model = answers.model ?? model;
        }

        if (!channel) {
          printError('--channel is required. Provide it as a flag or run interactively in a TTY.');
          process.exit(1);
        }

        // Auto-generate RTC token if not provided and certificate is configured
        let token: string | undefined = opts.token;
        if (!token) {
          const uid = opts.uid ? parseInt(opts.uid, 10) : 0;
          token = await generateRtcToken(channel, uid);
        }

        const request = buildRequest({
          channel,
          name: opts.name,
          preset,
          model,
          llmUrl: opts.llmUrl,
          llmKey: opts.llmKey,
          tts: opts.tts,
          asr: opts.asr,
          systemMessage: opts.systemMessage,
          greeting: opts.greeting,
          uid: opts.uid,
          remoteUids: opts.remoteUids,
          idleTimeout: opts.idleTimeout,
          token,
          profile: opts.profile,
        });

        // Dry-run mode: print request and exit
        if (opts.dryRun) {
          console.log(JSON.stringify(request, null, 2));
          return;
        }

        const api = getAgentAPI(opts.profile);
        const result = await withSpinner('Starting agent...', () => api.start(request));

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        printSuccess(`Agent started successfully.`);
        printKeyValue([
          ['Agent ID', result.agent_id],
          ['Status', result.status],
          ['Channel', channel],
          ['Created', formatTimestamp(result.create_ts)],
        ]);
        printHint(hintAfterStart(result.agent_id, channel));
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
