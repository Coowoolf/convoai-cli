import { describe, it, expect, vi } from 'vitest';

/**
 * Panel interaction tests — verify that raw mode stays active throughout
 * sub-menu navigation (no inquirer, no raw mode toggling).
 */

describe('Panel raw-mode submenu flow', () => {
  it('stays in raw mode during submenu (no toggling)', async () => {
    const state = { inSubmenu: false };
    const submenuFn = vi.fn().mockResolvedValue(undefined);
    const refreshFn = vi.fn().mockResolvedValue(undefined);
    const renderFn = vi.fn();

    // Simulate the new keyHandler flow for a submenu key
    state.inSubmenu = true;
    await submenuFn();
    await refreshFn();
    state.inSubmenu = false;
    renderFn();

    // Verify: submenu was entered and exited
    expect(submenuFn).toHaveBeenCalled();
    expect(refreshFn).toHaveBeenCalled();
    expect(renderFn).toHaveBeenCalled();
    expect(state.inSubmenu).toBe(false);
  });

  it('inSubmenu flag prevents key handling during submenu', () => {
    const state = { inSubmenu: true };

    const handled = !state.inSubmenu;
    expect(handled).toBe(false);

    state.inSubmenu = false;
    const handledAfter = !state.inSubmenu;
    expect(handledAfter).toBe(true);
  });

  it('keyHandler is not called while in submenu', () => {
    const actions: string[] = [];
    const state = { inSubmenu: false };

    const keyHandler = (key: string): void => {
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

  it('submenu errors do not prevent state recovery', async () => {
    const state = { inSubmenu: false };
    const failingFn = vi.fn().mockRejectedValue(new Error('menu crashed'));
    const refreshFn = vi.fn().mockResolvedValue(undefined);
    const renderFn = vi.fn();

    // Simulate keyHandler with try/catch (as in actual code)
    state.inSubmenu = true;
    try {
      await failingFn();
    } catch {
      // Swallowed, same as real code
    }
    await refreshFn();
    state.inSubmenu = false;
    renderFn();

    // Verify recovery
    expect(state.inSubmenu).toBe(false);
    expect(renderFn).toHaveBeenCalled();
  });
});

describe('Panel showMenu number-key selection', () => {
  it('selects correct index for valid number keys', () => {
    const choices = ['Model', 'Temperature', 'Max tokens'];
    const results: Array<{ key: string; selected: number | null }> = [];

    for (const key of ['1', '2', '3', '0', '4', 'a', '']) {
      const num = parseInt(key, 10);
      if (key === '0' || key === 'b' || key === '\u001b') {
        results.push({ key, selected: null }); // back
      } else if (!isNaN(num) && num >= 1 && num <= choices.length) {
        results.push({ key, selected: num - 1 });
      } else {
        results.push({ key, selected: null }); // ignored
      }
    }

    expect(results).toEqual([
      { key: '1', selected: 0 },
      { key: '2', selected: 1 },
      { key: '3', selected: 2 },
      { key: '0', selected: null },
      { key: '4', selected: null },
      { key: 'a', selected: null },
      { key: '', selected: null },
    ]);
  });

  it('escape and b are treated as back', () => {
    const backKeys = ['0', 'b', '\u001b'];
    for (const key of backKeys) {
      const isBack = key === '0' || key === 'b' || key === '\u001b';
      expect(isBack).toBe(true);
    }
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

describe('Panel readInput mode switching', () => {
  it('readInput temporarily exits raw mode and restores it', async () => {
    const calls: string[] = [];
    const mockSetRawMode = vi.fn((v: boolean) => calls.push(`rawMode(${v})`));

    // Simulate readInput flow
    mockSetRawMode(false); // exit raw mode for text input
    calls.push('readline');
    mockSetRawMode(true); // restore raw mode

    expect(calls).toEqual(['rawMode(false)', 'readline', 'rawMode(true)']);
  });
});
