import { Command } from 'commander';
import chalk from 'chalk';
import { loadTemplate } from '../../templates/manager.js';
import { getAgentAPI, formatTimestamp } from '../agent/_helpers.js';
import { resolveConfig } from '../../config/manager.js';
import { withSpinner } from '../../ui/spinner.js';
import { printKeyValue } from '../../ui/table.js';
import { printSuccess, printHint } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';
import { hintAfterStart } from '../../utils/hints.js';
import type { AgentProperties, LLMConfig, StartAgentRequest } from '../../api/types.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface UseOptions {
  channel?: string;
  profile?: string;
  json?: boolean;
  dryRun?: boolean;
}

// ─── Name Generation ────────────────────────────────────────────────────────

function generateAgentName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `agent-${timestamp}-${random}`;
}

// ─── Action ─────────────────────────────────────────────────────────────────

async function useAction(name: string, opts: UseOptions): Promise<void> {
  const template = loadTemplate(name);

  if (!template) {
    throw new Error(`Template "${name}" not found. Run \`convoai template list\` to see available templates.`);
  }

  // Determine channel: CLI flag > template default > interactive prompt
  let channel = opts.channel ?? template.properties.channel;

  if (!channel && process.stdin.isTTY) {
    const { safePrompt } = await import('../../ui/prompt.js');
    const answers = await safePrompt([
      {
        type: 'input',
        name: 'channel',
        message: 'Channel name:',
      },
    ]);
    channel = answers.channel;
  }

  if (!channel) {
    throw new Error('--channel is required. Provide it as a flag or run interactively in a TTY.');
  }

  // Merge template properties with resolved config
  const config = resolveConfig(opts.profile);

  const llm: LLMConfig = {
    ...config.llm,
    ...template.properties.llm,
  };

  const properties: AgentProperties = {
    ...template.properties,
    channel,
    agent_rtc_uid: template.properties.agent_rtc_uid ?? 'Agent',
    remote_rtc_uids: template.properties.remote_rtc_uids ?? ['*'],
    idle_timeout: template.properties.idle_timeout ?? 30,
    llm: Object.keys(llm).length > 0 ? llm : undefined,
  };

  // Apply TTS: template > config
  if (template.properties.tts) {
    properties.tts = template.properties.tts;
  } else if (config.tts) {
    properties.tts = config.tts;
  }

  // Apply ASR: template > config
  if (template.properties.asr) {
    properties.asr = template.properties.asr;
  } else if (config.asr) {
    properties.asr = config.asr;
  }

  const request: StartAgentRequest = {
    name: generateAgentName(),
    properties,
  };

  // Dry-run: print the request and exit
  if (opts.dryRun) {
    console.log(JSON.stringify(request, null, 2));
    return;
  }

  const api = getAgentAPI(opts.profile);
  const result = await withSpinner(
    `Starting agent from template "${chalk.bold(name)}"...`,
    () => api.start(request),
  );

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printSuccess(`Agent started from template "${name}".`);
  printKeyValue([
    ['Agent ID', result.agent_id],
    ['Status', result.status],
    ['Channel', channel],
    ['Template', name],
    ['Created', formatTimestamp(result.create_ts)],
  ]);
  printHint(hintAfterStart(result.agent_id));
}

// ─── Command Registration ─────────────────────────────────────────────────

export function registerTemplateUse(program: Command): void {
  program
    .command('use <name>')
    .description('Start an agent using a saved template')
    .option('-c, --channel <name>', 'RTC channel name')
    .option('--profile <name>', 'Config profile to use')
    .option('--json', 'Output result as JSON')
    .option('--dry-run', 'Show the request payload without sending it')
    .action(async (name: string, opts: UseOptions) => {
      try {
        await useAction(name, opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
