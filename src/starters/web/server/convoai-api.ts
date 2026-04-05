//
// Direct Agora ConvoAI REST API wrapper.
// No dependency on the convoai CLI package — pure HTTP + token generation.
// Customize: add retry logic, error handling, or additional endpoints as needed.

import agoraToken from 'agora-token';
const { RtcTokenBuilder, RtcRole } = agoraToken;

// ─── Config ────────────────────────────────────────────────────────────────

const BASE_URLS: Record<string, string> = {
  global: 'https://api.agora.io/api/conversational-ai-agent/v2/projects',
  cn: 'https://api.agora.io/cn/api/conversational-ai-agent/v2/projects',
};

function getBaseUrl(appId: string, region: string = 'global'): string {
  const base = BASE_URLS[region] ?? BASE_URLS.global;
  return `${base}/${appId}`;
}

function getAuthHeader(customerId: string, customerSecret: string): string {
  return 'Basic ' + Buffer.from(`${customerId}:${customerSecret}`).toString('base64');
}

// ─── Token Generation ──────────────────────────────────────────────────────

export function generateToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
  expirationSeconds: number = 3600,
): string {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationSeconds;
  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    privilegeExpiredTs,
    privilegeExpiredTs,
  );
}

// ─── Start Agent ───────────────────────────────────────────────────────────

export interface StartAgentConfig {
  appId: string;
  appCertificate: string;
  customerId: string;
  customerSecret: string;
  region?: string;
  channel: string;
  agentUid?: number;
  clientUid: number;
  llm: {
    vendor?: string;
    model?: string;
    apiKey?: string;
    url?: string;
    style?: string;
  };
  tts: {
    vendor?: string;
    params?: Record<string, unknown>;
  };
  asr?: {
    vendor?: string;
    language?: string;
  };
  greeting?: string;
}

export interface StartAgentResult {
  agentId: string;
  appId: string;
  channel: string;
  token: string;
  uid: number;
}

export async function startAgent(config: StartAgentConfig): Promise<StartAgentResult> {
  const {
    appId, appCertificate, customerId, customerSecret,
    region = 'global', channel, agentUid = 0, clientUid,
    llm, tts, asr, greeting,
  } = config;

  const agentToken = generateToken(appId, appCertificate, channel, agentUid);
  const clientToken = generateToken(appId, appCertificate, channel, clientUid);

  const body: Record<string, unknown> = {
    name: 'convoai-starter',
    properties: {
      channel: channel,
      token: agentToken,
      agent_rtc_uid: String(agentUid),
      remote_rtc_uids: [String(clientUid)],
      llm: {
        url: llm.url || undefined,
        api_key: llm.apiKey || undefined,
        // Only set vendor for anthropic/gemini — other vendors use style only
        vendor: (llm.vendor === 'anthropic' || llm.vendor === 'gemini') ? llm.vendor : undefined,
        style: llm.style || undefined,
        model: llm.model || undefined,
        greeting_message: greeting || 'Hello! How can I help you today?',
        max_history: 20,
        params: {
          model: llm.model || undefined,
          max_tokens: 512,
          temperature: 0.7,
        },
      },
      tts: {
        vendor: tts.vendor || undefined,
        params: tts.params || {},
      },
      asr: {
        vendor: asr?.vendor || 'ares',
        language: asr?.language || 'en-US',
      },
      turn_detection: {
        silence_duration_ms: 800,
      },
      parameters: {
        data_channel: 'datastream',
        transcript: {
          enable: true,
          protocol_version: 'v2',
        },
        enable_metrics: true,
      },
    },
  };

  const url = `${getBaseUrl(appId, region)}/join`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(customerId, customerSecret),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ConvoAI API error (${res.status}): ${text}`);
  }

  const data = await res.json() as { agent_id: string };

  return {
    agentId: data.agent_id,
    appId,
    channel,
    token: clientToken,
    uid: clientUid,
  };
}

// ─── Stop Agent ────────────────────────────────────────────────────────────

export async function stopAgent(
  appId: string,
  agentId: string,
  customerId: string,
  customerSecret: string,
  region: string = 'global',
): Promise<void> {
  const url = `${getBaseUrl(appId, region)}/agents/${agentId}/leave`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(customerId, customerSecret),
    },
    body: '{}',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ConvoAI API error (${res.status}): ${text}`);
  }
}

// ─── Interrupt Agent ───────────────────────────────────────────────────────

export async function interruptAgent(
  appId: string,
  agentId: string,
  customerId: string,
  customerSecret: string,
  region: string = 'global',
): Promise<void> {
  const url = `${getBaseUrl(appId, region)}/agents/${agentId}/interrupt`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(customerId, customerSecret),
    },
    body: '{}',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ConvoAI API error (${res.status}): ${text}`);
  }
}

// ─── Get History ───────────────────────────────────────────────────────────

export interface HistoryEntry {
  role: string;
  content: string;
  timestamp?: number;
}

export async function getHistory(
  appId: string,
  agentId: string,
  customerId: string,
  customerSecret: string,
  region: string = 'global',
): Promise<HistoryEntry[]> {
  const url = `${getBaseUrl(appId, region)}/agents/${agentId}/history`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(customerId, customerSecret),
    },
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json() as { history?: HistoryEntry[] };
  return data.history ?? [];
}
