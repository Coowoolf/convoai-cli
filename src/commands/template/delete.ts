import { Command } from 'commander';
import chalk from 'chalk';
import { deleteTemplate, templateExists } from '../../templates/manager.js';
import { printSuccess } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DeleteOptions {
  force?: boolean;
  json?: boolean;
}

// ─── Action ─────────────────────────────────────────────────────────────────

async function deleteAction(name: string, opts: DeleteOptions): Promise<void> {
  if (!templateExists(name)) {
    throw new Error(`Template "${name}" not found. Run \`convoai template list\` to see available templates.`);
  }

  // Confirm deletion unless --force is set
  if (!opts.force) {
    if (!process.stdin.isTTY) {
      throw new Error('Cannot confirm deletion in non-interactive mode. Use --force to skip confirmation.');
    }

    const { safePrompt } = await import('../../ui/prompt.js');
    const { confirmed } = await safePrompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Delete template "${chalk.bold(name)}"?`,
        default: false,
      },
    ]);

    if (!confirmed) {
      console.log('Cancelled.');
      return;
    }
  }

  const deleted = deleteTemplate(name);

  if (opts.json) {
    console.log(JSON.stringify({ deleted: name, success: deleted }, null, 2));
    return;
  }

  if (deleted) {
    printSuccess(`Template "${name}" deleted.`);
  }
}

// ─── Command Registration ─────────────────────────────────────────────────

export function registerTemplateDelete(program: Command): void {
  program
    .command('delete <name>')
    .description('Delete a saved template')
    .option('--force', 'Skip confirmation prompt')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, opts: DeleteOptions) => {
      try {
        await deleteAction(name, opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
