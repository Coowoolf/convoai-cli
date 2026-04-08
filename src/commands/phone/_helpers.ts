// src/commands/phone/_helpers.ts
import axios from 'axios';
import { resolveConfig } from '../../config/manager.js';
import { createClient } from '../../api/client.js';
import { CallAPI } from '../../api/calls.js';
import { NumberAPI } from '../../api/numbers.js';
import type { PhoneNumber } from '../../api/numbers.js';

// ─── E.164 Validation ──────────────────────────────────────────────────────

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export function isE164(phone: string): boolean {
  return E164_REGEX.test(phone);
}

export function validateE164(phone: string): string {
  const trimmed = phone.trim();
  if (!isE164(trimmed)) {
    throw new Error(`Invalid phone number "${trimmed}". Use E.164 format: +15551234567`);
  }
  return trimmed;
}

// ─── Credential Check ──────────────────────────────────────────────────────

function requireCredentials(config: { app_id?: string; customer_id?: string; customer_secret?: string }) {
  const missing: string[] = [];
  if (!config.app_id) missing.push('app_id');
  if (!config.customer_id) missing.push('customer_id');
  if (!config.customer_secret) missing.push('customer_secret');
  if (missing.length > 0) {
    throw new Error(`Missing credentials: ${missing.join(', ')}. Run "convoai quickstart" to configure.`);
  }
}

// ─── API Factories ─────────────────────────────────────────────────────────

/** Create a project-scoped CallAPI (baseURL includes /projects/{appId}). */
export function getCallAPI(profileName?: string): CallAPI {
  const config = resolveConfig(profileName);
  requireCredentials(config);
  const client = createClient({
    appId: config.app_id!,
    customerId: config.customer_id!,
    customerSecret: config.customer_secret!,
    baseUrl: config.base_url,
    region: config.region as 'global' | 'cn' | undefined,
  });
  return new CallAPI(client);
}

/** Create an account-scoped NumberAPI (baseURL does NOT include /projects/{appId}). */
export function getNumberAPI(profileName?: string): NumberAPI {
  const config = resolveConfig(profileName);
  requireCredentials(config);

  const region = config.region ?? 'global';
  let baseURL: string;
  if (config.base_url) {
    // Custom base URL: strip /projects/{appId} suffix if present, keep the base
    baseURL = config.base_url.replace(/\/projects\/[^/]+\/?$/, '');
  } else {
    const baseURLs: Record<string, string> = {
      global: 'https://api.agora.io/api/conversational-ai-agent/v2',
      cn: 'https://api.agora.io/cn/api/conversational-ai-agent/v2',
    };
    baseURL = baseURLs[region] ?? baseURLs.global;
  }
  const credentials = Buffer.from(`${config.customer_id}:${config.customer_secret}`).toString('base64');

  const client = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    timeout: 30_000,
  });

  return new NumberAPI(client);
}

/** Get resolved config. */
export function getConfig(profileName?: string) {
  return resolveConfig(profileName);
}

// ─── Interactive Number Picker ─────────────────────────────────────────────

export async function pickOutboundNumber(
  numbers: PhoneNumber[],
): Promise<PhoneNumber> {
  const outbound = numbers.filter(n => n.outbound);
  if (outbound.length === 0) {
    throw new Error('No outbound-capable numbers found. Import one with: convoai phone import');
  }

  if (outbound.length === 1) return outbound[0];

  const { default: inquirer } = await import('inquirer');
  const { selected } = await inquirer.prompt([{
    type: 'list',
    name: 'selected',
    message: 'From number:',
    choices: outbound.map(n => ({
      name: `${n.phone_number} (${n.label})`,
      value: n.phone_number,
    })),
  }]);

  return outbound.find(n => n.phone_number === selected)!;
}
