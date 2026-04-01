import { Command } from 'commander';
import type { UpdateAgentRequest, LLMConfig } from '../../api/types.js';
import { getAgentAPI, formatTimestamp } from './_helpers.js';
import { withSpinner } from '../../ui/spinner.js';
import { printKeyValue } from '../../ui/table.js';
import { printSuccess, printError } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';
import { shortId } from '../../utils/hints.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAgentUpdate(program: Command): void {
  program
    .command('update <agent-id>')
    .description('Update a running agent\'s configuration')
    .option('--system-message <msg>', 'Update the system prompt')
    .option('--model <model>', 'Update the LLM model')
    .option('--max-tokens <n>', 'Update max tokens')
    .option('--temperature <n>', 'Update temperature')
    .option('--token <token>', 'Update the RTC token')
    .option('--profile <name>', 'Config profile to use')
    .option('--json', 'Output result as JSON')
    .action(async (agentId: string, opts) => {
      try {
        // Build the update request from provided flags
        const llm: LLMConfig = {};
        let hasLlmUpdate = false;

        if (opts.systemMessage) {
          llm.system_messages = [{ role: 'system', content: opts.systemMessage }];
          hasLlmUpdate = true;
        }

        if (opts.model) {
          llm.model = opts.model;
          hasLlmUpdate = true;
        }

        if (opts.maxTokens !== undefined || opts.temperature !== undefined) {
          llm.params = {};
          if (opts.maxTokens !== undefined) {
            llm.params.max_tokens = parseInt(opts.maxTokens, 10);
          }
          if (opts.temperature !== undefined) {
            llm.params.temperature = parseFloat(opts.temperature);
          }
          hasLlmUpdate = true;
        }

        const request: UpdateAgentRequest = {
          properties: {},
        };

        if (hasLlmUpdate) {
          request.properties.llm = llm;
        }

        if (opts.token) {
          request.properties.token = opts.token;
        }

        // Ensure at least one field is being updated
        if (!hasLlmUpdate && !opts.token) {
          printError(
            'Nothing to update. Provide at least one of: --system-message, --model, --max-tokens, --temperature, --token',
          );
          process.exit(1);
        }

        const api = getAgentAPI(opts.profile);
        const result = await withSpinner(`Updating agent ${shortId(agentId)}...`, () =>
          api.update(agentId, request),
        );

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        printSuccess(`Agent ${shortId(agentId)} updated.`);
        printKeyValue([
          ['Agent ID', result.agent_id],
          ['Status', result.status],
          ['Created', formatTimestamp(result.create_ts)],
        ]);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
