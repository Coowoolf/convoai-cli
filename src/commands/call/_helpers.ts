import { resolveConfig } from '../../config/manager.js';
import { createClient } from '../../api/client.js';
import { CallAPI } from '../../api/calls.js';

// ─── Call API Factory ─────────────────────────────────────────────────────

/**
 * Resolve config for the given profile, create an authenticated HTTP client,
 * and return a ready-to-use CallAPI instance.
 */
export function getCallAPI(profileName?: string): CallAPI {
  const config = resolveConfig(profileName);

  if (!config.app_id || !config.customer_id || !config.customer_secret) {
    const missing: string[] = [];
    if (!config.app_id) missing.push('app_id');
    if (!config.customer_id) missing.push('customer_id');
    if (!config.customer_secret) missing.push('customer_secret');
    throw new Error(
      `Missing required credentials: ${missing.join(', ')}. Run "convoai auth login" to configure.`,
    );
  }

  const client = createClient({
    appId: config.app_id,
    customerId: config.customer_id,
    customerSecret: config.customer_secret,
    baseUrl: config.base_url,
    region: config.region as 'global' | 'cn' | undefined,
  });
  return new CallAPI(client);
}

// ─── Timestamp Formatting ──────────────────────────────────────────────────

/**
 * Format a Unix timestamp (seconds) to a human-readable date string.
 * Returns "—" for falsy values.
 */
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

/**
 * Format a duration in seconds to a human-readable string like "2m 30s".
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes < 60) return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return remainingMin > 0 ? `${hours}h ${remainingMin}m` : `${hours}h`;
}
