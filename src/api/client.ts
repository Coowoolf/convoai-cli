import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type { ApiErrorResponse } from './types.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ClientConfig {
  appId: string;
  customerId: string;
  customerSecret: string;
  baseUrl?: string;
  region?: 'global' | 'cn';
}

// ─── Base URL Resolution ────────────────────────────────────────────────────

const BASE_URLS: Record<string, string> = {
  global: 'https://api.agora.io/api/conversational-ai-agent/v2/projects',
  cn: 'https://api.agora.io/cn/api/conversational-ai-agent/v2/projects',
};

export function resolveBaseUrl(
  appId: string,
  region?: string,
  customBaseUrl?: string,
): string {
  if (customBaseUrl) {
    // If custom URL already contains the appId path segment, use as-is
    return customBaseUrl.replace(/\/$/, '');
  }
  const base = BASE_URLS[region ?? 'global'] ?? BASE_URLS.global;
  return `${base}/${appId}`;
}

// ─── Retry Helpers ─────────────────────────────────────────────────────────

const RETRY_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Client Factory ─────────────────────────────────────────────────────────

export function createClient(config: ClientConfig): AxiosInstance {
  const { appId, customerId, customerSecret, baseUrl, region } = config;

  const resolvedUrl = resolveBaseUrl(appId, region, baseUrl);
  const credentials = Buffer.from(`${customerId}:${customerSecret}`).toString('base64');

  const client = axios.create({
    baseURL: resolvedUrl,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    timeout: 60_000,
  });

  // ── Response interceptor: retry + normalize API errors ───────────────────
  client.interceptors.response.use(
    (res) => res,
    async (error: AxiosError<ApiErrorResponse>) => {
      const config = error.config;
      const status = error.response?.status;

      // Retry on retryable status codes
      if (config && status && RETRY_STATUS_CODES.has(status)) {
        const retryCount = ((config as any).__retryCount ?? 0) as number;
        if (retryCount < MAX_RETRIES) {
          (config as any).__retryCount = retryCount + 1;
          const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
          await sleep(delay);
          return client.request(config);
        }
      }

      // Format the error
      if (error.response?.data) {
        const { detail, reason } = error.response.data;
        const message = detail || reason || error.message;
        const formatted = new Error(
          `API Error ${status}: ${message}`,
        ) as Error & { status: number; detail?: string; reason?: string };
        formatted.status = status!;
        formatted.detail = detail;
        formatted.reason = reason;
        return Promise.reject(formatted);
      }
      return Promise.reject(error);
    },
  );

  return client;
}
