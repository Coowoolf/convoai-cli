import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'node:readline';
import { getAgentAPI, formatTimestamp, relativeTime } from './agent/_helpers.js';
import { colorStatus } from '../ui/colors.js';
import { printTable, printKeyValue } from '../ui/table.js';
import { shortId } from '../utils/hints.js';
import { formatApiError } from '../utils/errors.js';
import { resolveConfig } from '../config/manager.js';

// ─── Constants ─────────────────────────────────────────────────────────────

const PROMPT = chalk.cyan('convoai> ');

const COMMANDS = [
  'help',
  'exit',
  'quit',
  'start',
  'stop',
  'status',
  'list',
  'ls',
  'speak',
  'interrupt',
  'history',
  'watch',
  'config',
  'clear',
];

const BANNER = `
  ${chalk.cyan('╔═══════════════════════════════════════╗')}
  ${chalk.cyan('║')}  ${chalk.bold.cyan('ConvoAI Interactive Shell')}            ${chalk.cyan('║')}
  ${chalk.cyan('║')}  Type ${chalk.white('"help"')} for commands, ${chalk.white('"exit"')} to  ${chalk.cyan('║')}
  ${chalk.cyan('║')}  quit. Tab-complete available.        ${chalk.cyan('║')}
  ${chalk.cyan('╚═══════════════════════════════════════╝')}
`;

// ─── Hints ─────────────────────────────────────────────────────────────────

const HINTS: Record<string, string> = {
  start:     `Try ${chalk.dim('status <id>')} to check your new agent, or ${chalk.dim('list')} to see all agents.`,
  stop:      `Use ${chalk.dim('list')} to see remaining agents.`,
  status:    `Try ${chalk.dim('history <id>')} for conversation logs, or ${chalk.dim('speak <id> <text>')} to send a message.`,
  list:      `Use ${chalk.dim('status <id>')} to inspect an agent, or ${chalk.dim('start <channel>')} to create one.`,
  speak:     `Use ${chalk.dim('interrupt <id>')} to cut the agent off, or ${chalk.dim('history <id>')} to review the conversation.`,
  interrupt: `Try ${chalk.dim('speak <id> <text>')} to send a new message.`,
  history:   `Try ${chalk.dim('status <id>')} for agent details, or ${chalk.dim('speak <id> <text>')} to continue.`,
  watch:     `Use ${chalk.dim('stop <id>')} to stop the agent, or ${chalk.dim('history <id>')} for conversation logs.`,
  config:    `Use ${chalk.dim('start <channel>')} to launch an agent with this configuration.`,
};

function printHint(command: string): void {
  const hint = HINTS[command];
  if (hint) {
    console.log(chalk.dim('  Hint: ') + hint);
  }
}

// ─── Help Text ─────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log();
  console.log(chalk.bold('  Available commands:'));
  console.log();

  const cmds: [string, string][] = [
    ['help',                           'Show this help message'],
    ['exit / quit',                    'Exit the REPL'],
    ['start <channel> [--preset name]','Start a new agent on a channel'],
    ['stop <id>',                      'Stop a running agent'],
    ['status <id>',                    'Show agent status details'],
    ['list / ls',                      'List running agents'],
    ['speak <id> <text>',              'Send a TTS message to an agent'],
    ['interrupt <id>',                 'Interrupt a speaking agent'],
    ['history <id>',                   'Show conversation history'],
    ['watch <id>',                     'Poll agent status (single shot)'],
    ['config',                         'Show current configuration summary'],
    ['clear',                          'Clear the screen'],
  ];

  const maxCmd = Math.max(...cmds.map(([c]) => c.length));

  for (const [cmd, desc] of cmds) {
    console.log(`    ${chalk.cyan(cmd.padEnd(maxCmd + 2))} ${chalk.dim(desc)}`);
  }

  console.log();
  console.log(chalk.dim('  Keyboard: Up/Down for history, Tab for completion, Ctrl+C to exit.'));
  console.log();
}

// ─── Command Handlers ──────────────────────────────────────────────────────

async function handleStart(args: string[]): Promise<void> {
  const channel = args[0];
  if (!channel) {
    console.log(chalk.red('  Usage: start <channel> [--preset name]'));
    return;
  }

  // Parse optional --preset flag
  let preset: string | undefined;
  const presetIdx = args.indexOf('--preset');
  if (presetIdx !== -1 && args[presetIdx + 1]) {
    preset = args[presetIdx + 1];
  }

  const api = getAgentAPI();

  // Build a minimal start request
  const { getPreset } = await import('../presets/defaults.js');
  const presetProps = preset ? getPreset(preset) : undefined;

  const config = resolveConfig();

  const request = {
    name: `repl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    properties: {
      channel,
      agent_rtc_uid: 'Agent',
      remote_rtc_uids: ['*'],
      idle_timeout: 30,
      ...presetProps,
      ...(config.llm ? { llm: { ...config.llm, ...presetProps?.llm } } : presetProps?.llm ? { llm: presetProps.llm } : {}),
      ...(config.tts ? { tts: config.tts } : {}),
      ...(config.asr ? { asr: config.asr } : {}),
    },
    ...(preset ? { preset } : {}),
  };

  console.log(chalk.dim('  Starting agent...'));
  const result = await api.start(request);

  console.log(chalk.green('  \u2714 Agent started'));
  printKeyValue([
    ['Agent ID', result.agent_id],
    ['Status', result.status],
    ['Channel', channel],
    ['Created', formatTimestamp(result.create_ts)],
  ]);
}

async function handleStop(args: string[]): Promise<void> {
  const agentId = args[0];
  if (!agentId) {
    console.log(chalk.red('  Usage: stop <agent-id>'));
    return;
  }

  const api = getAgentAPI();
  console.log(chalk.dim(`  Stopping ${shortId(agentId)}...`));
  await api.stop(agentId);
  console.log(chalk.green(`  \u2714 Agent ${shortId(agentId)} stopped.`));
}

async function handleStatus(args: string[]): Promise<void> {
  const agentId = args[0];
  if (!agentId) {
    console.log(chalk.red('  Usage: status <agent-id>'));
    return;
  }

  const api = getAgentAPI();
  console.log(chalk.dim('  Fetching status...'));
  const result = await api.status(agentId);

  const pairs: [string, string][] = [
    ['Agent ID', result.agent_id],
    ['Status', colorStatus(result.status)],
  ];

  if (result.channel) {
    pairs.push(['Channel', result.channel]);
  }

  pairs.push(['Started', formatTimestamp(result.start_ts)]);

  if (result.stop_ts) {
    pairs.push(['Stopped', formatTimestamp(result.stop_ts)]);
  }

  if (result.message) {
    pairs.push(['Message', result.message]);
  }

  printKeyValue(pairs);
}

async function handleList(): Promise<void> {
  const api = getAgentAPI();
  console.log(chalk.dim('  Fetching agents...'));
  const response = await api.list({ state: 2, limit: 20 });

  const agents = response.data.list;
  const total = response.meta.total ?? response.data.count;

  if (agents.length === 0) {
    console.log(chalk.dim('  No running agents found.'));
    return;
  }

  const rows = agents.map((agent) => [
    shortId(agent.agent_id),
    colorStatus(agent.status),
    agent.channel ?? '\u2014',
    relativeTime(agent.start_ts),
  ]);

  printTable(['AGENT_ID', 'STATUS', 'CHANNEL', 'CREATED'], rows);
  console.log(chalk.dim(`\n  Showing ${agents.length} of ${total} agents`));
}

async function handleSpeak(args: string[]): Promise<void> {
  const agentId = args[0];
  const text = args.slice(1).join(' ');

  if (!agentId || !text) {
    console.log(chalk.red('  Usage: speak <agent-id> <text>'));
    return;
  }

  const api = getAgentAPI();
  console.log(chalk.dim('  Sending message...'));
  await api.speak(agentId, { text, priority: 'INTERRUPT', interrupt: true });
  console.log(chalk.green(`  \u2714 Message sent to ${shortId(agentId)}`));
}

async function handleInterrupt(args: string[]): Promise<void> {
  const agentId = args[0];
  if (!agentId) {
    console.log(chalk.red('  Usage: interrupt <agent-id>'));
    return;
  }

  const api = getAgentAPI();
  console.log(chalk.dim('  Interrupting agent...'));
  await api.interrupt(agentId);
  console.log(chalk.green(`  \u2714 Agent ${shortId(agentId)} interrupted.`));
}

async function handleHistory(args: string[]): Promise<void> {
  const agentId = args[0];
  if (!agentId) {
    console.log(chalk.red('  Usage: history <agent-id>'));
    return;
  }

  const api = getAgentAPI();
  console.log(chalk.dim('  Fetching history...'));
  const data = await api.history(agentId);

  console.log();
  console.log(
    `  Agent: ${chalk.bold(shortId(data.agent_id))} | Status: ${colorStatus(data.status)} | Since: ${formatTimestamp(data.start_ts)}`,
  );
  console.log();

  if (data.contents.length === 0) {
    console.log(chalk.dim('  No conversation history yet.'));
  } else {
    for (const entry of data.contents) {
      const roleTag = formatRole(entry.role);
      const content = entry.content || chalk.dim('(empty)');
      console.log(`  ${roleTag} ${content}`);
    }
  }

  console.log();
  console.log(chalk.dim(`  ${data.contents.length} entries total.`));
}

function formatRole(role: 'user' | 'assistant'): string {
  const padded = `[${role}]`.padEnd(13);
  return role === 'user' ? chalk.cyan(padded) : chalk.green(padded);
}

async function handleWatch(args: string[]): Promise<void> {
  const agentId = args[0];
  if (!agentId) {
    console.log(chalk.red('  Usage: watch <agent-id>'));
    return;
  }

  const api = getAgentAPI();
  console.log(chalk.dim('  Polling agent status...'));
  const result = await api.status(agentId);

  const statusLine = colorStatus(result.status);
  const channel = result.channel ?? '\u2014';
  const uptime = relativeTime(result.start_ts);

  console.log();
  console.log(`  ${chalk.bold(shortId(result.agent_id))}  ${statusLine}  ${chalk.dim('ch:')}${channel}  ${chalk.dim('up:')}${uptime}`);

  if (result.message) {
    console.log(`  ${chalk.dim('msg:')} ${result.message}`);
  }
  console.log();
}

function handleConfig(): void {
  const config = resolveConfig();

  const mask = (val: string | undefined): string => {
    if (!val) return chalk.dim('(not set)');
    if (val.length <= 4) return '****';
    return val.slice(0, 4) + '****';
  };

  console.log();
  printKeyValue([
    ['App ID', config.app_id ?? chalk.dim('(not set)')],
    ['Customer ID', config.customer_id ?? chalk.dim('(not set)')],
    ['Customer Secret', mask(config.customer_secret)],
    ['Region', config.region ?? 'global'],
    ['Base URL', config.base_url ?? chalk.dim('(default)')],
    ['LLM Model', config.llm?.model ?? chalk.dim('(not set)')],
    ['TTS Vendor', config.tts?.vendor ?? chalk.dim('(not set)')],
    ['ASR Vendor', config.asr?.vendor ?? chalk.dim('(not set)')],
  ]);
  console.log();
}

// ─── Command Dispatcher ───────────────────────────────────────────────────

async function dispatch(line: string): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) return;

  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case 'help':
      printHelp();
      break;

    case 'exit':
    case 'quit':
      // Handled by the caller
      break;

    case 'start':
      await handleStart(args);
      printHint('start');
      break;

    case 'stop':
      await handleStop(args);
      printHint('stop');
      break;

    case 'status':
      await handleStatus(args);
      printHint('status');
      break;

    case 'list':
    case 'ls':
      await handleList();
      printHint('list');
      break;

    case 'speak':
      await handleSpeak(args);
      printHint('speak');
      break;

    case 'interrupt':
      await handleInterrupt(args);
      printHint('interrupt');
      break;

    case 'history':
      await handleHistory(args);
      printHint('history');
      break;

    case 'watch':
      await handleWatch(args);
      printHint('watch');
      break;

    case 'config':
      handleConfig();
      printHint('config');
      break;

    case 'clear':
      process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
      break;

    default:
      console.log(chalk.red(`  Unknown command: "${command}". Type ${chalk.white('"help"')} for a list of commands.`));
      break;
  }
}

// ─── REPL Loop ─────────────────────────────────────────────────────────────

function startRepl(): void {
  console.log(BANNER);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: PROMPT,
    terminal: true,
    completer: (line: string): [string[], string] => {
      const trimmed = line.trimStart();
      const hits = COMMANDS.filter((c) => c.startsWith(trimmed.toLowerCase()));
      return [hits.length ? hits : COMMANDS, trimmed];
    },
  });

  let ctrlCCount = 0;

  rl.prompt();

  rl.on('line', async (line: string) => {
    // Reset Ctrl+C counter on any input
    ctrlCCount = 0;

    const trimmed = line.trim();

    // Exit commands
    if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
      console.log(chalk.dim('  Goodbye!'));
      rl.close();
      return;
    }

    // Dispatch the command, catching errors per-command
    try {
      await dispatch(trimmed);
    } catch (err: unknown) {
      const message = formatApiError(err);
      console.log(chalk.red(`  Error: ${message}`));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log();
    process.exit(0);
  });

  rl.on('SIGINT', () => {
    ctrlCCount++;

    if (ctrlCCount >= 2) {
      console.log(chalk.dim('\n  Goodbye!'));
      rl.close();
      return;
    }

    // First Ctrl+C: cancel current input
    console.log(chalk.dim('\n  (Press Ctrl+C again to exit)'));
    rl.prompt();
  });
}

// ─── Command Registration ─────────────────────────────────────────────────

export function registerRepl(program: Command): void {
  program
    .command('repl')
    .description('Start an interactive shell for managing agents')
    .action(() => {
      startRepl();
    });
}
