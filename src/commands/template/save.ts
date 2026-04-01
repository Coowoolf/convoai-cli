import { Command } from 'commander';
import chalk from 'chalk';
import { saveTemplate, templateExists } from '../../templates/manager.js';
import { resolveConfig } from '../../config/manager.js';
import { printSuccess, printHint } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';
import type { AgentTemplate } from '../../templates/manager.js';
import type { AgentProperties } from '../../api/types.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SaveOptions {
  fromAgent?: string;
  description?: string;
  channel?: string;
  model?: string;
  tts?: string;
  asr?: string;
  systemMessage?: string;
  greeting?: string;
  force?: boolean;
  profile?: string;
}

// ─── Action ─────────────────────────────────────────────────────────────────

function saveAction(name: string, opts: SaveOptions): void {
  // Guard against overwriting without --force
  if (templateExists(name) && !opts.force) {
    throw new Error(
      `Template "${name}" already exists. Use ${chalk.bold('--force')} to overwrite.`,
    );
  }

  // Start from the resolved config defaults
  const config = resolveConfig(opts.profile);

  const properties: Partial<AgentProperties> = {};

  // Seed LLM, TTS, ASR from resolved config
  if (config.llm) {
    properties.llm = { ...config.llm };
  }
  if (config.tts) {
    properties.tts = { ...config.tts };
  }
  if (config.asr) {
    properties.asr = { ...config.asr };
  }

  // Apply CLI flag overrides
  if (opts.channel) {
    properties.channel = opts.channel;
  }
  if (opts.model) {
    if (!properties.llm) properties.llm = {};
    properties.llm.model = opts.model;
  }
  if (opts.tts) {
    properties.tts = { vendor: opts.tts };
  }
  if (opts.asr) {
    properties.asr = { vendor: opts.asr };
  }
  if (opts.systemMessage) {
    if (!properties.llm) properties.llm = {};
    properties.llm.system_messages = [{ role: 'system', content: opts.systemMessage }];
  }
  if (opts.greeting) {
    if (!properties.llm) properties.llm = {};
    properties.llm.greeting_message = opts.greeting;
  }

  const now = new Date().toISOString();
  const template: AgentTemplate = {
    name,
    description: opts.description,
    created_at: now,
    updated_at: now,
    properties,
  };

  saveTemplate(template);
  printSuccess(`Template "${name}" saved.`);
  printHint(`Run \`convoai template use ${name} --channel <name>\` to start an agent from this template.`);
}

// ─── Command Registration ─────────────────────────────────────────────────

export function registerTemplateSave(program: Command): void {
  program
    .command('save <name>')
    .description('Save current config as a reusable agent template')
    .option('--from-agent <id>', 'Reference a running agent (uses resolved config defaults)')
    .option('--description <desc>', 'Description for the template')
    .option('-c, --channel <name>', 'Default channel name')
    .option('--model <model>', 'LLM model name')
    .option('--tts <vendor>', 'TTS vendor')
    .option('--asr <vendor>', 'ASR vendor')
    .option('--system-message <msg>', 'System prompt for the LLM')
    .option('--greeting <msg>', 'Greeting message spoken on join')
    .option('--force', 'Overwrite an existing template with the same name')
    .option('--profile <name>', 'Config profile to use')
    .action((name: string, opts: SaveOptions) => {
      try {
        saveAction(name, opts);
      } catch (error) {
        handleError(error);
      }
    });
}
