import { describe, it, expect } from 'vitest';
import { formatApiError, getErrorHints } from '../../src/utils/errors.js';
import { AxiosError } from 'axios';

describe('formatApiError', () => {
  it('formats 401 as authentication failed', () => {
    const error = new AxiosError('Request failed');
    (error as any).response = { status: 401, data: { detail: 'Invalid credentials' } };
    expect(formatApiError(error)).toContain('Authentication failed');
  });

  it('formats 403 as access forbidden', () => {
    const error = new AxiosError('Forbidden');
    (error as any).response = { status: 403, data: { detail: 'No access' } };
    expect(formatApiError(error)).toContain('forbidden');
  });

  it('formats 404 agent not found', () => {
    const error = new AxiosError('Not found');
    (error as any).response = { status: 404, data: { detail: 'task not found' } };
    expect(formatApiError(error)).toContain('Agent not found');
  });

  it('formats 400 appid error', () => {
    const error = new AxiosError('Bad request');
    (error as any).response = { status: 400, data: { detail: 'allocate failed, please check if the appid is valid' } };
    expect(formatApiError(error)).toContain('App ID');
  });

  it('formats 400 edge failed', () => {
    const error = new AxiosError('Bad request');
    (error as any).response = { status: 400, data: { detail: 'edge failed, reason: request failed' } };
    expect(formatApiError(error)).toContain('service provider error');
  });

  it('formats 429 rate limited', () => {
    const error = new AxiosError('Too many');
    (error as any).response = { status: 429, data: { detail: 'rate limited' } };
    expect(formatApiError(error)).toContain('Rate limited');
  });

  it('formats 500 server error', () => {
    const error = new AxiosError('Server error');
    (error as any).response = { status: 500, data: { detail: 'internal' } };
    expect(formatApiError(error)).toContain('Server error');
  });

  it('formats ECONNREFUSED', () => {
    const error = new AxiosError('connect refused');
    error.code = 'ECONNREFUSED';
    expect(formatApiError(error)).toContain('Cannot reach');
    expect(formatApiError(error)).toContain('ECONNREFUSED');
  });

  it('formats ENOTFOUND', () => {
    const error = new AxiosError('not found');
    error.code = 'ENOTFOUND';
    expect(formatApiError(error)).toContain('Cannot reach');
  });

  it('formats timeout', () => {
    const error = new AxiosError('timeout of 60000ms exceeded');
    error.code = 'ECONNABORTED';
    expect(formatApiError(error)).toContain('timed out');
  });

  it('formats regular Error', () => {
    expect(formatApiError(new Error('something broke'))).toBe('something broke');
  });

  it('formats string errors', () => {
    expect(formatApiError('raw string')).toBe('raw string');
  });

  it('formats number errors', () => {
    expect(formatApiError(42)).toBe('42');
  });
});

describe('getErrorHints', () => {
  it('returns hints for 401', () => {
    const error = new AxiosError('Unauthorized');
    (error as any).response = { status: 401, data: { detail: 'auth' } };
    const hints = getErrorHints(error);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.some(h => h.includes('Customer ID'))).toBe(true);
  });

  it('returns hints for 400 edge failed', () => {
    const error = new AxiosError('Bad request');
    (error as any).response = { status: 400, data: { detail: 'edge failed' } };
    const hints = getErrorHints(error);
    expect(hints.some(h => h.includes('LLM') || h.includes('vendor'))).toBe(true);
  });

  it('returns hints for missing credentials Error', () => {
    const hints = getErrorHints(new Error('Missing required credentials: app_id'));
    expect(hints.some(h => h.includes('convoai config init'))).toBe(true);
  });

  it('returns hints for network errors', () => {
    const error = new AxiosError('timeout');
    error.code = 'ECONNABORTED';
    const hints = getErrorHints(error);
    expect(hints.length).toBeGreaterThan(0);
  });

  it('returns empty hints for unknown errors', () => {
    expect(getErrorHints('random')).toEqual([]);
  });
});
