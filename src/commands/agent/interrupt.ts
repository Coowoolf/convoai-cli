import { Command } from 'commander';
import { getAgentAPI } from './_helpers.js';
import { withSpinner } from '../../ui/spinner.js';
import { printSuccess } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';
import { shortId } from '../../utils/hints.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAgentInterrupt(program: Command): void {
  program
    .command('interrupt <agent-id>')
    .description('Interrupt an agent that is currently speaking')
    .option('--profile <name>', 'Use a named config profile')
    .option('--json', 'Output result as JSON')
    .action(async (agentId: string, opts: InterruptOptions) => {
      try {
        await interruptAction(agentId, opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface InterruptOptions {
  profile?: string;
  json?: boolean;
}

// ─── Action ────────────────────────────────────────────────────────────────

async function interruptAction(
  agentId: string,
  opts: InterruptOptions,
): Promise<void> {
  const api = getAgentAPI(opts.profile);

  await withSpinner('Interrupting agent...', () => api.interrupt(agentId));

  if (opts.json) {
    console.log(JSON.stringify({ agent_id: agentId, interrupted: true }, null, 2));
    return;
  }

  printSuccess(`Agent ${shortId(agentId)} interrupted.`);
}
