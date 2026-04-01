import { Command } from 'commander';
import type { ListAgentsParams } from '../../api/types.js';
import { getAgentAPI, relativeTime } from './_helpers.js';
import { withSpinner } from '../../ui/spinner.js';
import { printTable } from '../../ui/table.js';
import { printHint } from '../../ui/output.js';
import { colorStatus } from '../../ui/colors.js';
import { handleError } from '../../utils/errors.js';
import { hintAfterList, shortId } from '../../utils/hints.js';

// ─── State Name Mapping ────────────────────────────────────────────────────

const STATE_MAP: Record<string, number | undefined> = {
  running: 2,
  stopped: 4,
  failed: 6,
  all: undefined,
};

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAgentList(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List agents')
    .option('-s, --state <state>', 'Filter by state: running, stopped, failed, all', 'running')
    .option('-c, --channel <name>', 'Filter by channel name')
    .option('-l, --limit <n>', 'Maximum number of agents to return', '20')
    .option('--profile <name>', 'Config profile to use')
    .option('--json', 'Output result as JSON')
    .action(async (opts) => {
      try {
        const stateName = opts.state.toLowerCase();
        if (!(stateName in STATE_MAP)) {
          throw new Error(
            `Invalid state "${opts.state}". Choose from: running, stopped, failed, all`,
          );
        }

        const params: ListAgentsParams = {
          state: STATE_MAP[stateName],
          limit: parseInt(opts.limit, 10),
        };

        if (opts.channel) {
          params.channel = opts.channel;
        }

        const api = getAgentAPI(opts.profile);
        const response = await withSpinner('Fetching agents...', () => api.list(params));

        if (opts.json) {
          console.log(JSON.stringify(response, null, 2));
          return;
        }

        const agents = response.data.list;
        const total = response.meta.total ?? response.data.count;

        if (agents.length === 0) {
          console.log(`No ${stateName === 'all' ? '' : stateName + ' '}agents found.`);
          printHint(hintAfterList());
          return;
        }

        const rows = agents.map((agent) => [
          shortId(agent.agent_id),
          colorStatus(agent.status),
          agent.channel ?? '—',
          relativeTime(agent.start_ts),
        ]);

        printTable(['AGENT_ID', 'STATUS', 'CHANNEL', 'CREATED'], rows);

        console.log(`\nShowing ${agents.length} of ${total} agents`);
        printHint(hintAfterList());
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
