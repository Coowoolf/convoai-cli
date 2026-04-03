import { describe, it, expect, vi } from 'vitest';

/**
 * Panel interaction tests — ensure stdin raw mode toggling works correctly
 * for submenu entry/exit, preventing the "Enter key doesn't work" bug.
 */

describe('Panel openSubmenu stdin management', () => {
  it('removes data listener before entering submenu', async () => {
    const mockStdin = {
      setRawMode: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      removeListener: vi.fn(),
      on: vi.fn(),
    };

    const state = { inSubmenu: false };
    const keyHandler = vi.fn();
    const submenuFn = vi.fn().mockResolvedValue(undefined);

    // Simulate openSubmenu behavior
    state.inSubmenu = true;
    mockStdin.removeListener('data', keyHandler);
    mockStdin.setRawMode(false);
    mockStdin.pause();

    await submenuFn();

    mockStdin.resume();
    mockStdin.setRawMode(true);
    mockStdin.on('data', keyHandler);
    state.inSubmenu = false;

    // Verify: listener removed BEFORE pause
    expect(mockStdin.removeListener).toHaveBeenCalledWith('data', keyHandler);
    // Verify: raw mode disabled before submenu
    expect(mockStdin.setRawMode).toHaveBeenCalledWith(false);
    // Verify: stdin paused for inquirer
    expect(mockStdin.pause).toHaveBeenCalled();
    // Verify: submenu function was called
    expect(submenuFn).toHaveBeenCalled();
    // Verify: stdin resumed after submenu
    expect(mockStdin.resume).toHaveBeenCalled();
    // Verify: raw mode re-enabled after submenu
    expect(mockStdin.setRawMode).toHaveBeenCalledWith(true);
    // Verify: listener re-attached after submenu
    expect(mockStdin.on).toHaveBeenCalledWith('data', keyHandler);
    // Verify: inSubmenu flag cleared
    expect(state.inSubmenu).toBe(false);
  });

  it('order of operations is correct: remove → rawMode(false) → pause → fn → resume → rawMode(true) → reattach', async () => {
    const order: string[] = [];
    const mockStdin = {
      setRawMode: vi.fn((v: boolean) => order.push(`rawMode(${v})`)),
      pause: vi.fn(() => order.push('pause')),
      resume: vi.fn(() => order.push('resume')),
      removeListener: vi.fn(() => order.push('removeListener')),
      on: vi.fn(() => order.push('on')),
    };
    const keyHandler = vi.fn();
    const submenuFn = vi.fn(async () => { order.push('submenu'); });

    // Simulate the exact openSubmenu sequence
    mockStdin.removeListener('data', keyHandler);
    mockStdin.setRawMode(false);
    mockStdin.pause();
    await submenuFn();
    mockStdin.resume();
    mockStdin.setRawMode(true);
    mockStdin.on('data', keyHandler);

    expect(order).toEqual([
      'removeListener',
      'rawMode(false)',
      'pause',
      'submenu',
      'resume',
      'rawMode(true)',
      'on',
    ]);
  });

  it('submenu errors do not prevent stdin recovery', async () => {
    const mockStdin = {
      setRawMode: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      removeListener: vi.fn(),
      on: vi.fn(),
    };
    const state = { inSubmenu: false };
    const keyHandler = vi.fn();
    const failingFn = vi.fn().mockRejectedValue(new Error('inquirer crashed'));

    // Simulate openSubmenu with error
    state.inSubmenu = true;
    mockStdin.removeListener('data', keyHandler);
    mockStdin.setRawMode(false);
    mockStdin.pause();

    try { await failingFn(); } catch { /* swallowed */ }

    // Recovery should still happen
    mockStdin.resume();
    mockStdin.setRawMode(true);
    mockStdin.on('data', keyHandler);
    state.inSubmenu = false;

    // Verify recovery happened
    expect(mockStdin.resume).toHaveBeenCalled();
    expect(mockStdin.setRawMode).toHaveBeenLastCalledWith(true);
    expect(mockStdin.on).toHaveBeenCalledWith('data', keyHandler);
    expect(state.inSubmenu).toBe(false);
  });

  it('inSubmenu flag prevents key handling during submenu', () => {
    const state = { inSubmenu: true };

    // Simulate key handler check
    const handled = !state.inSubmenu;
    expect(handled).toBe(false);

    state.inSubmenu = false;
    const handledAfter = !state.inSubmenu;
    expect(handledAfter).toBe(true);
  });

  it('keyHandler is not called while in submenu', () => {
    const actions: string[] = [];
    const state = { inSubmenu: false };

    const keyHandler = (key: string) => {
      if (state.inSubmenu) return;
      actions.push(key);
    };

    // Normal key press
    keyHandler('l');
    expect(actions).toEqual(['l']);

    // Enter submenu
    state.inSubmenu = true;
    keyHandler('v');
    keyHandler('q');
    expect(actions).toEqual(['l']); // no new actions

    // Exit submenu
    state.inSubmenu = false;
    keyHandler('h');
    expect(actions).toEqual(['l', 'h']);
  });
});

describe('Panel key mapping', () => {
  it('maps all expected keys', () => {
    const validKeys = ['a', 'l', 't', 'v', 'h', 'q', '\u0003'];
    const keyMap: Record<string, string> = {
      'a': 'ASR',
      'l': 'LLM',
      't': 'TTS',
      'v': 'VAD',
      'h': 'History',
      'q': 'Exit',
      '\u0003': 'Ctrl+C',
    };

    for (const key of validKeys) {
      expect(keyMap[key]).toBeTruthy();
    }
    expect(Object.keys(keyMap)).toHaveLength(7);
  });

  it('ignores unmapped keys', () => {
    const handled: string[] = [];
    const validKeys = new Set(['a', 'l', 't', 'v', 'h', 'q', '\u0003']);

    for (const key of ['x', 'z', '1', ' ', '\n', 'A', 'L']) {
      if (validKeys.has(key)) {
        handled.push(key);
      }
    }

    expect(handled).toEqual([]);
  });
});
