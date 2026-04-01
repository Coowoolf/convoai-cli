import { Command } from 'commander';
import chalk from 'chalk';

// ─── Auth Commands ──────────────────────────────────────────────────────────
import { registerAuthLogin } from './commands/auth/login.js';
import { registerAuthLogout } from './commands/auth/logout.js';
import { registerAuthStatus } from './commands/auth/status.js';

// ─── Agent Commands ─────────────────────────────────────────────────────────
import { registerAgentStart } from './commands/agent/start.js';
import { registerAgentStop } from './commands/agent/stop.js';
import { registerAgentStatus } from './commands/agent/status.js';
import { registerAgentList } from './commands/agent/list.js';
import { registerAgentUpdate } from './commands/agent/update.js';
import { registerAgentSpeak } from './commands/agent/speak.js';
import { registerAgentInterrupt } from './commands/agent/interrupt.js';
import { registerAgentHistory } from './commands/agent/history.js';
import { registerAgentTurns } from './commands/agent/turns.js';
import { registerAgentWatch } from './commands/agent/watch.js';

// ─── Config Commands ────────────────────────────────────────────────────────
import { registerConfigInit } from './commands/config/init.js';
import { registerConfigSet } from './commands/config/set.js';
import { registerConfigGet } from './commands/config/get.js';
import { registerConfigShow } from './commands/config/show.js';
import { registerConfigPath } from './commands/config/path.js';

// ─── Call Commands ─────────────────────────────────────────────────────────
import { registerCallInitiate } from './commands/call/initiate.js';
import { registerCallHangup } from './commands/call/hangup.js';
import { registerCallStatus } from './commands/call/status.js';

// ─── Preset Commands ────────────────────────────────────────────────────────
import { registerPresetList } from './commands/preset/list.js';
import { registerPresetUse } from './commands/preset/use.js';

// ─── Template Commands ─────────────────────────────────────────────────────
import { registerTemplateSave } from './commands/template/save.js';
import { registerTemplateList } from './commands/template/list.js';
import { registerTemplateShow } from './commands/template/show.js';
import { registerTemplateDelete } from './commands/template/delete.js';
import { registerTemplateUse } from './commands/template/use.js';

// ─── Completion & REPL ─────────────────────────────────────────────────────
import { registerCompletion } from './commands/completion.js';
import { registerRepl } from './commands/repl.js';

const VERSION = '1.0.0';

const BANNER = `
${chalk.bold.cyan('convoai')} ${chalk.dim(`v${VERSION}`)}
${chalk.dim('CLI for Agora ConvoAI Engine')}
`;

export function run(): void {
  const program = new Command();

  program
    .name('convoai')
    .description('CLI for Agora ConvoAI Engine — start, manage, and monitor conversational AI agents')
    .version(VERSION, '-v, --version')
    .addHelpText('before', BANNER);

  // ── auth ────────────────────────────────────────────────────────────────
  const auth = program
    .command('auth')
    .description('Manage authentication credentials');

  registerAuthLogin(auth);
  registerAuthLogout(auth);
  registerAuthStatus(auth);

  // ── agent ───────────────────────────────────────────────────────────────
  const agent = program
    .command('agent')
    .alias('a')
    .description('Manage ConvoAI agents');

  registerAgentStart(agent);
  registerAgentStop(agent);
  registerAgentStatus(agent);
  registerAgentList(agent);
  registerAgentUpdate(agent);
  registerAgentSpeak(agent);
  registerAgentInterrupt(agent);
  registerAgentHistory(agent);
  registerAgentTurns(agent);
  registerAgentWatch(agent);

  // ── call ────────────────────────────────────────────────────────────────
  const call = program
    .command('call')
    .description('Manage phone calls (telephony)');

  registerCallInitiate(call);
  registerCallHangup(call);
  registerCallStatus(call);

  // ── config ──────────────────────────────────────────────────────────────
  const config = program
    .command('config')
    .alias('c')
    .description('Manage CLI configuration');

  registerConfigInit(config);
  registerConfigSet(config);
  registerConfigGet(config);
  registerConfigShow(config);
  registerConfigPath(config);

  // ── preset ──────────────────────────────────────────────────────────────
  const preset = program
    .command('preset')
    .alias('p')
    .description('Manage agent presets');

  registerPresetList(preset);
  registerPresetUse(preset);

  // ── template ───────────────────────────────────────────────────────────
  const template = program
    .command('template')
    .alias('t')
    .description('Save and manage reusable agent templates');

  registerTemplateSave(template);
  registerTemplateList(template);
  registerTemplateShow(template);
  registerTemplateDelete(template);
  registerTemplateUse(template);

  // ── completion ──────────────────────────────────────────────────────────
  registerCompletion(program);

  // ── repl ───────────────────────────────────────────────────────────────
  registerRepl(program);

  // ── Global error handling ───────────────────────────────────────────────
  program.exitOverride();

  try {
    program.parse(process.argv);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'exitCode' in err) {
      const exitCode = (err as { exitCode: number }).exitCode;
      if (exitCode === 0) return; // --help or --version
    }
    // Commander already printed the error
    process.exit(1);
  }
}
