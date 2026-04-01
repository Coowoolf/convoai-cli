import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

// ─── Constants ──────────────────────────────────────────────────────────────

const CONFIG_DIR_NAME = 'convoai';
const CONFIG_FILE_NAME = 'config.json';
const PROJECT_CONFIG_NAME = '.convoai.json';

// ─── XDG-Compliant Config Paths ────────────────────────────────────────────

/**
 * Returns the config directory, respecting XDG_CONFIG_HOME.
 * Creates the directory if it does not exist.
 */
export function getConfigDir(): string {
  const xdgHome = process.env.XDG_CONFIG_HOME;
  const base = xdgHome || join(homedir(), '.config');
  const dir = join(base, CONFIG_DIR_NAME);

  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Returns the full path to the global config file. */
export function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILE_NAME);
}

/** Returns the full path to a project-local config file in the CWD. */
export function getProjectConfigPath(): string {
  return resolve(process.cwd(), PROJECT_CONFIG_NAME);
}
