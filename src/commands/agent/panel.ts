import chalk from 'chalk';
import type { AgentAPI } from '../../api/agents.js';
import type { ProfileConfig, HistoryEntry, TurnEntry } from '../../api/types.js';
import { getStrings } from '../../ui/i18n.js';
import { gradientTitle } from '../../ui/gradient.js';
import { printError, printSuccess } from '../../ui/output.js';
import { shortId } from '../../utils/hints.js';
import { LLM_PROVIDERS } from '../../providers/catalog.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PanelOpts {
  api: AgentAPI;
  agentId: string;
  channel: string;
  lang: 'cn' | 'global';
  config: ProfileConfig;
  onExit: () => Promise<void>;
}

interface PanelState {
  history: HistoryEntry[];
  turns: TurnEntry[];
  inSubmenu: boolean;
}

// ─── Entry Point ────────────────────────────────────────────────────────────

export async function runPanel(opts: PanelOpts): Promise<void> {
  const str = getStrings(opts.lang === 'cn' ? 'cn' : 'global');
  const state: PanelState = { history: [], turns: [], inSubmenu: false };

  // Initial data fetch (best-effort)
  await refreshData(opts, state);

  // Render initial screen
  render(opts, state, str);

  // Auto-refresh polling
  const pollTimer = setInterval(async () => {
    if (state.inSubmenu) return;
    await refreshData(opts, state);
    render(opts, state, str);
  }, 3000);

  // Keyboard handling
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  const cleanup = async (): Promise<void> => {
    clearInterval(pollTimer);
    stdin.setRawMode(false);
    stdin.removeAllListeners('data');
    stdin.pause();
  };

  const exitPanel = async (): Promise<void> => {
    await cleanup();
    await showSessionReport(opts, state, str);
    await opts.onExit();
    process.exit(0);
  };

  // SIGINT handler
  const sigintHandler = async (): Promise<void> => {
    await exitPanel();
  };
  process.on('SIGINT', sigintHandler);

  stdin.on('data', async (key: string) => {
    if (state.inSubmenu) return;

    switch (key) {
      case 'l':
        await openSubmenu(state, stdin, () => llmMenu(opts, state, str));
        render(opts, state, str);
        break;
      case 'a':
        await openSubmenu(state, stdin, () => asrMenu(opts, str));
        render(opts, state, str);
        break;
      case 't':
        await openSubmenu(state, stdin, () => ttsMenu(opts, str));
        render(opts, state, str);
        break;
      case 'v':
        await openSubmenu(state, stdin, () => vadMenu(str));
        render(opts, state, str);
        break;
      case 'h':
        await openSubmenu(state, stdin, () => historyView(opts, state, str));
        render(opts, state, str);
        break;
      case 'q':
        process.removeListener('SIGINT', sigintHandler);
        await exitPanel();
        break;
      case '\u0003': // Ctrl+C
        process.removeListener('SIGINT', sigintHandler);
        await exitPanel();
        break;
      default:
        // Ignore other keys
        break;
    }
  });
}

// ─── Submenu Helper ─────────────────────────────────────────────────────────

async function openSubmenu(
  state: PanelState,
  stdin: NodeJS.ReadStream,
  fn: () => Promise<void>,
): Promise<void> {
  state.inSubmenu = true;
  stdin.setRawMode(false);
  stdin.pause();

  try {
    await fn();
  } catch {
    // Swallow prompt errors (e.g. user force-cancels)
  }

  stdin.resume();
  stdin.setRawMode(true);
  state.inSubmenu = false;
}

// ─── Data Refresh ───────────────────────────────────────────────────────────

async function refreshData(opts: PanelOpts, state: PanelState): Promise<void> {
  try {
    const [historyRes, turnsRes] = await Promise.all([
      opts.api.history(opts.agentId).catch(() => null),
      opts.api.turns(opts.agentId).catch(() => null),
    ]);
    if (historyRes) state.history = historyRes.contents ?? [];
    if (turnsRes) state.turns = turnsRes.turns ?? [];
  } catch {
    // Non-fatal — keep stale data
  }
}

// ─── Render ─────────────────────────────────────────────────────────────────

function render(
  opts: PanelOpts,
  state: PanelState,
  str: ReturnType<typeof getStrings>,
): void {
  const lines: string[] = [];

  // Status line
  const shortAgent = shortId(opts.agentId);
  lines.push(
    `  ${chalk.green('\u26A1')} ${chalk.bold(str.panelRunning)} ${chalk.dim('\u00B7')} ${chalk.cyan(shortAgent)} ${chalk.dim('\u00B7')} Channel: ${chalk.cyan(opts.channel)}`,
  );

  // Separator
  lines.push(`  ${gradientTitle('\u2500'.repeat(52))}`);

  // Config grid
  const asrVendor = opts.config.asr?.vendor ?? 'ares';
  const asrLang = opts.config.asr?.language ?? opts.config.asr?.params?.language ?? 'en-US';
  const llmModel = opts.config.llm?.params?.model ?? opts.config.llm?.model ?? 'unknown';
  const ttsVendor = opts.config.tts?.vendor ?? 'unknown';
  const silenceMs = '500';

  lines.push(
    `  ${chalk.yellow('\uD83C\uDF99')} ${asrVendor} (${asrLang})    ${chalk.magenta('\uD83E\uDDE0')} ${llmModel}`,
  );
  lines.push(
    `  ${chalk.blue('\uD83D\uDD0A')} ${ttsVendor}    ${chalk.dim('\u23F1')} VAD ${silenceMs}ms`,
  );

  // Stats
  const turnCount = state.turns.length;
  const avgLatency = computeAvgLatency(state.turns);
  lines.push('');
  lines.push(
    `  ${str.panelConversation}: ${chalk.bold(String(turnCount))} ${str.panelTurns} ${chalk.dim('\u00B7')} ${str.panelAvgLatency} ${chalk.bold(avgLatency)}`,
  );

  // Separator
  lines.push(`  ${gradientTitle('\u2500'.repeat(52))}`);

  // Key legend
  lines.push('');
  lines.push(
    `  ${chalk.cyan('[a]')} ASR  ${chalk.cyan('[l]')} LLM  ${chalk.cyan('[t]')} TTS  ${chalk.cyan('[v]')} VAD  ${chalk.cyan('[h]')} ${str.panelHistory}  ${chalk.cyan('[q]')} ${str.panelExit}`,
  );
  lines.push('');

  // Write to screen: cursor home + content + clear-to-end
  process.stdout.write('\x1b[H' + lines.join('\n') + '\x1b[J');
}

// ─── Avg Latency Computation ────────────────────────────────────────────────

function computeAvgLatency(turns: TurnEntry[]): string {
  const values = turns
    .map((t) => t.e2e_latency_ms)
    .filter((v): v is number => v !== undefined && v !== null);
  if (values.length === 0) return '--';
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return `${(avg / 1000).toFixed(1)}s`;
}

// ─── LLM Sub-Menu ───────────────────────────────────────────────────────────

async function llmMenu(
  opts: PanelOpts,
  state: PanelState,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const { default: inquirer } = await import('inquirer');

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: str.panelAdjust,
      choices: [
        { name: str.panelSwitchModel, value: 'model' },
        { name: str.panelSwitchVendor, value: 'vendor' },
        { name: str.panelTemperature, value: 'temperature' },
        { name: str.panelMaxTokens, value: 'max_tokens' },
        { name: str.panelSystemPrompt, value: 'system_prompt' },
        { name: str.panelBack, value: 'back' },
      ],
    },
  ]);

  if (action === 'back') return;

  if (action === 'model') {
    await switchModel(opts, str);
  } else if (action === 'vendor') {
    printError(str.panelRestartWarning);
  } else if (action === 'temperature') {
    await adjustTemperature(opts, str);
  } else if (action === 'max_tokens') {
    await adjustMaxTokens(opts, str);
  } else if (action === 'system_prompt') {
    await editSystemPrompt(opts, str);
  }

  // Refresh data after changes
  await refreshData(opts, state);
}

async function switchModel(
  opts: PanelOpts,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const { default: inquirer } = await import('inquirer');

  const currentVendor = opts.config.llm?.vendor ?? 'openai';
  const provider = LLM_PROVIDERS.find((p) => p.value === currentVendor);
  const models = provider?.models ?? [];

  if (models.length === 0) {
    printError('No models available for current provider.');
    return;
  }

  const currentModel = opts.config.llm?.params?.model ?? opts.config.llm?.model;

  const { model } = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: `${str.panelSwitchModel} (${str.panelCurrent}: ${currentModel ?? 'unknown'})`,
      choices: models.map((m) => ({ name: m, value: m })),
    },
  ]);

  try {
    await opts.api.update(opts.agentId, {
      properties: { llm: { params: { model } } },
    });
    // Update local config state
    if (!opts.config.llm) opts.config.llm = {};
    if (!opts.config.llm.params) opts.config.llm.params = {};
    opts.config.llm.params.model = model;
    printSuccess(`${str.panelUpdated}: model = ${model}`);
  } catch (err) {
    printError(`Failed to update model: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function adjustTemperature(
  opts: PanelOpts,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const { default: inquirer } = await import('inquirer');

  const current = opts.config.llm?.params?.temperature;

  const { value } = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message: `${str.panelTemperature} (${str.panelCurrent}: ${current ?? 'default'}, ${str.panelRange}: 0-2)`,
      validate: (input: string) => {
        const n = parseFloat(input);
        if (Number.isNaN(n) || n < 0 || n > 2) return 'Enter a number between 0 and 2';
        return true;
      },
    },
  ]);

  const temperature = parseFloat(value);

  try {
    await opts.api.update(opts.agentId, {
      properties: { llm: { params: { temperature } } },
    });
    if (!opts.config.llm) opts.config.llm = {};
    if (!opts.config.llm.params) opts.config.llm.params = {};
    opts.config.llm.params.temperature = temperature;
    printSuccess(`${str.panelUpdated}: temperature = ${temperature}`);
  } catch (err) {
    printError(`Failed to update temperature: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function adjustMaxTokens(
  opts: PanelOpts,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const { default: inquirer } = await import('inquirer');

  const current = opts.config.llm?.params?.max_tokens;

  const { value } = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message: `${str.panelMaxTokens} (${str.panelCurrent}: ${current ?? 'default'})`,
      validate: (input: string) => {
        const n = parseInt(input, 10);
        if (Number.isNaN(n) || n < 1) return 'Enter a positive integer';
        return true;
      },
    },
  ]);

  const maxTokens = parseInt(value, 10);

  try {
    await opts.api.update(opts.agentId, {
      properties: { llm: { params: { max_tokens: maxTokens } } },
    });
    if (!opts.config.llm) opts.config.llm = {};
    if (!opts.config.llm.params) opts.config.llm.params = {};
    opts.config.llm.params.max_tokens = maxTokens;
    printSuccess(`${str.panelUpdated}: max_tokens = ${maxTokens}`);
  } catch (err) {
    printError(`Failed to update max_tokens: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function editSystemPrompt(
  opts: PanelOpts,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const { default: inquirer } = await import('inquirer');

  const { value } = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message: str.panelSystemPrompt,
    },
  ]);

  if (!value) return;

  try {
    await opts.api.update(opts.agentId, {
      properties: {
        llm: {
          system_messages: [{ role: 'system', content: value }],
        },
      },
    });
    printSuccess(`${str.panelUpdated}: system prompt`);
  } catch (err) {
    printError(`Failed to update system prompt: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── ASR Sub-Menu ───────────────────────────────────────────────────────────

async function asrMenu(
  opts: PanelOpts,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const { default: inquirer } = await import('inquirer');

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: str.panelAdjust,
      choices: [
        { name: str.panelSwitchLang, value: 'lang' },
        { name: str.panelSwitchVendor, value: 'vendor' },
        { name: str.panelBack, value: 'back' },
      ],
    },
  ]);

  if (action === 'back') return;

  // Both ASR changes require restart
  printError(str.panelRestartWarning);
}

// ─── TTS Sub-Menu ───────────────────────────────────────────────────────────

async function ttsMenu(
  opts: PanelOpts,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const { default: inquirer } = await import('inquirer');

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: str.panelAdjust,
      choices: [
        { name: str.panelSwitchVendor, value: 'vendor' },
        { name: str.panelSpeed, value: 'speed' },
        { name: str.panelVolume, value: 'volume' },
        { name: str.panelBack, value: 'back' },
      ],
    },
  ]);

  if (action === 'back') return;

  if (action === 'vendor') {
    // TTS vendor change requires restart
    printError(str.panelRestartWarning);
  } else {
    // Speed/volume: TTS params are not in UpdateAgentRequest (only token + llm)
    // so these also require restart for now
    printError(str.panelRestartWarning);
  }
}

// ─── VAD Sub-Menu ───────────────────────────────────────────────────────────

async function vadMenu(
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const { default: inquirer } = await import('inquirer');

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: str.panelAdjust,
      choices: [
        { name: str.panelSilenceDuration, value: 'silence' },
        { name: str.panelInterruptDuration, value: 'interrupt_dur' },
        { name: str.panelInterruptMode, value: 'interrupt_mode' },
        { name: str.panelBack, value: 'back' },
      ],
    },
  ]);

  if (action === 'back') return;

  // All VAD changes require restart
  printError(str.panelRestartWarning);
}

// ─── History View ───────────────────────────────────────────────────────────

async function historyView(
  opts: PanelOpts,
  state: PanelState,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  // Fetch latest history
  await refreshData(opts, state);

  console.clear();
  console.log();
  console.log(chalk.bold(`  ${str.panelHistory}`));
  console.log(chalk.dim(`  ${'─'.repeat(50)}`));
  console.log();

  if (state.history.length === 0) {
    console.log(chalk.dim('  No conversation history yet.'));
  } else {
    for (const entry of state.history) {
      const roleTag =
        entry.role === 'user'
          ? chalk.cyan('[user]     ')
          : chalk.green('[assistant]');
      const content = entry.content || chalk.dim('(empty)');
      // Truncate very long messages
      const truncated =
        content.length > 200 ? content.slice(0, 197) + '...' : content;
      console.log(`  ${roleTag} ${truncated}`);
    }
  }

  console.log();
  console.log(chalk.dim(`  ${state.history.length} entries total. Press any key to return.`));

  // Wait for any keypress
  await waitForKeypress();
}

function waitForKeypress(): Promise<void> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.once('data', () => {
      stdin.setRawMode(false);
      stdin.pause();
      resolve();
    });
  });
}

// ─── Session Report ─────────────────────────────────────────────────────────

async function showSessionReport(
  opts: PanelOpts,
  state: PanelState,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  // Final data refresh
  await refreshData(opts, state);

  console.clear();
  console.log();
  console.log(chalk.bold(`  ${str.panelConversation} - ${shortId(opts.agentId)}`));
  console.log(chalk.dim(`  ${'─'.repeat(50)}`));
  console.log();

  // History summary
  if (state.history.length > 0) {
    const last5 = state.history.slice(-5);
    for (const entry of last5) {
      const roleTag =
        entry.role === 'user'
          ? chalk.cyan('[user]     ')
          : chalk.green('[assistant]');
      const content = entry.content || chalk.dim('(empty)');
      const truncated =
        content.length > 120 ? content.slice(0, 117) + '...' : content;
      console.log(`  ${roleTag} ${truncated}`);
    }
    if (state.history.length > 5) {
      console.log(chalk.dim(`  ... ${state.history.length - 5} earlier entries`));
    }
  } else {
    console.log(chalk.dim('  No conversation history.'));
  }

  // Turns table
  console.log();
  console.log(chalk.bold(`  ${str.panelTurns}: ${state.turns.length}`));

  if (state.turns.length > 0) {
    const avgLatency = computeAvgLatency(state.turns);
    console.log(`  ${str.panelAvgLatency}: ${chalk.bold(avgLatency)}`);

    // Show last 5 turns
    console.log();
    console.log(
      `  ${chalk.dim('TURN'.padEnd(14))}  ${chalk.dim('TYPE'.padEnd(16))}  ${chalk.dim('E2E'.padEnd(8))}  ${chalk.dim('RESULT')}`,
    );
    console.log(chalk.dim(`  ${'─'.repeat(14)}  ${'─'.repeat(16)}  ${'─'.repeat(8)}  ${'─'.repeat(12)}`));

    const lastTurns = state.turns.slice(-5);
    for (const turn of lastTurns) {
      const id = shortId(turn.turn_id).padEnd(14);
      const type = turn.type.padEnd(16);
      const e2e = turn.e2e_latency_ms !== undefined ? `${turn.e2e_latency_ms}ms`.padEnd(8) : '--'.padEnd(8);
      console.log(`  ${id}  ${type}  ${e2e}  ${turn.end_reason}`);
    }
  }

  console.log();
}
