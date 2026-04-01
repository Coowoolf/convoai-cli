import { Command } from 'commander';
import { getAgentAPI } from './_helpers.js';
import { withSpinner } from '../../ui/spinner.js';
import { printSuccess } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';
import { shortId } from '../../utils/hints.js';
import type { SpeakPriority } from '../../api/types.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerAgentSpeak(program: Command): void {
  program
    .command('speak <agent-id> <text>')
    .description('Instruct an agent to speak the given text')
    .option(
      '--priority <priority>',
      'Message priority: INTERRUPT, APPEND, or IGNORE',
      'INTERRUPT',
    )
    .option(
      '--no-interrupt',
      'Prevent user from voice-interrupting this message',
    )
    .option('--profile <name>', 'Use a named config profile')
    .option('--json', 'Output result as JSON')
    .action(async (agentId: string, text: string, opts: SpeakOptions) => {
      try {
        await speakAction(agentId, text, opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface SpeakOptions {
  priority: string;
  interrupt: boolean;
  profile?: string;
  json?: boolean;
}

// ─── Action ────────────────────────────────────────────────────────────────

async function speakAction(
  agentId: string,
  text: string,
  opts: SpeakOptions,
): Promise<void> {
  const priority = validatePriority(opts.priority);
  const api = getAgentAPI(opts.profile);

  const response = await withSpinner('Sending message...', () =>
    api.speak(agentId, {
      text,
      priority,
      interrupt: opts.interrupt,
    }),
  );

  if (opts.json) {
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  printSuccess(`Message sent to agent ${shortId(agentId)}`);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const VALID_PRIORITIES: SpeakPriority[] = ['INTERRUPT', 'APPEND', 'IGNORE'];

function validatePriority(value: string): SpeakPriority {
  const upper = value.toUpperCase() as SpeakPriority;
  if (!VALID_PRIORITIES.includes(upper)) {
    throw new Error(
      `Invalid priority "${value}". Must be one of: ${VALID_PRIORITIES.join(', ')}`,
    );
  }
  return upper;
}
