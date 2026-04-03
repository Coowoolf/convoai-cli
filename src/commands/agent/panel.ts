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
  _sharedState?: PanelState;
  ptt?: boolean; // push-to-talk mode
  wsBroadcast?: (msg: Record<string, unknown>) => void; // send to WebSocket clients
}

interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  turnId: number;
  final: boolean;
  interrupted: boolean;
}

interface PanelState {
  history: HistoryEntry[];
  turns: TurnEntry[];
  inSubmenu: boolean;
  printedCount: number;
  // Real-time transcript state
  transcriptEntries: TranscriptEntry[];
  transcriptPrintedCount: number;
  ephemeral: TranscriptEntry | null;
  lastEphemeralText: string;
  hasLiveTranscript: boolean; // true once we receive first RTM/DataStream message
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
  const state: PanelState = opts._sharedState ?? {
    history: [], turns: [], inSubmenu: false, printedCount: 0,
    transcriptEntries: [], transcriptPrintedCount: 0,
    ephemeral: null, lastEphemeralText: '', hasLiveTranscript: false,
  };

  // Print header once (never redrawn)
  printHeader(opts, str);

  // Initial data fetch
  await refreshData(opts, state);
  printNewMessages(state, str);

  // Always poll history + turns as fallback (printedCount prevents duplicates)
  const pollTimer = setInterval(async () => {
    if (state.inSubmenu) return;
    await refreshData(opts, state);
    // Only print from polling if live transcript hasn't printed them already
    if (!state.hasLiveTranscript) {
      printNewMessages(state, str);
    }
  }, 2000);

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

  // ── PTT (Push-to-Talk) via spacebar ──────────────────────────────────
  let pttActive = false;
  let pttTimer: ReturnType<typeof setTimeout> | null = null;

  function pttPress(): void {
    if (!opts.ptt || !opts.wsBroadcast) return;
    if (!pttActive) {
      pttActive = true;
      opts.wsBroadcast({ type: 'ptt_on' });
      // Show PTT indicator
      process.stdout.write(`\r\x1b[K  ${chalk.green.bold('🎙 Speaking...')} ${chalk.dim('(release space to stop)')}`);
    }
    // Reset release timer — if no more space keys within 150ms, consider released
    if (pttTimer) clearTimeout(pttTimer);
    pttTimer = setTimeout(() => {
      if (pttActive) {
        pttActive = false;
        opts.wsBroadcast!({ type: 'ptt_off' });
        process.stdout.write(`\r\x1b[K  ${chalk.dim('🎙 Hold space to talk')}`);
      }
    }, 150);
  }

  const keyHandler = async (key: string): Promise<void> => {
    if (state.inSubmenu) return;

    // PTT: spacebar
    if (key === ' ' && opts.ptt) {
      pttPress();
      return;
    }

    switch (key) {
      case 'l':
        state.inSubmenu = true;
        await llmMenu(opts, state, str);
        await refreshData(opts, state);
        state.inSubmenu = false;
        printHeader(opts, str);
        printNewMessages(state, str);
        break;
      case 'a':
        state.inSubmenu = true;
        await asrMenu(opts, state, str);
        await refreshData(opts, state);
        state.inSubmenu = false;
        printHeader(opts, str);
        printNewMessages(state, str);
        break;
      case 't':
        state.inSubmenu = true;
        await ttsMenu(opts, state, str);
        await refreshData(opts, state);
        state.inSubmenu = false;
        printHeader(opts, str);
        printNewMessages(state, str);
        break;
      case 'v':
        state.inSubmenu = true;
        await vadMenu(opts, state, str);
        await refreshData(opts, state);
        state.inSubmenu = false;
        printHeader(opts, str);
        printNewMessages(state, str);
        break;
      // [h] removed — conversation streams live in the panel
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

// ─── Print Header (once, on start and after sub-menus) ─────────────────────

function printHeader(
  opts: PanelOpts,
  str: ReturnType<typeof getStrings>,
): void {
  console.clear();

  const shortAgent = shortId(opts.agentId);
  const asrVendor = opts.config.asr?.vendor ?? 'ares';
  const asrLang = opts.config.asr?.language ?? 'en-US';
  const llmModel = opts.config.llm?.params?.model ?? opts.config.llm?.model ?? '?';
  const ttsVendor = opts.config.tts?.vendor ?? '?';
  const silenceMs = opts.config.turn_detection?.silence_duration_ms ?? 1000;

  console.log('');
  console.log(`  ${chalk.green('\u26A1')} ${chalk.bold(str.panelRunning)} ${chalk.dim('\u00B7')} ${chalk.cyan(shortAgent)} ${chalk.dim('\u00B7')} Channel: ${chalk.cyan(opts.channel)}`);
  console.log(`  ${chalk.yellow('\uD83C\uDF99')} ${asrVendor} (${asrLang})  ${chalk.magenta('\uD83E\uDDE0')} ${llmModel}  ${chalk.blue('\uD83D\uDD0A')} ${ttsVendor}  ${chalk.dim('\u23F1')} ${silenceMs}ms`);
  console.log(`  ${gradientTitle('\u2500'.repeat(52))}`);
  console.log('');
  if (opts.ptt) {
    console.log(chalk.dim(`  ${chalk.cyan('[space]')} Hold to talk  ${chalk.cyan('[a]')} ASR  ${chalk.cyan('[l]')} LLM  ${chalk.cyan('[t]')} TTS  ${chalk.cyan('[v]')} VAD  ${chalk.cyan('[q]')} ${str.panelExit}`));
  } else {
    console.log(chalk.dim(`  ${chalk.cyan('[a]')} ASR  ${chalk.cyan('[l]')} LLM  ${chalk.cyan('[t]')} TTS  ${chalk.cyan('[v]')} VAD  ${chalk.cyan('[q]')} ${str.panelExit}`));
  }
  console.log(`  ${gradientTitle('\u2500'.repeat(52))}`);
  console.log('');
}

// ─── Print New Messages (append only, no redraw) ───────────────────────────

// Typewriter queue — messages wait here to be animated one by one
let typewriterBusy = false;
const typewriterQueue: Array<{ prefix: string; text: string }> = [];

async function typewrite(prefix: string, text: string): Promise<void> {
  process.stdout.write(`  ${prefix} `);
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    process.stdout.write(chars[i]);
    // Fast: 20ms per char, but skip delay for spaces and every 3rd char for speed
    if (chars[i] !== ' ' && i % 3 === 0) {
      await new Promise(r => setTimeout(r, 20));
    }
  }
  process.stdout.write('\n');
}

async function processTypewriterQueue(): Promise<void> {
  if (typewriterBusy) return;
  typewriterBusy = true;
  while (typewriterQueue.length > 0) {
    const item = typewriterQueue.shift()!;
    await typewrite(item.prefix, item.text);
  }
  typewriterBusy = false;
}

function printNewMessages(
  state: PanelState,
  _str: ReturnType<typeof getStrings>,
): void {
  const newEntries = state.history.slice(state.printedCount);
  if (newEntries.length === 0) return;

  // Match turns with assistant messages for latency
  let turnIdx = 0;
  for (let i = 0; i < state.printedCount; i++) {
    if (state.history[i].role === 'assistant') turnIdx++;
  }

  for (const entry of newEntries) {
    if (entry.role === 'assistant') {
      const latency = turnIdx < state.turns.length ? state.turns[turnIdx]?.e2e_latency_ms : undefined;
      const tag = latency ? chalk.dim(`[${latency < 1000 ? `${latency}ms` : `${(latency / 1000).toFixed(1)}s`}] `) : '';
      // Assistant messages get typewriter effect
      typewriterQueue.push({
        prefix: `${chalk.green('[assistant]')} ${tag}`,
        text: entry.content || '',
      });
      turnIdx++;
    } else {
      // User messages appear instantly
      typewriterQueue.push({
        prefix: chalk.cyan('[you]      '),
        text: entry.content || '',
      });
    }
  }

  state.printedCount = state.history.length;
  processTypewriterQueue();
}

// ─── Live Transcript Handler ────────────────────────────────────────────────

export function handleTranscriptMessage(state: PanelState, msg: Record<string, unknown>): void {
  const obj = msg.object as string;
  const turnId = (msg.turn_id as number) ?? 0;

  state.hasLiveTranscript = true;

  if (obj === 'user.transcription') {
    const isFinal = msg.final as boolean;
    const text = msg.text as string;

    if (isFinal) {
      // Clear ephemeral, commit final
      if (state.ephemeral) {
        // Clear the ephemeral line
        process.stdout.write('\r\x1b[K');
        state.ephemeral = null;
        state.lastEphemeralText = '';
      }
      console.log(`  ${chalk.cyan('[you]      ')} ${text}`);
      state.transcriptEntries.push({ role: 'user', text, turnId, final: true, interrupted: false });
    } else {
      // Partial: overwrite current line
      state.ephemeral = { role: 'user', text, turnId, final: false, interrupted: false };
      process.stdout.write(`\r\x1b[K  ${chalk.dim('[you]      ')} ${chalk.dim(text)}`);
      state.lastEphemeralText = text;
    }
  } else if (obj === 'assistant.transcription') {
    const turnStatus = msg.turn_status as number;
    const text = msg.text as string;

    if (turnStatus === 0) {
      // IN_PROGRESS: overwrite current line with growing text
      state.ephemeral = { role: 'assistant', text, turnId, final: false, interrupted: false };
      process.stdout.write(`\r\x1b[K  ${chalk.green('[assistant]')} ${text}`);
      state.lastEphemeralText = text;
    } else if (turnStatus === 1) {
      // END: commit
      if (state.ephemeral) {
        process.stdout.write('\r\x1b[K');
        state.ephemeral = null;
        state.lastEphemeralText = '';
      }
      console.log(`  ${chalk.green('[assistant]')} ${text}`);
      state.transcriptEntries.push({ role: 'assistant', text, turnId, final: true, interrupted: false });
    } else if (turnStatus === 2) {
      // INTERRUPTED: commit with marker
      if (state.ephemeral) {
        process.stdout.write('\r\x1b[K');
        state.ephemeral = null;
        state.lastEphemeralText = '';
      }
      console.log(`  ${chalk.green('[assistant]')} ${text} ${chalk.yellow('⚡interrupted')}`);
      state.transcriptEntries.push({ role: 'assistant', text, turnId, final: true, interrupted: true });
    }
  } else if (obj === 'message.interrupt') {
    // Force-end any ephemeral
    if (state.ephemeral) {
      process.stdout.write('\r\x1b[K');
      console.log(`  ${chalk.green('[assistant]')} ${state.ephemeral.text} ${chalk.yellow('⚡interrupted')}`);
      state.transcriptEntries.push({ ...state.ephemeral, final: true, interrupted: true });
      state.ephemeral = null;
      state.lastEphemeralText = '';
    }
  }
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

  const asrVendor = opts.config.asr?.vendor ?? 'ares';
  const nextHint = opts.lang === 'cn' ? '下次 convoai go 生效' : 'Takes effect next convoai go';

  await showMenu(
    `ASR Settings (${str.panelCurrent}: ${asrVendor} / ${currentLang})`,
    [
      str.panelSwitchLang,
      str.panelSwitchVendor,
    ],
    async (index) => {
      if (index === 0) {
        await switchLanguage(opts, str);
      } else {
        // Switch ASR vendor
        const { ASR_PROVIDERS } = await import('../../providers/catalog.js');
        const vendorNames = ASR_PROVIDERS.map(p => p.beta ? `${p.name} (Beta)` : p.name);
        await showMenu(
          `${str.panelSwitchVendor} (${str.panelCurrent}: ${asrVendor})`,
          vendorNames,
          async (vIdx) => {
            const selected = ASR_PROVIDERS[vIdx];
            if (!opts.config.asr) opts.config.asr = {};
            opts.config.asr.vendor = selected.vendor;
            try {
              const { loadConfig, saveConfig } = await import('../../config/manager.js');
              const cfg = loadConfig();
              const profile = cfg.profiles?.[cfg.default_profile ?? 'default'];
              if (profile) {
                if (!profile.asr) profile.asr = {};
                profile.asr.vendor = selected.vendor;
                saveConfig(cfg);
              }
            } catch {}
            console.log('');
            printSuccess(`${str.panelUpdated}: ASR = ${selected.name}`);
            console.log(chalk.dim(`  ${nextHint}`));
            await pause();
          },
        );
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
    async (index) => {
      const selected = ASR_LANGUAGES[index];
      if (selected) {
        if (!opts.config.asr) opts.config.asr = {};
        opts.config.asr.language = selected.value;
        try {
          const { loadConfig, saveConfig } = await import('../../config/manager.js');
          const cfg = loadConfig();
          const profile = cfg.profiles?.[cfg.default_profile ?? 'default'];
          if (profile) {
            if (!profile.asr) profile.asr = {};
            profile.asr.language = selected.value;
            saveConfig(cfg);
          }
        } catch {}
        console.log('');
        printSuccess(`${str.panelUpdated}: language = ${selected.value}`);
        console.log(chalk.dim(`  ${opts.lang === 'cn' ? '下次 convoai go 生效' : 'Takes effect next convoai go'}`));
        await pause();
      }
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
  const nextHint = opts.lang === 'cn' ? '下次 convoai go 生效' : 'Takes effect next convoai go';

  await showMenu(
    `TTS Settings (${str.panelCurrent}: ${ttsVendor})`,
    [
      str.panelSwitchVendor,
      str.panelSpeed,
      str.panelVolume,
    ],
    async (index) => {
      if (index === 0) {
        // Switch vendor — list all TTS providers
        const { TTS_PROVIDERS } = await import('../../providers/catalog.js');
        const vendorNames = TTS_PROVIDERS.map(p => p.beta ? `${p.name} (Beta)` : p.name);
        await showMenu(
          `${str.panelSwitchVendor} (${str.panelCurrent}: ${ttsVendor})`,
          vendorNames,
          async (vIdx) => {
            const selected = TTS_PROVIDERS[vIdx];
            if (!opts.config.tts) opts.config.tts = {};
            opts.config.tts.vendor = selected.vendor;
            try {
              const { loadConfig, saveConfig } = await import('../../config/manager.js');
              const cfg = loadConfig();
              const profile = cfg.profiles?.[cfg.default_profile ?? 'default'];
              if (profile) {
                if (!profile.tts) profile.tts = {};
                profile.tts.vendor = selected.vendor;
                saveConfig(cfg);
              }
            } catch {}
            console.log('');
            printSuccess(`${str.panelUpdated}: TTS = ${selected.name}`);
            console.log(chalk.dim(`  ${nextHint}`));
            await pause();
          },
        );
      } else if (index === 1) {
        // Speed
        const val = await readInput(`${str.panelSpeed} (0.5-2.0)`);
        const n = parseFloat(val);
        if (!isNaN(n) && n >= 0.5 && n <= 2.0) {
          if (!opts.config.tts) opts.config.tts = {};
          if (!opts.config.tts.params) opts.config.tts.params = {};
          opts.config.tts.params.speed = n;
          try {
            const { loadConfig, saveConfig } = await import('../../config/manager.js');
            const cfg = loadConfig();
            const profile = cfg.profiles?.[cfg.default_profile ?? 'default'];
            if (profile?.tts) {
              if (!profile.tts.params) profile.tts.params = {};
              profile.tts.params.speed = n;
              saveConfig(cfg);
            }
          } catch {}
          console.log('');
          printSuccess(`${str.panelUpdated}: speed = ${n}`);
          console.log(chalk.dim(`  ${nextHint}`));
          await pause();
        }
      } else if (index === 2) {
        // Volume
        const val = await readInput(`${str.panelVolume} (0-100)`);
        const n = parseInt(val, 10);
        if (!isNaN(n) && n >= 0 && n <= 100) {
          if (!opts.config.tts) opts.config.tts = {};
          if (!opts.config.tts.params) opts.config.tts.params = {};
          opts.config.tts.params.volume = n;
          try {
            const { loadConfig, saveConfig } = await import('../../config/manager.js');
            const cfg = loadConfig();
            const profile = cfg.profiles?.[cfg.default_profile ?? 'default'];
            if (profile?.tts) {
              if (!profile.tts.params) profile.tts.params = {};
              profile.tts.params.volume = n;
              saveConfig(cfg);
            }
          } catch {}
          console.log('');
          printSuccess(`${str.panelUpdated}: volume = ${n}`);
          console.log(chalk.dim(`  ${nextHint}`));
          await pause();
        }
      }
    },
  );
}

// ─── VAD Sub-Menu ───────────────────────────────────────────────────────────

async function vadMenu(
  opts: PanelOpts,
  _state: PanelState,
  str: ReturnType<typeof getStrings>,
): Promise<void> {
  const currentSilence = opts.config.turn_detection?.silence_duration_ms ?? 1000;
  const currentInterrupt = opts.config.turn_detection?.interrupt_duration_ms ?? 160;
  const currentMode = opts.config.turn_detection?.interrupt_mode ?? 'interrupt';

  await showMenu(
    'VAD Settings',
    [
      `${str.panelSilenceDuration} (${str.panelCurrent}: ${currentSilence}ms)`,
      `${str.panelInterruptDuration} (${str.panelCurrent}: ${currentInterrupt}ms)`,
      `${str.panelInterruptMode} (${str.panelCurrent}: ${currentMode})`,
    ],
    async (index) => {
      if (index === 0) {
        // Silence duration
        const val = await readInput(`${str.panelSilenceDuration} (200-3000ms)`);
        const n = parseInt(val, 10);
        if (!isNaN(n) && n >= 200 && n <= 3000) {
          // Save to config for next session
          if (!opts.config.turn_detection) (opts.config as any).turn_detection = {};
          (opts.config as any).turn_detection.silence_duration_ms = n;
          try {
            const { loadConfig, saveConfig } = await import('../../config/manager.js');
            const cfg = loadConfig();
            const profile = cfg.profiles?.[cfg.default_profile ?? 'default'];
            if (profile) {
              (profile as any).turn_detection = { ...((profile as any).turn_detection ?? {}), silence_duration_ms: n };
              saveConfig(cfg);
            }
          } catch {}
          console.log('');
          printSuccess(`${str.panelUpdated}: silence_duration = ${n}ms`);
          console.log(chalk.dim(`  ${opts.lang === 'cn' ? '下次 convoai go 生效' : 'Takes effect next convoai go'}`));
          await pause();
        }
      } else if (index === 1) {
        // Interrupt duration
        const val = await readInput(`${str.panelInterruptDuration} (50-1000ms)`);
        const n = parseInt(val, 10);
        if (!isNaN(n) && n >= 50 && n <= 1000) {
          if (!opts.config.turn_detection) (opts.config as any).turn_detection = {};
          (opts.config as any).turn_detection.interrupt_duration_ms = n;
          try {
            const { loadConfig, saveConfig } = await import('../../config/manager.js');
            const cfg = loadConfig();
            const profile = cfg.profiles?.[cfg.default_profile ?? 'default'];
            if (profile) {
              (profile as any).turn_detection = { ...((profile as any).turn_detection ?? {}), interrupt_duration_ms: n };
              saveConfig(cfg);
            }
          } catch {}
          console.log('');
          printSuccess(`${str.panelUpdated}: interrupt_duration = ${n}ms`);
          console.log(chalk.dim(`  ${opts.lang === 'cn' ? '下次 convoai go 生效' : 'Takes effect next convoai go'}`));
          await pause();
        }
      } else if (index === 2) {
        // Interrupt mode
        await showMenu(
          `${str.panelInterruptMode} (${str.panelCurrent}: ${currentMode})`,
          [
            `interrupt ${chalk.dim(opts.lang === 'cn' ? '— 用户说话立刻打断 Agent' : '— Interrupt agent immediately')}`,
            `append ${chalk.dim(opts.lang === 'cn' ? '— Agent 说完再处理' : '— Wait for agent to finish')}`,
            `ignore ${chalk.dim(opts.lang === 'cn' ? '— Agent 说话时忽略输入' : '— Ignore user during agent speech')}`,
          ],
          async (modeIdx) => {
            const modes = ['interrupt', 'append', 'ignore'];
            const mode = modes[modeIdx];
            if (!opts.config.turn_detection) (opts.config as any).turn_detection = {};
            (opts.config as any).turn_detection.interrupt_mode = mode;
            try {
              const { loadConfig, saveConfig } = await import('../../config/manager.js');
              const cfg = loadConfig();
              const profile = cfg.profiles?.[cfg.default_profile ?? 'default'];
              if (profile) {
                (profile as any).turn_detection = { ...((profile as any).turn_detection ?? {}), interrupt_mode: mode };
                saveConfig(cfg);
              }
            } catch {}
            console.log('');
            printSuccess(`${str.panelUpdated}: interrupt_mode = ${mode}`);
            console.log(chalk.dim(`  ${opts.lang === 'cn' ? '下次 convoai go 生效' : 'Takes effect next convoai go'}`));
            await pause();
          },
        );
      }
    },
  );
}

// ─── History View ───────────────────────────────────────────────────────────

// historyView removed — conversation now streams live in the panel

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
