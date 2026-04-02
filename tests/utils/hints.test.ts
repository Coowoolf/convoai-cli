import { describe, it, expect } from 'vitest';
import {
  shortId,
  hintAfterStart,
  hintAfterStop,
  hintAfterLogin,
  hintAfterList,
  hintAfterHistory,
} from '../../src/utils/hints.js';

describe('shortId', () => {
  it('returns first 12 characters', () => {
    expect(shortId('1NT29X10YHxxxxxWJOXLYHNYB')).toBe('1NT29X10YHxx');
  });

  it('returns full string if shorter than 12', () => {
    expect(shortId('short')).toBe('short');
  });

  it('handles empty string', () => {
    expect(shortId('')).toBe('');
  });
});

describe('hint functions', () => {
  it('hintAfterStart includes full agent ID (not truncated)', () => {
    const fullId = 'A42AC43EJ85LE63JP37TJ24MY47RN68K';
    const hint = hintAfterStart(fullId);
    expect(hint).toContain(fullId);
    expect(hint).toContain('convoai agent status');
  });

  it('hintAfterStart includes voice chat hint with channel', () => {
    const hint = hintAfterStart('A42AC43EJ85LE63JP37TJ24MY47RN68K', 'my-room');
    expect(hint).toContain('convoai agent join');
    expect(hint).toContain('my-room');
  });

  it('hintAfterStop mentions agent list', () => {
    const hint = hintAfterStop();
    expect(hint).toContain('convoai agent list');
  });

  it('hintAfterLogin mentions agent join', () => {
    const hint = hintAfterLogin();
    expect(hint).toContain('convoai agent join');
  });

  it('hintAfterList mentions status and join', () => {
    const hint = hintAfterList();
    expect(hint).toContain('convoai agent status');
    expect(hint).toContain('convoai agent join');
  });

  it('hintAfterHistory includes full agent ID and mentions turns', () => {
    const fullId = 'A42AC43EJ85LE63JP37TJ24MY47RN68K';
    const hint = hintAfterHistory(fullId);
    expect(hint).toContain(fullId);
    expect(hint).toContain('turns');
  });
});
