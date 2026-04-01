import { resolveConfig } from '../../config/manager.js';
import { createClient } from '../../api/client.js';
import { AgentAPI } from '../../api/agents.js';

// ─── Agent API Factory ─────────────────────────────────────────────────────

/**
 * Resolve config for the given profile, create an authenticated HTTP client,
 * and return a ready-to-use AgentAPI instance.
 */
export function getAgentAPI(profileName?: string): AgentAPI {
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
  return new AgentAPI(client);
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
 * Convert a Unix timestamp (seconds) to a relative time string like
 * "2m ago", "1h ago", "3d ago".  Returns "just now" for very recent times.
 */
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
