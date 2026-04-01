import chalk from 'chalk';
import { Command } from 'commander';
import { getAgentAPI, formatTimestamp, relativeTime } from './_helpers.js';
import { colorStatus } from '../../ui/colors.js';
import { handleError } from '../../utils/errors.js';
import { shortId } from '../../utils/hints.js';
import type { AgentAPI } from '../../api/agents.js';
import type {
  QueryAgentResponse,
  HistoryEntry,
  TurnEntry,
  AgentStatus,
} from '../../api/types.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAgentWatch(program: Command): void {
  program
    .command('watch [agent-id]')
    .description('Real-time agent monitoring dashboard')
    .option('--interval <seconds>', 'Polling interval in seconds', '2')
    .option('--profile <name>', 'Config profile to use')
    .option('--no-clear', 'Do not clear screen between refreshes')
    .action(async (agentId: string | undefined, opts: WatchOptions) => {
      try {
        const interval = parseInterval(opts.interval);
        const api = getAgentAPI(opts.profile);

        if (agentId) {
          await watchSingleAgent(api, agentId, interval, opts.clear);
        } else {
          await watchAllAgents(api, interval, opts.clear);
        }
      } catch (error) {
        handleError(error);
      }
    });
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface WatchOptions {
  interval: string;
  profile?: string;
  clear: boolean;
}

// ─── Single Agent Watch ────────────────────────────────────────────────────

async function watchSingleAgent(
  api: AgentAPI,
  agentId: string,
  intervalSec: number,
  clearScreen: boolean,
): Promise<void> {
  let timer: ReturnType<typeof setInterval> | null = null;

  const cleanup = (message: string): void => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    process.stdout.write('\n');
    console.log(chalk.dim(message));
    process.exit(0);
  };

  process.on('SIGINT', () => cleanup('Stopped watching. Goodbye.'));

  const tick = async (): Promise<boolean> => {
    try {
      const [statusData, historyData, turnsData] = await Promise.all([
        api.status(agentId),
        api.history(agentId).catch(() => null),
        api.turns(agentId).catch(() => null),
      ]);

      if (clearScreen) {
        clearTerminal();
      }

      renderAgentDashboard(statusData, historyData?.contents, turnsData?.turns);

      // Auto-stop on terminal states
      if (statusData.status === 'STOPPED' || statusData.status === 'FAILED') {
        console.log();
        console.log(
          chalk.dim(`Agent reached ${statusData.status} state. Watch ended.`),
        );
        return false;
      }

      return true;
    } catch (error) {
      if (clearScreen) {
        clearTerminal();
      }
      console.error(chalk.red(`Error polling agent: ${formatError(error)}`));
      console.log(chalk.dim('Retrying on next tick...'));
      return true;
    }
  };

  // Initial tick
  const shouldContinue = await tick();
  if (!shouldContinue) {
    process.exit(0);
  }

  // Subsequent ticks
  await new Promise<void>((resolve) => {
    timer = setInterval(async () => {
      const cont = await tick();
      if (!cont) {
        if (timer) clearInterval(timer);
        resolve();
      }
    }, intervalSec * 1000);
  });

  process.exit(0);
}

// ─── All Agents Watch ──────────────────────────────────────────────────────

async function watchAllAgents(
  api: AgentAPI,
  intervalSec: number,
  clearScreen: boolean,
): Promise<void> {
  // Default to a slightly longer interval for the list view
  const effectiveInterval = intervalSec === 2 ? 3 : intervalSec;
  let timer: ReturnType<typeof setInterval> | null = null;

  const cleanup = (message: string): void => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    process.stdout.write('\n');
    console.log(chalk.dim(message));
    process.exit(0);
  };

  process.on('SIGINT', () => cleanup('Stopped watching. Goodbye.'));

  const tick = async (): Promise<void> => {
    try {
      const response = await api.list({ limit: 50 });
      const agents = response.data.list;
      const total = response.meta.total ?? response.data.count;

      if (clearScreen) {
        clearTerminal();
      }

      renderAgentTable(agents, total);
    } catch (error) {
      if (clearScreen) {
        clearTerminal();
      }
      console.error(chalk.red(`Error polling agents: ${formatError(error)}`));
      console.log(chalk.dim('Retrying on next tick...'));
    }
  };

  // Initial tick
  await tick();

  // Subsequent ticks
  timer = setInterval(tick, effectiveInterval * 1000);

  // Keep the process alive until SIGINT
  await new Promise<void>(() => {});
}

// ─── Rendering: Single Agent Dashboard ─────────────────────────────────────

function renderAgentDashboard(
  agent: QueryAgentResponse,
  history?: HistoryEntry[],
  turns?: TurnEntry[],
): void {
  const lines: string[] = [];

  // ── Header ─────────────────────────────────────────────────────────────
  lines.push(chalk.bold.underline('Agent Dashboard'));
  lines.push('');

  // ── Agent Info ──────────────────────────────────────────────────────────
  const uptime = agent.start_ts ? relativeTime(agent.start_ts) : '—';
  const kvPairs: Array<[string, string]> = [
    ['Agent ID', agent.agent_id],
    ['Status', colorStatus(agent.status)],
    ['Uptime', uptime],
  ];

  if (agent.channel) {
    kvPairs.push(['Channel', agent.channel]);
  }

  if (agent.start_ts) {
    kvPairs.push(['Started', formatTimestamp(agent.start_ts)]);
  }

  if (agent.stop_ts) {
    kvPairs.push(['Stopped', formatTimestamp(agent.stop_ts)]);
  }

  if (agent.message) {
    kvPairs.push(['Message', agent.message]);
  }

  const maxKeyLen = Math.max(...kvPairs.map(([k]) => k.length));
  for (const [key, value] of kvPairs) {
    lines.push(`  ${chalk.dim(key.padEnd(maxKeyLen))}  ${value}`);
  }

  // ── History ────────────────────────────────────────────────────────────
  lines.push('');
  lines.push(chalk.bold('Recent Conversation'));

  if (!history || history.length === 0) {
    lines.push(chalk.dim('  No conversation history yet.'));
  } else {
    const recent = history.slice(-5);
    for (const entry of recent) {
      const roleTag = formatRole(entry.role);
      const content = entry.content || chalk.dim('(empty)');
      // Truncate very long messages for the dashboard
      const truncated =
        content.length > 120 ? content.slice(0, 117) + '...' : content;
      lines.push(`  ${roleTag} ${truncated}`);
    }
    if (history.length > 5) {
      lines.push(chalk.dim(`  ... ${history.length - 5} earlier entries`));
    }
  }

  // ── Turn Latency ───────────────────────────────────────────────────────
  lines.push('');
  lines.push(chalk.bold('Latest Turn Latency'));

  if (!turns || turns.length === 0) {
    lines.push(chalk.dim('  No turns recorded yet.'));
  } else {
    const latest = turns[turns.length - 1];
    const latencyParts: string[] = [];

    if (latest.e2e_latency_ms !== undefined) {
      latencyParts.push(`E2E: ${colorLatency(latest.e2e_latency_ms)}`);
    }
    if (latest.segmented_latency_ms?.asr_ms !== undefined) {
      latencyParts.push(`ASR: ${colorLatency(latest.segmented_latency_ms.asr_ms)}`);
    }
    if (latest.segmented_latency_ms?.llm_ms !== undefined) {
      latencyParts.push(`LLM: ${colorLatency(latest.segmented_latency_ms.llm_ms)}`);
    }
    if (latest.segmented_latency_ms?.tts_ms !== undefined) {
      latencyParts.push(`TTS: ${colorLatency(latest.segmented_latency_ms.tts_ms)}`);
    }

    if (latencyParts.length > 0) {
      lines.push(`  ${latencyParts.join(chalk.dim(' | '))}`);
    } else {
      lines.push(chalk.dim('  No latency data for latest turn.'));
    }

    lines.push(
      chalk.dim(
        `  Turn: ${shortId(latest.turn_id)} | Type: ${latest.type} | Result: ${latest.end_reason}`,
      ),
    );

    // Show averages across all turns
    if (turns.length > 1) {
      const avgE2E = averageOf(turns.map((t) => t.e2e_latency_ms));
      if (avgE2E !== null) {
        lines.push(
          chalk.dim(`  Avg E2E across ${turns.length} turns: `) +
            colorLatency(avgE2E),
        );
      }
    }
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  lines.push('');
  lines.push(
    chalk.dim(
      `Last refresh: ${new Date().toLocaleTimeString()} | Watching... (Ctrl+C to stop)`,
    ),
  );

  process.stdout.write(lines.join('\n') + '\n');
}

// ─── Rendering: All Agents Table ───────────────────────────────────────────

function renderAgentTable(
  agents: Array<{
    agent_id: string;
    status: AgentStatus;
    start_ts: number;
    stop_ts?: number;
    channel?: string;
  }>,
  total: number,
): void {
  const lines: string[] = [];

  lines.push(chalk.bold.underline('Agent Watch'));
  lines.push('');

  if (agents.length === 0) {
    lines.push(chalk.dim('  No agents found.'));
  } else {
    // Table header
    const colId = 'AGENT_ID'.padEnd(14);
    const colStatus = 'STATUS'.padEnd(12);
    const colChannel = 'CHANNEL'.padEnd(20);
    const colStarted = 'STARTED';

    lines.push(
      `  ${chalk.bold(colId)}  ${chalk.bold(colStatus)}  ${chalk.bold(colChannel)}  ${chalk.bold(colStarted)}`,
    );
    lines.push(chalk.dim(`  ${'─'.repeat(14)}  ${'─'.repeat(12)}  ${'─'.repeat(20)}  ${'─'.repeat(10)}`));

    for (const agent of agents) {
      const id = shortId(agent.agent_id).padEnd(14);
      const status = colorStatus(agent.status).padEnd(12 + ansiPadding(agent.status));
      const channel = (agent.channel ?? '—').padEnd(20);
      const started = relativeTime(agent.start_ts);

      lines.push(`  ${id}  ${status}  ${channel}  ${started}`);
    }
  }

  lines.push('');
  lines.push(
    chalk.dim(
      `${agents.length} of ${total} agents | Last refresh: ${new Date().toLocaleTimeString()} | Watching... (Ctrl+C to stop)`,
    ),
  );

  process.stdout.write(lines.join('\n') + '\n');
}

// ─── Terminal Helpers ──────────────────────────────────────────────────────

function clearTerminal(): void {
  // Move cursor to top-left and clear entire screen
  process.stdout.write('\x1b[2J\x1b[H');
}

// ─── Formatting Helpers ────────────────────────────────────────────────────

function formatRole(role: 'user' | 'assistant'): string {
  const padded = `[${role}]`.padEnd(13);
  return role === 'user' ? chalk.cyan(padded) : chalk.green(padded);
}

function colorLatency(ms: number): string {
  const text = `${ms}ms`;
  if (ms < 1000) return chalk.green(text);
  if (ms <= 2000) return chalk.yellow(text);
  return chalk.red(text);
}

function averageOf(values: (number | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v !== undefined && v !== null);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
}

/**
 * Calculate the number of extra bytes ANSI color codes add to a status string,
 * so padEnd can account for non-printable characters.
 */
function ansiPadding(status: AgentStatus): number {
  return colorStatus(status).length - status.length;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// ─── Validation ────────────────────────────────────────────────────────────

function parseInterval(value: string): number {
  const seconds = parseFloat(value);
  if (Number.isNaN(seconds) || seconds < 0.5) {
    throw new Error('Interval must be a number >= 0.5 seconds');
  }
  return seconds;
}
