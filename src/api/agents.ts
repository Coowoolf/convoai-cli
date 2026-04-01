import type { AxiosInstance } from 'axios';
import type {
  StartAgentRequest,
  StartAgentResponse,
  QueryAgentResponse,
  ListAgentsParams,
  ListAgentsResponse,
  UpdateAgentRequest,
  UpdateAgentResponse,
  SpeakRequest,
  SpeakResponse,
  HistoryResponse,
  TurnsResponse,
} from './types.js';

// ─── Agent API ──────────────────────────────────────────────────────────────

export class AgentAPI {
  constructor(private readonly client: AxiosInstance) {}

  /** Start (join) a new conversational AI agent. */
  async start(req: StartAgentRequest): Promise<StartAgentResponse> {
    const { data } = await this.client.post<StartAgentResponse>('/join', req);
    return data;
  }

  /** Stop (leave) a running agent. */
  async stop(agentId: string): Promise<void> {
    await this.client.post(`/agents/${agentId}/leave`);
  }

  /** Query the current status of an agent. */
  async status(agentId: string): Promise<QueryAgentResponse> {
    const { data } = await this.client.get<QueryAgentResponse>(`/agents/${agentId}`);
    return data;
  }

  /** List agents with optional filters. */
  async list(params?: ListAgentsParams): Promise<ListAgentsResponse> {
    const { data } = await this.client.get<ListAgentsResponse>('/agents', { params });
    return data;
  }

  /** Update a running agent's properties (e.g. token, LLM config). */
  async update(agentId: string, req: UpdateAgentRequest): Promise<UpdateAgentResponse> {
    const { data } = await this.client.post<UpdateAgentResponse>(
      `/agents/${agentId}/update`,
      req,
    );
    return data;
  }

  /** Instruct an agent to speak the given text. */
  async speak(agentId: string, req: SpeakRequest): Promise<SpeakResponse> {
    const { data } = await this.client.post<SpeakResponse>(
      `/agents/${agentId}/speak`,
      req,
    );
    return data;
  }

  /** Interrupt an agent that is currently speaking. */
  async interrupt(agentId: string): Promise<void> {
    await this.client.post(`/agents/${agentId}/interrupt`);
  }

  /** Retrieve conversation history for an agent. */
  async history(agentId: string): Promise<HistoryResponse> {
    const { data } = await this.client.get<HistoryResponse>(
      `/agents/${agentId}/history`,
    );
    return data;
  }

  /** Retrieve turn-level analytics for an agent. */
  async turns(agentId: string): Promise<TurnsResponse> {
    const { data } = await this.client.get<TurnsResponse>(`/agents/${agentId}/turns`);
    return data;
  }
}
