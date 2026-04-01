import { Command } from 'commander';
import { listTemplates } from '../../templates/manager.js';
import { printTable } from '../../ui/table.js';
import { printHint } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListOptions {
  json?: boolean;
}

// ─── Action ─────────────────────────────────────────────────────────────────

function listAction(opts: ListOptions): void {
  const templates = listTemplates();

  if (opts.json) {
    console.log(JSON.stringify(templates, null, 2));
    return;
  }

  if (templates.length === 0) {
    console.log('No templates saved yet.');
    printHint('Run `convoai template save <name>` to create one.');
    return;
  }

  const headers = ['NAME', 'DESCRIPTION', 'MODEL', 'TTS', 'CREATED'];

  const rows = templates.map((t) => [
    t.name,
    t.description ?? '—',
    t.properties.llm?.model ?? '—',
    t.properties.tts?.vendor ?? '—',
    new Date(t.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
  ]);

  printTable(headers, rows);

  console.log();
  printHint('Run `convoai template show <name>` to see full details.');
}

// ─── Command Registration ─────────────────────────────────────────────────

export function registerTemplateList(program: Command): void {
  program
    .command('list')
    .description('List all saved agent templates')
    .option('--json', 'Output result as JSON')
    .action((opts: ListOptions) => {
      try {
        listAction(opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
