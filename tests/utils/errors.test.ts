import { describe, it, expect, vi } from 'vitest';
import { formatApiError } from '../../src/utils/errors.js';
import { AxiosError } from 'axios';

describe('formatApiError', () => {
  it('formats AxiosError with status and detail', () => {
    const error = new AxiosError('Request failed');
    (error as any).response = {
      status: 401,
      data: { detail: 'Invalid credentials', reason: 'AUTH_FAILED' },
    };

    const result = formatApiError(error);
    expect(result).toContain('401');
    expect(result).toContain('Invalid credentials');
  });

  it('formats AxiosError with status and reason fallback', () => {
    const error = new AxiosError('Request failed');
    (error as any).response = {
      status: 404,
      data: { reason: 'NOT_FOUND' },
    };

    const result = formatApiError(error);
    expect(result).toContain('404');
    expect(result).toContain('NOT_FOUND');
  });

  it('formats network errors', () => {
    const error = new AxiosError('Network Error');
    error.code = 'ECONNREFUSED';

    const result = formatApiError(error);
    expect(result).toContain('Network error');
    expect(result).toContain('ECONNREFUSED');
  });

  it('formats generic AxiosError without response', () => {
    const error = new AxiosError('timeout');

    const result = formatApiError(error);
    expect(result).toContain('timeout');
  });

  it('formats regular Error', () => {
    const result = formatApiError(new Error('something broke'));
    expect(result).toBe('something broke');
  });

  it('formats string errors', () => {
    const result = formatApiError('raw string error');
    expect(result).toBe('raw string error');
  });

  it('formats number errors', () => {
    const result = formatApiError(42);
    expect(result).toBe('42');
  });
});
