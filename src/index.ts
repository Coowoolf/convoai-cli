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
import { registerAgentJoin } from './commands/agent/join.js';

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

// ─── Token ────────────────────────────────────────────────────────────────
import { registerToken } from './commands/token.js';

// ─── Quickstart ───────────────────────────────────────────────────────────
import { registerQuickstart } from './commands/quickstart.js';

// ─── OpenClaw ─────────────────────────────────────────────────────────────
import { registerOpenClaw } from './commands/openclaw.js';

// ─── Go ──────────────────────────────────────────────────────────────────────
import { registerGo } from './commands/go.js';

// ─── Init ────────────────────────────────────────────────────────────────────
import { registerInit } from './commands/init.js';

// ─── Dev ─────────────────────────────────────────────────────────────────────
import { registerDev } from './commands/dev.js';

// ─── Completion ───────────────────────────────────────────────────────────────
import { registerCompletion } from './commands/completion.js';

import { loadConfig } from './config/manager.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  // Walk up from __dirname until we find package.json
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    try {
      const pkgPath = join(dir, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name === 'convoai') return pkg.version ?? '0.0.0';
    } catch { /* keep searching */ }
    dir = dirname(dir);
  }
  return '0.0.0';
}

const VERSION = getVersion();

function customHelp(): string {
  // Try to detect config for smart hint
  let hasConfig = false;
  let isCN = false;
  try {
    const config = loadConfig();
    hasConfig = !!config.app_id;
    isCN = config.region === 'cn';
  } catch {}

  const P = chalk.hex('#786af4');
  const B = chalk.hex('#5b8eff');
  const W = chalk.hex('#c8c8ff');

  const lines: string[] = [];
  lines.push('');
  lines.push(`  ${P('\u2597\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2596')}`);
  lines.push(`  ${P('\u2590')}${B('  ')}${W('\u2588\u2588')}${B('    ')}${W('\u2588\u2588')}${B('   ')}${P('\u258C')}  ${chalk.bold.hex('#786af4')('ConvoAI CLI')} v${VERSION}`);
  lines.push(`  ${P('\u2590')}${B('    ')}${W('\u2580\u2580\u2580\u2580')}${B('    ')}${P('\u258C')}  ${chalk.dim('Voice AI Engine \u26A1\uD83D\uDC26')}`);
  lines.push(`  ${P('\u259D\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2588\u2580\u2580\u2580\u2580\u2598')}`);
  lines.push(`  ${P('         \u2580\u259A')}`);
  lines.push('');

  // Smart hint
  if (hasConfig) {
    const hint = isCN ? '\uD83D\uDCA1 \u7EE7\u7EED\u5BF9\u8BDD: convoai go' : '\uD83D\uDCA1 Quick: convoai go';
    lines.push(`  ${chalk.yellow(hint)}`);
  } else {
    const hint = isCN ? '\uD83D\uDCA1 \u5F00\u59CB\u4F7F\u7528: convoai quickstart' : '\uD83D\uDCA1 Get started: convoai quickstart';
    lines.push(`  ${chalk.yellow(hint)}`);
  }
  lines.push('');

  // Group: Start
  lines.push(chalk.bold('Start:'));
  lines.push(`  ${chalk.cyan('go')}                ${chalk.dim('Start a voice conversation (uses last config)')}`);
  lines.push(`  ${chalk.cyan('init')}              ${chalk.dim('Create a new starter project')}`);
  lines.push(`  ${chalk.cyan('dev')}               ${chalk.dim('Start starter dev server')}`);
  lines.push(`  ${chalk.cyan('quickstart')}        ${chalk.dim('First-time setup wizard')}`);
  lines.push(`  ${chalk.cyan('openclaw')}          ${chalk.dim('Voice-enable your local OpenClaw \uD83E\uDD9E')}`);
  lines.push('');

  // Group: Agent
  lines.push(chalk.bold('Agent:'));
  lines.push(`  ${chalk.cyan('agent join')}        ${chalk.dim('Join a channel with full control')}`);
  lines.push(`  ${chalk.cyan('agent list')}        ${chalk.dim('List running agents')}`);
  lines.push(`  ${chalk.cyan('agent stop')}        ${chalk.dim('Stop agent(s)')}`);
  lines.push(`  ${chalk.cyan('agent status')}      ${chalk.dim('Check agent status')}`);
  lines.push(`  ${chalk.cyan('agent history')}     ${chalk.dim('View conversation history')}`);
  lines.push(`  ${chalk.cyan('agent turns')}       ${chalk.dim('View latency analytics')}`);
  lines.push('');

  // Group: Config
  lines.push(chalk.bold('Config:'));
  lines.push(`  ${chalk.cyan('config show')}       ${chalk.dim('Show current config')}`);
  lines.push(`  ${chalk.cyan('config set')}        ${chalk.dim('Change a setting')}`);
  lines.push(`  ${chalk.cyan('config init')}       ${chalk.dim('Re-run setup wizard')}`);
  lines.push('');

  // Group: More
  lines.push(chalk.bold('More:'));
  lines.push(`  ${chalk.cyan('agent speak')}       ${chalk.dim('Make agent say something')}`);
  lines.push(`  ${chalk.cyan('agent interrupt')}   ${chalk.dim('Interrupt agent speech')}`);
  lines.push(`  ${chalk.cyan('agent start')}       ${chalk.dim('Start agent (API only)')}`);
  lines.push(`  ${chalk.cyan('token')}             ${chalk.dim('Generate RTC token')}`);
  lines.push(`  ${chalk.cyan('preset list')}       ${chalk.dim('List built-in presets')}`);
  lines.push(`  ${chalk.cyan('template')} *        ${chalk.dim('Manage agent templates')}`);
  lines.push(`  ${chalk.cyan('call')} *            ${chalk.dim('Telephony (Beta)')}`);
  lines.push(`  ${chalk.cyan('completion')}        ${chalk.dim('Shell completions')}`);
  lines.push('');

  // Examples
  lines.push(chalk.bold('Examples:'));
  lines.push(chalk.dim('  convoai init my-app                        Create a new project'));
  lines.push(chalk.dim('  convoai go                                 Resume last conversation'));
  lines.push(chalk.dim('  convoai go --setup                         Re-configure then start'));
  lines.push(chalk.dim('  convoai go --model qwen-max                One-time model override'));
  lines.push(chalk.dim('  convoai agent join -c room1                Join a specific channel'));
  lines.push(chalk.dim('  convoai openclaw                           Talk to OpenClaw by voice'));
  lines.push('');

  lines.push(chalk.dim('  Docs: github.com/Coowoolf/convoai-cli'));
  lines.push('');

  return lines.join('\n');
}

export function run(): void {
  // Non-blocking update check (fire and forget)
  import('./utils/update-check.js').then(m => m.checkForUpdate(VERSION)).catch(() => {});

  const program = new Command();

  program
    .name('convoai')
    .description('CLI for Agora ConvoAI Engine — start, manage, and monitor conversational AI agents')
    .version(VERSION, '-v, --version');

  // Override ONLY the root program's help (not subcommands)
  program.helpInformation = function () {
    return customHelp();
  };

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
  registerAgentJoin(agent);

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

  // ── quickstart ──────────────────────────────────────────────────────────
  registerQuickstart(program);

  // ── go ─────────────────────────────────────────────────────────────────
  registerGo(program);

  // ── init ───────────────────────────────────────────────────────────────
  registerInit(program);

  // ── dev ────────────────────────────────────────────────────────────────
  registerDev(program);

  // ── openclaw ───────────────────────────────────────────────────────────
  registerOpenClaw(program);

  // ── token ───────────────────────────────────────────────────────────────
  registerToken(program);

  // ── completion ──────────────────────────────────────────────────────────
  registerCompletion(program);

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
