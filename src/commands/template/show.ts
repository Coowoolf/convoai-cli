import { Command } from 'commander';
import chalk from 'chalk';
import { loadTemplate } from '../../templates/manager.js';
import { printKeyValue } from '../../ui/table.js';
import { handleError } from '../../utils/errors.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ShowOptions {
  json?: boolean;
  raw?: boolean;
}

// ─── Action ─────────────────────────────────────────────────────────────────

function showAction(name: string, opts: ShowOptions): void {
  const template = loadTemplate(name);

  if (!template) {
    throw new Error(`Template "${name}" not found. Run \`convoai template list\` to see available templates.`);
  }

  // --raw: output only the properties object as JSON (useful for piping)
  if (opts.raw) {
    console.log(JSON.stringify(template.properties, null, 2));
    return;
  }

  // --json: output the full template as JSON
  if (opts.json) {
    console.log(JSON.stringify(template, null, 2));
    return;
  }

  // Human-readable detail view
  console.log();
  console.log(chalk.bold(`  Template: ${template.name}`));
  console.log();

  const pairs: [string, string][] = [
    ['Name', template.name],
    ['Description', template.description ?? '—'],
    ['Created', new Date(template.created_at).toLocaleString()],
    ['Updated', new Date(template.updated_at).toLocaleString()],
  ];

  // Agent properties
  const props = template.properties;

  if (props.channel) {
    pairs.push(['Channel', props.channel]);
  }

  if (props.llm) {
    if (props.llm.vendor) pairs.push(['LLM Vendor', props.llm.vendor]);
    if (props.llm.model) pairs.push(['LLM Model', props.llm.model]);
    if (props.llm.style) pairs.push(['LLM Style', props.llm.style]);
    if (props.llm.greeting_message) pairs.push(['Greeting', props.llm.greeting_message]);
    if (props.llm.system_messages?.length) {
      pairs.push(['System Message', props.llm.system_messages[0].content]);
    }
    if (props.llm.max_history !== undefined) {
      pairs.push(['Max History', String(props.llm.max_history)]);
    }
    if (props.llm.params?.temperature !== undefined) {
      pairs.push(['Temperature', String(props.llm.params.temperature)]);
    }
    if (props.llm.params?.max_tokens !== undefined) {
      pairs.push(['Max Tokens', String(props.llm.params.max_tokens)]);
    }
  }

  if (props.tts) {
    if (props.tts.vendor) pairs.push(['TTS Vendor', props.tts.vendor]);
    if (props.tts.params?.voice_name) pairs.push(['TTS Voice', props.tts.params.voice_name]);
    if (props.tts.params?.speed !== undefined) pairs.push(['TTS Speed', String(props.tts.params.speed)]);
  }

  if (props.asr) {
    if (props.asr.vendor) pairs.push(['ASR Vendor', props.asr.vendor]);
    if (props.asr.language) pairs.push(['ASR Language', props.asr.language]);
    if (props.asr.params?.model) pairs.push(['ASR Model', props.asr.params.model]);
  }

  if (props.idle_timeout !== undefined) {
    pairs.push(['Idle Timeout', `${props.idle_timeout}s`]);
  }

  printKeyValue(pairs);
  console.log();
}

// ─── Command Registration ─────────────────────────────────────────────────

export function registerTemplateShow(program: Command): void {
  program
    .command('show <name>')
    .description('Show full details of a saved template')
    .option('--json', 'Output as JSON')
    .option('--raw', 'Output only the properties object as raw JSON (useful for piping)')
    .action((name: string, opts: ShowOptions) => {
      try {
        showAction(name, opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
