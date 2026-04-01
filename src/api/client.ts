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
    timeout: 30_000,
  });

  // ── Request interceptor: no-op pass-through (extend as needed) ──────────
  client.interceptors.request.use((req) => req);

  // ── Response interceptor: normalize API errors ──────────────────────────
  client.interceptors.response.use(
    (res) => res,
    (error: AxiosError<ApiErrorResponse>) => {
      if (error.response?.data) {
        const { detail, reason } = error.response.data;
        const status = error.response.status;
        const message = detail || reason || error.message;
        const formatted = new Error(
          `API Error ${status}: ${message}`,
        ) as Error & { status: number; detail?: string; reason?: string };
        formatted.status = status;
        formatted.detail = detail;
        formatted.reason = reason;
        return Promise.reject(formatted);
      }
      return Promise.reject(error);
    },
  );

  return client;
}
