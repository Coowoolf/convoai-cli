import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { formatApiError, getErrorHints } from '../../src/utils/errors.js';

describe('Error Handling - Comprehensive', () => {
  it('formats 400 with generic detail', () => {
    const error = new AxiosError('Bad Request');
    (error as any).response = { status: 400, data: { detail: 'Invalid channel name' } };
    const msg = formatApiError(error);
    expect(msg).toContain('400');
  });

  it('formats 400 appid as region mismatch', () => {
    const error = new AxiosError('Bad Request');
    (error as any).response = { status: 400, data: { detail: 'allocate failed, please check if the appid is valid' } };
    const msg = formatApiError(error);
    expect(msg).toContain('App ID');
    const hints = getErrorHints(error);
    expect(hints.some(h => h.includes('region'))).toBe(true);
  });

  it('formats 400 edge failed with provider hints', () => {
    const error = new AxiosError('Bad Request');
    (error as any).response = { status: 400, data: { detail: 'edge failed, reason: request failed' } };
    const msg = formatApiError(error);
    expect(msg).toContain('service provider');
    const hints = getErrorHints(error);
    expect(hints.some(h => h.includes('vendor') || h.includes('LLM'))).toBe(true);
  });

  it('formats 401 as authentication failed', () => {
    const error = new AxiosError('Unauthorized');
    (error as any).response = { status: 401, data: { detail: 'Invalid credentials' } };
    const msg = formatApiError(error);
    expect(msg).toContain('Authentication failed');
    expect(msg).toContain('401');
  });

  it('formats 403 as access forbidden', () => {
    const error = new AxiosError('Forbidden');
    (error as any).response = { status: 403, data: { detail: 'Insufficient permissions' } };
    const msg = formatApiError(error);
    expect(msg).toContain('403');
    expect(msg).toContain('forbidden');
  });

  it('formats 404 agent not found', () => {
    const error = new AxiosError('Not Found');
    (error as any).response = { status: 404, data: { detail: 'task not found' } };
    const msg = formatApiError(error);
    expect(msg).toContain('Agent not found');
  });

  it('formats 429 rate limited', () => {
    const error = new AxiosError('Too Many Requests');
    (error as any).response = { status: 429, data: { detail: 'Rate limit exceeded' } };
    const msg = formatApiError(error);
    expect(msg).toContain('Rate limited');
  });

  it('formats 500 server error', () => {
    const error = new AxiosError('Internal Server Error');
    (error as any).response = { status: 500, data: { detail: 'Internal error' } };
    const msg = formatApiError(error);
    expect(msg).toContain('Server error');
    expect(msg).toContain('500');
  });

  it('handles ENOTFOUND', () => {
    const error = new AxiosError('getaddrinfo ENOTFOUND');
    error.code = 'ENOTFOUND';
    const msg = formatApiError(error);
    expect(msg).toContain('Cannot reach');
    expect(msg).toContain('ENOTFOUND');
  });

  it('handles ECONNREFUSED', () => {
    const error = new AxiosError('connect ECONNREFUSED');
    error.code = 'ECONNREFUSED';
    const msg = formatApiError(error);
    expect(msg).toContain('Cannot reach');
    expect(msg).toContain('ECONNREFUSED');
  });

  it('handles timeout', () => {
    const error = new AxiosError('timeout of 60000ms exceeded');
    error.code = 'ECONNABORTED';
    const msg = formatApiError(error);
    expect(msg).toContain('timed out');
  });

  it('handles 422 with reason', () => {
    const error = new AxiosError('Error');
    (error as any).response = { status: 422, data: { reason: 'VALIDATION_ERROR' } };
    const msg = formatApiError(error);
    expect(msg).toContain('422');
  });

  it('handles 503 with empty data', () => {
    const error = new AxiosError('Error');
    (error as any).response = { status: 503, data: {} };
    const msg = formatApiError(error);
    expect(msg).toContain('Server error');
    expect(msg).toContain('503');
  });

  it('handles null error', () => {
    expect(formatApiError(null)).toBe('null');
  });

  it('handles undefined error', () => {
    expect(formatApiError(undefined)).toBe('undefined');
  });

  it('handles error with stack trace', () => {
    const error = new Error('Clean message');
    error.stack = 'Error: Clean message\n  at something.ts:1:1';
    expect(formatApiError(error)).toBe('Clean message');
  });
});
