import { AxiosError } from 'axios';
import chalk from 'chalk';
import type { ApiErrorResponse } from '../api/types.js';

// ─── Friendly Error Messages ────────────────────────────────────────────────

interface FriendlyError {
  message: string;
  hints: string[];
}

function diagnose(status: number | undefined, detail: string, code?: string): FriendlyError {
  const d = detail.toLowerCase();

  // ── Network errors (no HTTP status) ────────────────────────────────────
  if (!status) {
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      return {
        message: `Cannot reach the Agora API (${code})`,
        hints: [
          'Check your internet connection.',
          'If you are in China, make sure region is set to "cn": `convoai config set region cn`',
        ],
      };
    }
    if (code === 'ECONNABORTED' || d.includes('timeout')) {
      return {
        message: 'Request timed out',
        hints: [
          'The Agora API is not responding. Try again in a moment.',
          'If you are in China, ensure region is "cn": `convoai config set region cn`',
          'Check your network connection.',
        ],
      };
    }
    return { message: `Network error: ${detail}`, hints: [] };
  }

  // ── 401 Unauthorized ───────────────────────────────────────────────────
  if (status === 401) {
    return {
      message: 'Authentication failed (401)',
      hints: [
        'Your Customer ID or Customer Secret is incorrect.',
        'Get them from your Agora/Shengwang console → Developer Toolkit → RESTful API.',
        'Run `convoai config init` to reconfigure.',
      ],
    };
  }

  // ── 403 Forbidden ──────────────────────────────────────────────────────
  if (status === 403) {
    return {
      message: 'Access forbidden (403)',
      hints: [
        'Your account may not have ConvoAI enabled.',
        'Check that ConvoAI is activated in your Agora/Shengwang console.',
        'Verify your App ID is correct: `convoai config show`',
      ],
    };
  }

  // ── 400 Bad Request — detailed diagnosis ───────────────────────────────
  if (status === 400) {
    if (d.includes('appid') || d.includes('allocate failed')) {
      return {
        message: 'Invalid App ID or region mismatch',
        hints: [
          'Your App ID may not match the selected region.',
          'China projects → region must be "cn". Global projects → region must be "global".',
          'Check: `convoai config show`',
          'Fix: `convoai config set region cn` or `convoai config set region global`',
        ],
      };
    }
    if (d.includes('invalid literal') && d.includes('agent')) {
      return {
        message: 'Invalid agent RTC UID format',
        hints: [
          'agent_rtc_uid must be a numeric string (e.g. "0" or "10001").',
          'Use --uid 0 for random assignment.',
        ],
      };
    }
    if (d.includes('edge failed') || d.includes('request failed')) {
      return {
        message: 'Agent failed to start — service provider error',
        hints: [
          'Check your LLM, TTS, or ASR API keys are correct.',
          'For custom LLM: do NOT set vendor or style fields. Only use url, api_key, system_messages, params.',
          'Run `convoai config show` to review your configuration.',
          'Try `convoai agent start --channel test --dry-run` to inspect the request.',
        ],
      };
    }
    return {
      message: `Bad request (400): ${detail}`,
      hints: ['Run with --dry-run to inspect the request payload.'],
    };
  }

  // ── 404 Not Found ──────────────────────────────────────────────────────
  if (status === 404) {
    if (d.includes('task not found') || d.includes('not found')) {
      return {
        message: 'Agent not found',
        hints: [
          'The agent may have already stopped or the ID is incorrect.',
          'Run `convoai agent list --state all` to see all agents.',
        ],
      };
    }
    return { message: `Not found (404): ${detail}`, hints: [] };
  }

  // ── 429 Rate Limited ───────────────────────────────────────────────────
  if (status === 429) {
    return {
      message: 'Rate limited (429)',
      hints: [
        'Too many requests. Wait a moment and try again.',
        'The default limit is 20 concurrent agents per App ID.',
      ],
    };
  }

  // ── 5xx Server Error ───────────────────────────────────────────────────
  if (status >= 500) {
    return {
      message: `Server error (${status}): ${detail}`,
      hints: [
        'The Agora ConvoAI service is experiencing issues.',
        'Try again in a moment. If persistent, check https://status.agora.io',
      ],
    };
  }

  // ── Default ────────────────────────────────────────────────────────────
  return { message: `API Error ${status}: ${detail}`, hints: [] };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Extract a human-readable message from an API error.
 */
export function formatApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data as ApiErrorResponse | undefined;
    const detail = data?.detail || data?.reason || error.message;
    const friendly = diagnose(status, detail, error.code);
    return friendly.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Get repair hints for an error (for display after the error message).
 */
export function getErrorHints(error: unknown): string[] {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data as ApiErrorResponse | undefined;
    const detail = data?.detail || data?.reason || error.message;
    return diagnose(status, detail, error.code).hints;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('missing required credentials')) {
      return ['Run `convoai config init` or `convoai auth login` to set up credentials.'];
    }
    if (msg.includes('app_certificate') || msg.includes('token generation')) {
      return [
        'RTC token generation requires an App Certificate.',
        'Run `convoai config set app_certificate <your_certificate>` to configure.',
      ];
    }
  }

  return [];
}

/**
 * Format an error, print to stderr with hints, and exit with code 1.
 * In JSON mode, outputs a structured error object instead.
 */
export function handleError(
  error: unknown,
  options?: { json?: boolean },
): never {
  const message = formatApiError(error);
  const hints = getErrorHints(error);

  if (options?.json) {
    console.error(JSON.stringify({ error: message, hints }, null, 2));
  } else {
    console.error(`${chalk.red('\u2716')} ${message}`);
    for (const hint of hints) {
      console.error(`${chalk.dim('  → ')}${hint}`);
    }
  }

  process.exit(1);
}
