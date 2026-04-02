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

// ─── Timestamp / Duration Formatting (re-exported from shared utils) ──────

export { formatTimestamp, formatDuration } from '../../utils/format.js';
