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
  it('hintAfterStart includes agent ID', () => {
    const hint = hintAfterStart('abc123def456');
    expect(hint).toContain('abc123def456');
    expect(hint).toContain('convoai agent status');
  });

  it('hintAfterStop mentions agent list', () => {
    const hint = hintAfterStop();
    expect(hint).toContain('convoai agent list');
  });

  it('hintAfterLogin mentions agent start', () => {
    const hint = hintAfterLogin();
    expect(hint).toContain('convoai agent start');
  });

  it('hintAfterList mentions agent status', () => {
    const hint = hintAfterList();
    expect(hint).toContain('convoai agent status');
  });

  it('hintAfterHistory includes agent ID and mentions turns', () => {
    const hint = hintAfterHistory('abc123def456');
    expect(hint).toContain('abc123def456');
    expect(hint).toContain('turns');
  });
});
