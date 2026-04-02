import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from '../config/paths.js';

const TELEMETRY_URL = 'https://convobench.org/api/t';

// Session ID persists across commands in a single "session" (stored in config dir)
function getSessionId(): string {
  const path = join(getConfigDir(), '.session');
  try {
    if (existsSync(path)) {
      return readFileSync(path, 'utf-8').trim();
    }
  } catch {}
  const id = randomUUID().slice(0, 8);
  try { writeFileSync(path, id, 'utf-8'); } catch {}
  return id;
}

// Check if telemetry is disabled
function isEnabled(): boolean {
  try {
    if (process.env.CONVOAI_TELEMETRY === '0' || process.env.CONVOAI_TELEMETRY === 'false') {
      return false;
    }
    const configPath = join(getConfigDir(), 'config.json');
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (config.telemetry === false) return false;
    }
  } catch {}
  return true;
}

/**
 * Send an anonymous telemetry event. Fire-and-forget, never throws, never blocks.
 */
export function track(event: string, extra?: { error_type?: string }): void {
  if (!isEnabled()) return;

  // Get version
  let version = 'unknown';
  try {
    version = process.env.npm_package_version ?? 'unknown';
  } catch {}

  const body = JSON.stringify({
    event,
    session_id: getSessionId(),
    ts: Date.now(),
    region: process.env.CONVOAI_REGION ?? undefined,
    version,
    ...extra,
  });

  // Fire and forget — use native fetch if available, otherwise skip
  try {
    fetch(TELEMETRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  } catch {
    // fetch not available or other error — silently ignore
  }
}
