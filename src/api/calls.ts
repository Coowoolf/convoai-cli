import type { AxiosInstance } from 'axios';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InitiateCallRequest {
  name: string;
  properties: {
    channel: string;
    phone_number: string;
    agent_rtc_uid?: string;
    idle_timeout?: number;
    llm?: {
      url?: string;
      api_key?: string;
      system_messages?: Array<{ role: string; content: string }>;
      greeting_message?: string;
      params?: { model?: string; max_tokens?: number; temperature?: number };
    };
    tts?: { vendor?: string; params?: Record<string, unknown> };
    asr?: { language?: string; vendor?: string };
  };
}

export interface CallStatusResponse {
  agent_id: string;
  status: string;
  direction: 'inbound' | 'outbound';
  phone_number?: string;
  start_ts: number;
  end_ts?: number;
}

// ─── Call API ───────────────────────────────────────────────────────────────

export class CallAPI {
  constructor(private readonly client: AxiosInstance) {}

  /** Initiate an outbound phone call. */
  async initiate(req: InitiateCallRequest): Promise<{ agent_id: string; status: string }> {
    const { data } = await this.client.post<{ agent_id: string; status: string }>('/call', req);
    return data;
  }

  /** Hang up an active call. */
  async hangup(agentId: string): Promise<void> {
    await this.client.post(`/calls/${agentId}/hangup`);
  }

  /** Get the current status of a call. */
  async status(agentId: string): Promise<CallStatusResponse> {
    const { data } = await this.client.get<CallStatusResponse>(`/calls/${agentId}`);
    return data;
  }
}
