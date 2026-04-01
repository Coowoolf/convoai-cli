import chalk from 'chalk';
import { Command } from 'commander';
import { getAgentAPI } from './_helpers.js';
import { withSpinner } from '../../ui/spinner.js';
import { printTable } from '../../ui/table.js';
import { dim } from '../../ui/colors.js';
import { handleError } from '../../utils/errors.js';
import { shortId } from '../../utils/hints.js';
import type { TurnEntry } from '../../api/types.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAgentTurns(program: Command): void {
  program
    .command('turns <agent-id>')
    .description('View turn-level latency analytics for an agent')
    .option('--profile <name>', 'Use a named config profile')
    .option('--json', 'Output result as JSON')
    .option('--limit <n>', 'Number of turns to show (default: 20)', parseInt)
    .action(async (agentId: string, opts: TurnsOptions) => {
      try {
        await turnsAction(agentId, opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface TurnsOptions {
  profile?: string;
  json?: boolean;
  limit?: number;
}

// ─── Action ────────────────────────────────────────────────────────────────

async function turnsAction(
  agentId: string,
  opts: TurnsOptions,
): Promise<void> {
  const api = getAgentAPI(opts.profile);

  const data = await withSpinner('Fetching turns...', () =>
    api.turns(agentId),
  );

  const limit = opts.limit ?? 20;
  const turns = data.turns.slice(-limit);

  if (opts.json) {
    console.log(JSON.stringify({ ...data, turns }, null, 2));
    return;
  }

  if (turns.length === 0) {
    console.log(dim('No turns recorded yet.'));
    return;
  }

  // ── Table ───────────────────────────────────────────────────────────────
  const headers = ['TURN_ID', 'TYPE', 'END_REASON', 'E2E_LATENCY', 'ASR', 'LLM', 'TTS'];

  const rows = turns.map((turn) => [
    shortId(turn.turn_id),
    turn.type,
    turn.end_reason,
    formatLatency(turn.e2e_latency_ms),
    formatLatency(turn.segmented_latency_ms?.asr_ms),
    formatLatency(turn.segmented_latency_ms?.llm_ms),
    formatLatency(turn.segmented_latency_ms?.tts_ms),
  ]);

  printTable(headers, rows);

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log();
  printAverages(turns);

  const totalCount = data.turns.length;
  if (totalCount > turns.length) {
    console.log(dim(`\nShowing ${turns.length} of ${totalCount} turns.`));
  }
}

// ─── Latency Formatting ───────────────────────────────────────────────────

function formatLatency(ms: number | undefined): string {
  if (ms === undefined || ms === null) return dim('—');
  return colorLatency(ms);
}

function colorLatency(ms: number): string {
  const text = `${ms}ms`;
  if (ms < 1000) return chalk.green(text);
  if (ms <= 2000) return chalk.yellow(text);
  return chalk.red(text);
}

// ─── Averages ──────────────────────────────────────────────────────────────

function printAverages(turns: TurnEntry[]): void {
  const avgE2E = averageOf(turns.map((t) => t.e2e_latency_ms));
  const avgASR = averageOf(turns.map((t) => t.segmented_latency_ms?.asr_ms));
  const avgLLM = averageOf(turns.map((t) => t.segmented_latency_ms?.llm_ms));
  const avgTTS = averageOf(turns.map((t) => t.segmented_latency_ms?.tts_ms));

  const parts: string[] = [];
  if (avgE2E !== null) parts.push(`E2E: ${colorLatency(avgE2E)}`);
  if (avgASR !== null) parts.push(`ASR: ${colorLatency(avgASR)}`);
  if (avgLLM !== null) parts.push(`LLM: ${colorLatency(avgLLM)}`);
  if (avgTTS !== null) parts.push(`TTS: ${colorLatency(avgTTS)}`);

  if (parts.length > 0) {
    console.log(`${dim('Avg latency:')} ${parts.join(dim(' | '))}`);
  }
}

function averageOf(values: (number | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v !== undefined && v !== null);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
}
