import { AxiosError } from 'axios';
import chalk from 'chalk';
import type { ApiErrorResponse } from '../api/types.js';

/**
 * Extract a human-readable message from an API error.
 */
export function formatApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data as ApiErrorResponse | undefined;
    const detail = data?.detail || data?.reason || error.message;

    if (status) {
      return `API Error ${status}: ${detail}`;
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return `Network error: could not reach the API (${error.code})`;
    }
    return `Request failed: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Format an error, print to stderr, and exit with code 1.
 * In JSON mode, outputs a structured error object instead.
 */
export function handleError(
  error: unknown,
  options?: { json?: boolean },
): never {
  const message = formatApiError(error);

  if (options?.json) {
    console.error(JSON.stringify({ error: message }, null, 2));
  } else {
    console.error(`${chalk.red('\u2716')} ${message}`);
  }

  process.exit(1);
}
