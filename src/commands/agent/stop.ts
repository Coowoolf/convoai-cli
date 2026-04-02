import { Command } from 'commander';
import { getAgentAPI } from './_helpers.js';
import { withSpinner } from '../../ui/spinner.js';
import { printSuccess, printError, printHint } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';
import { hintAfterStop, shortId } from '../../utils/hints.js';
import { track } from '../../utils/telemetry.js';

// ─── Confirmation Prompt ───────────────────────────────────────────────────

async function confirmStopAll(count: number): Promise<boolean> {
  const { default: inquirer } = await import('inquirer');
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `Stop all ${count} running agent(s)?`,
      default: false,
    },
  ]);
  return confirmed;
}

// ─── Stop All Running Agents ───────────────────────────────────────────────

async function stopAllAgents(opts: {
  force?: boolean;
  profile?: string;
  json?: boolean;
}): Promise<void> {
  const api = getAgentAPI(opts.profile);

  // List running agents (state=2 means RUNNING)
  const response = await withSpinner('Fetching running agents...', () =>
    api.list({ state: 2, limit: 100 }),
  );

  const agents = response.data.list;

  if (agents.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ stopped: [] }));
    } else {
      printSuccess('No running agents to stop.');
    }
    return;
  }

  // Confirm unless --force
  if (!opts.force) {
    const confirmed = await confirmStopAll(agents.length);
    if (!confirmed) {
      printHint('Aborted. No agents were stopped.');
      return;
    }
  }

  const stopped: string[] = [];
  const failed: Array<{ agent_id: string; error: string }> = [];

  for (const agent of agents) {
    try {
      await withSpinner(`Stopping ${shortId(agent.agent_id)}...`, () =>
        api.stop(agent.agent_id),
      );
      stopped.push(agent.agent_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ agent_id: agent.agent_id, error: message });
    }
  }

  if (opts.json) {
    console.log(JSON.stringify({ stopped, failed }, null, 2));
    return;
  }

  if (stopped.length > 0) {
    printSuccess(`Stopped ${stopped.length} agent(s).`);
  }
  if (failed.length > 0) {
    for (const f of failed) {
      printError(`Failed to stop ${shortId(f.agent_id)}: ${f.error}`);
    }
  }
  printHint(hintAfterStop());
}

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAgentStop(program: Command): void {
  program
    .command('stop [agent-id]')
    .description('Stop a running agent')
    .option('-a, --all', 'Stop all running agents')
    .option('-f, --force', 'Skip confirmation when using --all')
    .option('--profile <name>', 'Config profile to use')
    .option('--json', 'Output result as JSON')
    .action(async (agentId: string | undefined, opts) => {
      try {
        // --all mode: stop every running agent
        if (opts.all) {
          await stopAllAgents({
            force: opts.force,
            profile: opts.profile,
            json: opts.json,
          });
          return;
        }

        // Single agent mode: agent-id is required
        if (!agentId) {
          printError('Agent ID is required. Usage: convoai agent stop <agent-id>');
          process.exit(1);
        }

        const api = getAgentAPI(opts.profile);
        await withSpinner(`Stopping agent ${shortId(agentId)}...`, () =>
          api.stop(agentId),
        );

        if (opts.json) {
          console.log(JSON.stringify({ agent_id: agentId, status: 'STOPPED' }, null, 2));
          return;
        }

        printSuccess(`Agent ${shortId(agentId)} stopped.`);
        track('agent_stop');
        printHint(hintAfterStop());
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
