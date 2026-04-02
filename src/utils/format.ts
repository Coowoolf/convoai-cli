import chalk from 'chalk';

/** Generate a unique agent name. */
export function generateAgentName(): string {
  const ts = Math.floor(Date.now() / 1000);
  const rand = Math.random().toString(36).slice(2, 6);
  return `agent-${ts}-${rand}`;
}

/** Mask a secret: show first 4 chars, then ****. */
export function maskSecret(value: string | undefined): string {
  if (!value) return '(not set)';
  if (value.length <= 4) return '****';
  return value.slice(0, 4) + '****';
}

/** Format a Unix timestamp (seconds) to readable date. Returns "—" for falsy values. */
export function formatTimestamp(ts: number | undefined): string {
  if (!ts) return '—';
  const date = new Date(ts * 1000);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Convert a Unix timestamp to a relative time string. */
export function relativeTime(ts: number | undefined): string {
  if (!ts) return '—';
  const nowSec = Math.floor(Date.now() / 1000);
  const diffSec = nowSec - ts;
  if (diffSec < 0) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/** Format a duration in seconds to human-readable string. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

/** Color-code a latency value: green < 1000ms, yellow 1000-2000ms, red > 2000ms. */
export function colorLatency(ms: number | undefined): string {
  if (ms === undefined || ms === null) return '—';
  const str = `${ms}ms`;
  if (ms < 1000) return chalk.green(str);
  if (ms < 2000) return chalk.yellow(str);
  return chalk.red(str);
}

/** Format a role for conversation display. */
export function formatRole(role: string): string {
  if (role === 'user') return chalk.cyan(`[${role}]`.padEnd(12));
  if (role === 'assistant') return chalk.green(`[${role}]`.padEnd(12));
  return chalk.dim(`[${role}]`.padEnd(12));
}

/** Calculate average of an array of numbers, ignoring undefined. */
export function averageOf(values: (number | undefined)[]): number {
  const valid = values.filter((v): v is number => v !== undefined && v !== null);
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
}
