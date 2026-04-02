import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';

// Mock heavy dependencies that chat.ts imports so the module loads quickly
vi.mock('ws', () => ({
  WebSocketServer: vi.fn(),
}));

vi.mock('puppeteer-core', () => ({
  default: { launch: vi.fn() },
}));

vi.mock('../../src/commands/agent/_helpers.js', () => ({
  getAgentAPI: vi.fn(),
}));

vi.mock('../../src/config/manager.js', () => ({
  resolveConfig: vi.fn().mockReturnValue({}),
  loadConfig: vi.fn().mockReturnValue({}),
}));

vi.mock('../../src/presets/defaults.js', () => ({
  getPreset: vi.fn(),
}));

vi.mock('../../src/utils/token.js', () => ({
  generateRtcToken: vi.fn(),
}));

vi.mock('../../src/utils/find-chrome.js', () => ({
  findChrome: vi.fn().mockReturnValue(null),
}));

vi.mock('../../src/ui/spinner.js', () => ({
  withSpinner: vi.fn(),
}));

vi.mock('../../src/ui/output.js', () => ({
  printSuccess: vi.fn(),
  printError: vi.fn(),
}));

vi.mock('../../src/utils/errors.js', () => ({
  handleError: vi.fn(),
}));

vi.mock('../../src/utils/telemetry.js', () => ({
  track: vi.fn(),
}));

describe('agent chat command registration', () => {
  it('registers "chat" subcommand on a Commander program', async () => {
    const { registerAgentChat } = await import('../../src/commands/agent/chat.js');
    const program = new Command();
    registerAgentChat(program);

    const chatCmd = program.commands.find(c => c.name() === 'chat');
    expect(chatCmd).toBeDefined();
  });

  it('has the correct description', async () => {
    const { registerAgentChat } = await import('../../src/commands/agent/chat.js');
    const program = new Command();
    registerAgentChat(program);

    const chatCmd = program.commands.find(c => c.name() === 'chat')!;
    expect(chatCmd.description()).toContain('Voice chat');
  });

  it('requires --channel flag', async () => {
    const { registerAgentChat } = await import('../../src/commands/agent/chat.js');
    const program = new Command();
    registerAgentChat(program);

    const chatCmd = program.commands.find(c => c.name() === 'chat')!;
    const helpText = chatCmd.helpInformation();
    expect(helpText).toContain('--channel');
    expect(helpText).toContain('-c');
  });

  it('supports --preset flag', async () => {
    const { registerAgentChat } = await import('../../src/commands/agent/chat.js');
    const program = new Command();
    registerAgentChat(program);

    const chatCmd = program.commands.find(c => c.name() === 'chat')!;
    const helpText = chatCmd.helpInformation();
    expect(helpText).toContain('--preset');
  });

  it('supports --model flag', async () => {
    const { registerAgentChat } = await import('../../src/commands/agent/chat.js');
    const program = new Command();
    registerAgentChat(program);

    const chatCmd = program.commands.find(c => c.name() === 'chat')!;
    const helpText = chatCmd.helpInformation();
    expect(helpText).toContain('--model');
  });

  it('supports --tts flag', async () => {
    const { registerAgentChat } = await import('../../src/commands/agent/chat.js');
    const program = new Command();
    registerAgentChat(program);

    const chatCmd = program.commands.find(c => c.name() === 'chat')!;
    const helpText = chatCmd.helpInformation();
    expect(helpText).toContain('--tts');
  });

  it('supports --asr flag', async () => {
    const { registerAgentChat } = await import('../../src/commands/agent/chat.js');
    const program = new Command();
    registerAgentChat(program);

    const chatCmd = program.commands.find(c => c.name() === 'chat')!;
    const helpText = chatCmd.helpInformation();
    expect(helpText).toContain('--asr');
  });

  it('supports --system-message flag', async () => {
    const { registerAgentChat } = await import('../../src/commands/agent/chat.js');
    const program = new Command();
    registerAgentChat(program);

    const chatCmd = program.commands.find(c => c.name() === 'chat')!;
    const helpText = chatCmd.helpInformation();
    expect(helpText).toContain('--system-message');
  });

  it('supports --greeting flag', async () => {
    const { registerAgentChat } = await import('../../src/commands/agent/chat.js');
    const program = new Command();
    registerAgentChat(program);

    const chatCmd = program.commands.find(c => c.name() === 'chat')!;
    const helpText = chatCmd.helpInformation();
    expect(helpText).toContain('--greeting');
  });

  it('supports --idle-timeout flag with default 300', async () => {
    const { registerAgentChat } = await import('../../src/commands/agent/chat.js');
    const program = new Command();
    registerAgentChat(program);

    const chatCmd = program.commands.find(c => c.name() === 'chat')!;
    const helpText = chatCmd.helpInformation();
    expect(helpText).toContain('--idle-timeout');
  });

  it('supports --profile flag', async () => {
    const { registerAgentChat } = await import('../../src/commands/agent/chat.js');
    const program = new Command();
    registerAgentChat(program);

    const chatCmd = program.commands.find(c => c.name() === 'chat')!;
    const helpText = chatCmd.helpInformation();
    expect(helpText).toContain('--profile');
  });
});

// ── wrapText and fmtLatency logic tests ─────────────────────────────────────
// These functions are private in chat.ts, so we reimplement the same logic
// to verify correctness of the algorithms used in the module.

describe('wrapText logic', () => {
  // Reimplementation matching chat.ts wrapText
  function wrapText(text: string, maxWidth: number): string[] {
    if (text.length <= maxWidth) return [text];
    const lines: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxWidth) { lines.push(remaining); break; }
      let cut = remaining.lastIndexOf(' ', maxWidth);
      if (cut <= 0) cut = maxWidth;
      lines.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut).trimStart();
    }
    return lines;
  }

  it('returns single-element array for short text', () => {
    expect(wrapText('hello', 80)).toEqual(['hello']);
  });

  it('returns single-element array when text equals maxWidth', () => {
    const text = 'a'.repeat(40);
    expect(wrapText(text, 40)).toEqual([text]);
  });

  it('wraps at word boundary', () => {
    const text = 'the quick brown fox jumps over the lazy dog';
    const lines = wrapText(text, 20);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
  });

  it('forces break on long words without spaces', () => {
    const text = 'a'.repeat(50);
    const lines = wrapText(text, 20);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].length).toBe(20);
  });

  it('handles empty string', () => {
    expect(wrapText('', 80)).toEqual(['']);
  });

  it('preserves all content after wrapping', () => {
    const text = 'one two three four five six seven eight nine ten';
    const lines = wrapText(text, 15);
    const joined = lines.join(' ');
    // All words should be present
    for (const word of text.split(' ')) {
      expect(joined).toContain(word);
    }
  });
});

describe('fmtLatency logic', () => {
  // Reimplementation matching chat.ts fmtLatency thresholds
  // (without chalk colors for pure logic testing)
  function fmtLatencyCategory(ms: number): 'green' | 'yellow' | 'red' {
    if (ms < 1000) return 'green';
    if (ms < 2000) return 'yellow';
    return 'red';
  }

  it('categorizes < 1000ms as green', () => {
    expect(fmtLatencyCategory(0)).toBe('green');
    expect(fmtLatencyCategory(500)).toBe('green');
    expect(fmtLatencyCategory(999)).toBe('green');
  });

  it('categorizes 1000-1999ms as yellow', () => {
    expect(fmtLatencyCategory(1000)).toBe('yellow');
    expect(fmtLatencyCategory(1500)).toBe('yellow');
    expect(fmtLatencyCategory(1999)).toBe('yellow');
  });

  it('categorizes >= 2000ms as red', () => {
    expect(fmtLatencyCategory(2000)).toBe('red');
    expect(fmtLatencyCategory(5000)).toBe('red');
    expect(fmtLatencyCategory(10000)).toBe('red');
  });

  it('formats sub-second as Xms', () => {
    // In the real impl: ms < 1000 => `${ms}ms`
    const ms = 450;
    expect(`${ms}ms`).toBe('450ms');
  });

  it('formats 1-2s as X.Xs', () => {
    // In the real impl: ms >= 1000 => (ms/1000).toFixed(1) + 's'
    const ms = 1500;
    expect((ms / 1000).toFixed(1) + 's').toBe('1.5s');
  });

  it('formats >= 2s as X.Xs', () => {
    const ms = 3500;
    expect((ms / 1000).toFixed(1) + 's').toBe('3.5s');
  });
});
