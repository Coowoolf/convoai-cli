import chalk from 'chalk';
import { Command } from 'commander';
import { getAgentAPI, formatTimestamp } from './_helpers.js';
import { withSpinner } from '../../ui/spinner.js';
import { handleError } from '../../utils/errors.js';
import { hintAfterHistory, shortId } from '../../utils/hints.js';
import { printHint } from '../../ui/output.js';
import { colorStatus, dim } from '../../ui/colors.js';
import type { HistoryEntry } from '../../api/types.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAgentHistory(program: Command): void {
  program
    .command('history <agent-id>')
    .description('View conversation history for an agent')
    .option('--profile <name>', 'Use a named config profile')
    .option('--json', 'Output result as JSON')
    .option('--limit <n>', 'Show only the last N entries', parseInt)
    .action(async (agentId: string, opts: HistoryOptions) => {
      try {
        await historyAction(agentId, opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface HistoryOptions {
  profile?: string;
  json?: boolean;
  limit?: number;
}

// ─── Action ────────────────────────────────────────────────────────────────

async function historyAction(
  agentId: string,
  opts: HistoryOptions,
): Promise<void> {
  const api = getAgentAPI(opts.profile);

  const data = await withSpinner('Fetching history...', () =>
    api.history(agentId),
  );

  if (opts.json) {
    const output = opts.limit
      ? { ...data, contents: data.contents.slice(-opts.limit) }
      : data;
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const entries = opts.limit
    ? data.contents.slice(-opts.limit)
    : data.contents;

  // ── Header ──────────────────────────────────────────────────────────────
  console.log();
  console.log(
    `Agent: ${chalk.bold(shortId(data.agent_id))} | Status: ${colorStatus(data.status)} | Since: ${formatTimestamp(data.start_ts)}`,
  );
  console.log();

  // ── Conversation ────────────────────────────────────────────────────────
  if (entries.length === 0) {
    console.log(dim('  No conversation history yet.'));
  } else {
    for (const entry of entries) {
      printEntry(entry);
    }
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  console.log();
  const totalCount = data.contents.length;
  const shownCount = entries.length;
  if (opts.limit && totalCount > shownCount) {
    console.log(dim(`Showing ${shownCount} of ${totalCount} entries.`));
  } else {
    console.log(dim(`${totalCount} entries total.`));
  }

  printHint(hintAfterHistory(agentId));
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function printEntry(entry: HistoryEntry): void {
  const roleTag = formatRole(entry.role);
  // Wrap long content to keep output readable
  const content = entry.content || dim('(empty)');
  console.log(`${roleTag} ${content}`);
}

function formatRole(role: 'user' | 'assistant'): string {
  const padded = `[${role}]`.padEnd(13);
  return role === 'user'
    ? chalk.cyan(padded)
    : chalk.green(padded);
}
