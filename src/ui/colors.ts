import chalk from 'chalk';
import type { AgentStatus } from '../api/types.js';

// ─── Status Colors ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<AgentStatus, (text: string) => string> = {
  RUNNING: chalk.green,
  STARTING: chalk.yellow,
  RECOVERING: chalk.yellow,
  FAILED: chalk.red,
  STOPPED: chalk.red,
  IDLE: chalk.gray,
  STOPPING: chalk.gray,
};

/** Colorize an agent status string for terminal display. */
export function colorStatus(status: AgentStatus): string {
  const colorize = STATUS_COLORS[status] ?? chalk.white;
  return colorize(status);
}

// ─── General-Purpose Helpers ────────────────────────────────────────────────

export function dim(text: string): string {
  return chalk.dim(text);
}

export function bold(text: string): string {
  return chalk.bold(text);
}

export function success(text: string): string {
  return chalk.green(text);
}

export function error(text: string): string {
  return chalk.red(text);
}

export function warn(text: string): string {
  return chalk.yellow(text);
}

export function info(text: string): string {
  return chalk.cyan(text);
}
