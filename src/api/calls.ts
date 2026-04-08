// src/api/calls.ts
import type { AxiosInstance } from 'axios';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SendCallRequest {
  name: string;
  sip: {
    to_number: string;
    from_number: string;
    rtc_uid: string;
    rtc_token: string;
  };
  properties: {
    channel: string;
    token: string;
    agent_rtc_uid: string;
    remote_rtc_uids: string[];
    idle_timeout?: number;
    llm?: Record<string, unknown>;
    tts?: Record<string, unknown>;
    asr?: Record<string, unknown>;
  };
}

export interface SendCallResponse {
  agent_id: string;
}

export interface CallStatusResponse {
  agent_id: string;
  status: string;
  start_ts: number;
  stop_ts?: number;
  channel?: string;
  message?: string;
}

// ─── Call API ───────────────────────────────────────────────────────────────

export class CallAPI {
  constructor(private readonly client: AxiosInstance) {}

  /** Initiate an outbound phone call via SIP. */
  async send(req: SendCallRequest): Promise<SendCallResponse> {
    const { data } = await this.client.post<SendCallResponse>('/call', req);
    return data;
  }

  /** Get the current status of a call (reuses agent status endpoint). */
  async status(agentId: string): Promise<CallStatusResponse> {
    const { data } = await this.client.get<CallStatusResponse>(`/agents/${agentId}`);
    return data;
  }

  /** Hang up an active call (reuses agent leave endpoint). */
  async hangup(agentId: string): Promise<void> {
    await this.client.post(`/agents/${agentId}/leave`);
  }

  /** List calls (reuses agent list, caller can filter). */
  async list(params?: { limit?: number; state?: number }): Promise<{ data: { list: CallStatusResponse[] } }> {
    const { data } = await this.client.get('/agents', { params });
    return data;
  }
}
