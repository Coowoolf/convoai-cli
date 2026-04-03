import chalk from 'chalk';
import type { AgentAPI } from '../../api/agents.js';
import type { ProfileConfig, HistoryEntry, TurnEntry } from '../../api/types.js';
import { getStrings } from '../../ui/i18n.js';
import { gradientTitle } from '../../ui/gradient.js';
import { printError, printSuccess } from '../../ui/output.js';
import { shortId } from '../../utils/hints.js';
import { LLM_PROVIDERS } from '../../providers/catalog.js';
import { ASR_LANGUAGES } from '../../providers/catalog.js';

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

// ─── Raw-Mode Menu Helper ──────────────────────────────────────────────────

/**
 * Render a numbered menu and wait for a single key press.
 * Stays in raw mode the entire time. Press a number to select,
 * 0/b/Escape to go back.
 */
function showMenu(
  title: string,
  choices: string[],
  onSelect: (index: number) => Promise<void>,
): Promise<void> {
  return new Promise((resolve) => {
    console.clear();
    console.log('');
    console.log(`  ${chalk.bold(title)}`);
    console.log('');
    choices.forEach((choice, i) => {
      console.log(`  ${chalk.cyan(`[${i + 1}]`)} ${choice}`);
    });
    console.log(`  ${chalk.dim('[0]')} ${chalk.dim('Back')}`);
    console.log('');

    const handler = async (key: string): Promise<void> => {
      const num = parseInt(key, 10);
      if (key === '0' || key === 'b' || key === '\u001b') {
        process.stdin.removeListener('data', handler);
        resolve();
        return;
      }
      if (!isNaN(num) && num >= 1 && num <= choices.length) {
        process.stdin.removeListener('data', handler);
        await onSelect(num - 1);
        resolve();
      }
      // Ignore invalid keys silently
    };
    process.stdin.on('data', handler);
  });
}

// ─── Raw-Mode Text Input Helper ────────────────────────────────────────────

/**
 * Temporarily exit raw mode so the user can type a full line of text.
 * Re-enters raw mode after the line is read.
 */
function readInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.setRawMode(false);
    process.stdout.write(`  ${prompt}: `);

    const onData = (data: Buffer): void => {
      const text = data.toString().trim();
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(true);
      resolve(text);
    };
    process.stdin.on('data', onData);
  });
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

  // Keyboard handling — raw mode stays on for the entire session
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

  const keyHandler = async (key: string): Promise<void> => {
    if (state.inSubmenu) return;

    switch (key) {
      case 'l':
        state.inSubmenu = true;
        await llmMenu(opts, state, str);
        await refreshData(opts, state);
        state.inSubmenu = false;
        render(opts, state, str);
        break;
      case 'a':
        state.inSubmenu = true;
        await asrMenu(opts, state, str);
        await refreshData(opts, state);
        state.inSubmenu = false;
        render(opts, state, str);
        break;
      case 't':
        state.inSubmenu = true;
        await ttsMenu(opts, state, str);
        await refreshData(opts, state);
        state.inSubmenu = false;
        render(opts, state, str);
        break;
      case 'v':
        state.inSubmenu = true;
        await vadMenu(opts, state, str);
        await refreshData(opts, state);
        state.inSubmenu = false;
        render(opts, state, str);
        break;
      case 'h':
        state.inSubmenu = true;
        await historyView(opts, state, str);
        state.inSubmenu = false;
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
        break;
    }
  };

  stdin.on('data', keyHandler);
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
  await showMenu(
    str.panelAdjust + ' — LLM',
    [
      str.panelSwitchModel,
      str.panelTemperature,
      str.panelMaxTokens,
      str.panelSystemPrompt,
      `${str.panelSwitchVendor} ${chalk.dim('(requires restart)')}`,
    ],
    async (index) => {
      switch (index) {
        case 0:
          await switchModel(opts, str);
          break;
        case 1:
          await adjustTemperature(opts, str);
          break;
        case 2:
          await adjustMaxTokens(opts, str);
          break;
        case 3:
          await editSystemPrompt(opts, str);
          break;
        case 4:
          console.log('');
          printError(str.panelRestartWarning);
          await pause();
          break;
      }
    },
  );

  await refreshData(opts, state);
}

async function switchModel(
  opts: PanelOpts,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const currentVendor = opts.config.llm?.vendor ?? 'openai';
  const provider = LLM_PROVIDERS.find((p) => p.value === currentVendor);
  const models = provider?.models ?? [];

  if (models.length === 0) {
    console.log('');
    printError('No models available for current provider.');
    await pause();
    return;
  }

  const currentModel = opts.config.llm?.params?.model ?? opts.config.llm?.model;

  await showMenu(
    `${str.panelSwitchModel} (${str.panelCurrent}: ${currentModel ?? 'unknown'})`,
    models,
    async (index) => {
      const model = models[index];
      try {
        await opts.api.update(opts.agentId, {
          properties: { llm: { params: { model } } },
        });
        if (!opts.config.llm) opts.config.llm = {};
        if (!opts.config.llm.params) opts.config.llm.params = {};
        opts.config.llm.params.model = model;
        console.log('');
        printSuccess(`${str.panelUpdated}: model = ${model}`);
        await pause();
      } catch (err) {
        console.log('');
        printError(`Failed to update model: ${err instanceof Error ? err.message : String(err)}`);
        await pause();
      }
    },
  );
}

async function adjustTemperature(
  opts: PanelOpts,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const current = opts.config.llm?.params?.temperature;

  console.clear();
  console.log('');
  console.log(`  ${chalk.bold(str.panelTemperature)}`);
  console.log(`  ${chalk.dim(`${str.panelCurrent}: ${current ?? 'default'}, ${str.panelRange}: 0-2`)}`);
  console.log('');

  const value = await readInput('temperature');
  if (!value) return;

  const temperature = parseFloat(value);
  if (isNaN(temperature) || temperature < 0 || temperature > 2) {
    printError('Enter a number between 0 and 2');
    await pause();
    return;
  }

  try {
    await opts.api.update(opts.agentId, {
      properties: { llm: { params: { temperature } } },
    });
    if (!opts.config.llm) opts.config.llm = {};
    if (!opts.config.llm.params) opts.config.llm.params = {};
    opts.config.llm.params.temperature = temperature;
    printSuccess(`${str.panelUpdated}: temperature = ${temperature}`);
    await pause();
  } catch (err) {
    printError(`Failed to update temperature: ${err instanceof Error ? err.message : String(err)}`);
    await pause();
  }
}

async function adjustMaxTokens(
  opts: PanelOpts,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const current = opts.config.llm?.params?.max_tokens;

  console.clear();
  console.log('');
  console.log(`  ${chalk.bold(str.panelMaxTokens)}`);
  console.log(`  ${chalk.dim(`${str.panelCurrent}: ${current ?? 'default'}`)}`);
  console.log('');

  const value = await readInput('max_tokens');
  if (!value) return;

  const maxTokens = parseInt(value, 10);
  if (isNaN(maxTokens) || maxTokens < 1) {
    printError('Enter a positive integer');
    await pause();
    return;
  }

  try {
    await opts.api.update(opts.agentId, {
      properties: { llm: { params: { max_tokens: maxTokens } } },
    });
    if (!opts.config.llm) opts.config.llm = {};
    if (!opts.config.llm.params) opts.config.llm.params = {};
    opts.config.llm.params.max_tokens = maxTokens;
    printSuccess(`${str.panelUpdated}: max_tokens = ${maxTokens}`);
    await pause();
  } catch (err) {
    printError(`Failed to update max_tokens: ${err instanceof Error ? err.message : String(err)}`);
    await pause();
  }
}

async function editSystemPrompt(
  opts: PanelOpts,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  console.clear();
  console.log('');
  console.log(`  ${chalk.bold(str.panelSystemPrompt)}`);
  console.log('');

  const value = await readInput('system prompt');
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
    await pause();
  } catch (err) {
    printError(`Failed to update system prompt: ${err instanceof Error ? err.message : String(err)}`);
    await pause();
  }
}

// ─── ASR Sub-Menu ───────────────────────────────────────────────────────────

async function asrMenu(
  opts: PanelOpts,
  _state: PanelState,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const currentLang = opts.config.asr?.language ?? opts.config.asr?.params?.language ?? 'en-US';

  await showMenu(
    `ASR Settings (${str.panelCurrent}: ${currentLang})`,
    [
      str.panelSwitchLang,
      `${str.panelSwitchVendor} ${chalk.dim('(requires restart)')}`,
    ],
    async (index) => {
      if (index === 0) {
        await switchLanguage(opts, str);
      } else {
        console.log('');
        printError(str.panelRestartWarning);
        await pause();
      }
    },
  );
}

async function switchLanguage(
  opts: PanelOpts,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const currentLang = opts.config.asr?.language ?? opts.config.asr?.params?.language ?? 'en-US';
  const langChoices = ASR_LANGUAGES.map((l) => `${l.name} (${l.value})`);

  await showMenu(
    `${str.panelSwitchLang} (${str.panelCurrent}: ${currentLang})`,
    langChoices,
    async (_index) => {
      // ASR language change requires restart
      console.log('');
      printError(str.panelRestartWarning);
      await pause();
    },
  );
}

// ─── TTS Sub-Menu ───────────────────────────────────────────────────────────

async function ttsMenu(
  opts: PanelOpts,
  _state: PanelState,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const ttsVendor = opts.config.tts?.vendor ?? 'unknown';

  await showMenu(
    `TTS Settings (${str.panelCurrent}: ${ttsVendor})`,
    [
      `${str.panelSwitchVendor} ${chalk.dim('(requires restart)')}`,
      `${str.panelSpeed} ${chalk.dim('(requires restart)')}`,
      `${str.panelVolume} ${chalk.dim('(requires restart)')}`,
    ],
    async (_index) => {
      // All TTS changes require restart
      console.log('');
      printError(str.panelRestartWarning);
      await pause();
    },
  );
}

// ─── VAD Sub-Menu ───────────────────────────────────────────────────────────

async function vadMenu(
  _opts: PanelOpts,
  _state: PanelState,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  await showMenu(
    'VAD Settings',
    [
      `${str.panelSilenceDuration} ${chalk.dim('(current: 1000ms) (requires restart)')}`,
      `${str.panelInterruptDuration} ${chalk.dim('(current: 160ms) (requires restart)')}`,
      `${str.panelInterruptMode} ${chalk.dim('(current: interrupt) (requires restart)')}`,
    ],
    async (_index) => {
      // All VAD changes require restart
      console.log('');
      printError(str.panelRestartWarning);
      await pause();
    },
  );
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
  console.log(chalk.dim(`  ${state.history.length} entries total.`));
  console.log(`  ${chalk.dim('[0]')} ${chalk.dim('Back')}`);
  console.log('');

  // Wait for any key to return (already in raw mode)
  await new Promise<void>((resolve) => {
    const handler = (key: string): void => {
      process.stdin.removeListener('data', handler);
      // Suppress unused variable — any key returns
      void key;
      resolve();
    };
    process.stdin.on('data', handler);
  });
}

// ─── Pause (wait for any key) ──────────────────────────────────────────────

function pause(): Promise<void> {
  return new Promise((resolve) => {
    console.log(chalk.dim('  Press any key to continue...'));
    const handler = (): void => {
      process.stdin.removeListener('data', handler);
      resolve();
    };
    process.stdin.on('data', handler);
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
