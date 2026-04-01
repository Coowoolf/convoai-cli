import { Command } from 'commander';
import { listPresets } from '../../presets/defaults.js';
import { printTable } from '../../ui/table.js';
import { printHint } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerPresetList(program: Command): void {
  program
    .command('list')
    .description('List available agent presets')
    .option('--json', 'Output result as JSON')
    .action(async (opts: ListOptions) => {
      try {
        listAction(opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface ListOptions {
  json?: boolean;
}

// ─── Action ────────────────────────────────────────────────────────────────

function listAction(opts: ListOptions): void {
  const presets = listPresets();

  if (opts.json) {
    console.log(JSON.stringify(presets, null, 2));
    return;
  }

  const headers = ['NAME', 'DESCRIPTION', 'LLM', 'TTS', 'ASR'];

  const rows = presets.map((p) => [
    p.name,
    p.description,
    p.llm,
    p.tts,
    p.asr,
  ]);

  printTable(headers, rows);

  console.log();
  printHint('Use `convoai agent start --preset <name>` to start with a preset.');
}
