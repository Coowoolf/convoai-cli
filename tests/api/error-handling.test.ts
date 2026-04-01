import { describe, it, expect, vi } from 'vitest';
import { AxiosError } from 'axios';
import { formatApiError } from '../../src/utils/errors.js';

describe('Error Handling - Comprehensive', () => {
  it('formats 400 Bad Request', () => {
    const error = new AxiosError('Bad Request');
    (error as any).response = {
      status: 400,
      data: { detail: 'Invalid channel name', reason: 'BAD_REQUEST' },
    };
    const msg = formatApiError(error);
    expect(msg).toContain('400');
    expect(msg).toContain('Invalid channel name');
  });

  it('formats 401 Unauthorized', () => {
    const error = new AxiosError('Unauthorized');
    (error as any).response = {
      status: 401,
      data: { detail: 'Invalid credentials', reason: 'UNAUTHORIZED' },
    };
    const msg = formatApiError(error);
    expect(msg).toContain('401');
    expect(msg).toContain('Invalid credentials');
  });

  it('formats 403 Forbidden', () => {
    const error = new AxiosError('Forbidden');
    (error as any).response = {
      status: 403,
      data: { detail: 'Insufficient permissions', reason: 'FORBIDDEN' },
    };
    const msg = formatApiError(error);
    expect(msg).toContain('403');
  });

  it('formats 404 Not Found', () => {
    const error = new AxiosError('Not Found');
    (error as any).response = {
      status: 404,
      data: { detail: 'Agent not found', reason: 'NOT_FOUND' },
    };
    const msg = formatApiError(error);
    expect(msg).toContain('404');
    expect(msg).toContain('Agent not found');
  });

  it('formats 429 Rate Limited', () => {
    const error = new AxiosError('Too Many Requests');
    (error as any).response = {
      status: 429,
      data: { detail: 'Rate limit exceeded', reason: 'RATE_LIMITED' },
    };
    const msg = formatApiError(error);
    expect(msg).toContain('429');
  });

  it('formats 500 Internal Server Error', () => {
    const error = new AxiosError('Internal Server Error');
    (error as any).response = {
      status: 500,
      data: { detail: 'Internal error', reason: 'SERVER_ERROR' },
    };
    const msg = formatApiError(error);
    expect(msg).toContain('500');
  });

  it('handles ENOTFOUND network error', () => {
    const error = new AxiosError('getaddrinfo ENOTFOUND');
    error.code = 'ENOTFOUND';
    const msg = formatApiError(error);
    expect(msg).toContain('Network error');
    expect(msg).toContain('ENOTFOUND');
  });

  it('handles ECONNREFUSED network error', () => {
    const error = new AxiosError('connect ECONNREFUSED');
    error.code = 'ECONNREFUSED';
    const msg = formatApiError(error);
    expect(msg).toContain('Network error');
    expect(msg).toContain('ECONNREFUSED');
  });

  it('handles timeout error', () => {
    const error = new AxiosError('timeout of 30000ms exceeded');
    error.code = 'ECONNABORTED';
    const msg = formatApiError(error);
    expect(msg).toContain('timeout');
  });

  it('handles response with only reason (no detail)', () => {
    const error = new AxiosError('Error');
    (error as any).response = {
      status: 422,
      data: { reason: 'VALIDATION_ERROR' },
    };
    const msg = formatApiError(error);
    expect(msg).toContain('422');
    expect(msg).toContain('VALIDATION_ERROR');
  });

  it('handles response with empty data', () => {
    const error = new AxiosError('Error');
    (error as any).response = {
      status: 503,
      data: {},
    };
    const msg = formatApiError(error);
    expect(msg).toContain('503');
  });

  it('handles null error', () => {
    const msg = formatApiError(null);
    expect(msg).toBe('null');
  });

  it('handles undefined error', () => {
    const msg = formatApiError(undefined);
    expect(msg).toBe('undefined');
  });

  it('handles error with stack trace (uses only message)', () => {
    const error = new Error('Clean message');
    error.stack = 'Error: Clean message\n  at something.ts:1:1';
    const msg = formatApiError(error);
    expect(msg).toBe('Clean message');
    expect(msg).not.toContain('at something');
  });
});
