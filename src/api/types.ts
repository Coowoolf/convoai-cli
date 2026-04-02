// ─── Agent Status ────────────────────────────────────────────────────────────

export type AgentStatus =
  | 'IDLE'
  | 'STARTING'
  | 'RUNNING'
  | 'STOPPING'
  | 'STOPPED'
  | 'RECOVERING'
  | 'FAILED';

export const AgentStatusCode: Record<number, AgentStatus> = {
  0: 'IDLE',
  1: 'STARTING',
  2: 'RUNNING',
  3: 'STOPPING',
  4: 'STOPPED',
  5: 'RECOVERING',
  6: 'FAILED',
};

export const AgentStatusNumber: Record<AgentStatus, number> = {
  IDLE: 0,
  STARTING: 1,
  RUNNING: 2,
  STOPPING: 3,
  STOPPED: 4,
  RECOVERING: 5,
  FAILED: 6,
};

// ─── Turn Detection ─────────────────────────────────────────────────────────

export interface TurnDetection {
  type?: 'agora_vad' | 'server_vad' | 'semantic_vad';
  interrupt_mode?: 'interrupt' | 'append' | 'ignore' | 'adaptive';
  silence_duration_ms?: number;
  interrupt_duration_ms?: number;
  prefix_padding_ms?: number;
  threshold?: number;
}

// ─── LLM Config ─────────────────────────────────────────────────────────────

export interface LLMConfig {
  url?: string;
  api_key?: string;
  vendor?: string;
  style?: 'openai' | 'gemini' | 'anthropic' | 'dify';
  model?: string;
  headers?: string;
  system_messages?: Array<Record<string, unknown>>;
  greeting_message?: string;
  failure_message?: string;
  max_history?: number;
  input_modalities?: string[];
  output_modalities?: string[];
  params?: {
    model?: string;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    [key: string]: unknown;
  };
}

// ─── TTS Config ─────────────────────────────────────────────────────────────

export interface TTSConfig {
  vendor?: string;
  params?: {
    key?: string;
    region?: string;
    voice_name?: string;
    speed?: number;
    volume?: number;
    sample_rate?: number;
    [key: string]: unknown;
  };
}

// ─── ASR Config ─────────────────────────────────────────────────────────────

export interface ASRConfig {
  language?: string;
  vendor?: string;
  params?: {
    key?: string;
    model?: string;
    language?: string;
    [key: string]: unknown;
  };
}

// ─── Advanced Features ──────────────────────────────────────────────────────

export interface AdvancedFeatures {
  enable_aivad?: boolean;
  enable_rtm?: boolean;
  enable_mllm?: boolean;
  enable_sal?: boolean;
  enable_mcp?: boolean;
}

// ─── Silence Config ─────────────────────────────────────────────────────────

export interface SilenceConfig {
  timeout_ms?: number;
  action?: 'speak' | 'leave';
  content?: string;
}

// ─── Agent Parameters ───────────────────────────────────────────────────────

export interface AgentParameters {
  silence_config?: SilenceConfig;
  data_channel?: string;
  enable_metrics?: boolean;
  enable_error_message?: boolean;
}

// ─── Agent Properties ───────────────────────────────────────────────────────

export interface AgentProperties {
  channel: string;
  token?: string;
  agent_rtc_uid?: string;
  remote_rtc_uids?: string[];
  enable_string_uid?: boolean;
  idle_timeout?: number;
  llm?: LLMConfig;
  tts?: TTSConfig;
  asr?: ASRConfig;
  turn_detection?: TurnDetection;
  parameters?: AgentParameters;
  advanced_features?: AdvancedFeatures;
  labels?: Record<string, string>;
}

// ─── Start Agent Request / Response ─────────────────────────────────────────

export interface StartAgentRequest {
  name: string;
  properties?: AgentProperties;
  preset?: string;
  pipeline_id?: string;
}

export interface StartAgentResponse {
  agent_id: string;
  create_ts: number;
  status: AgentStatus;
}

// ─── Query Agent Response ───────────────────────────────────────────────────

export interface QueryAgentResponse {
  agent_id: string;
  status: AgentStatus;
  start_ts: number;
  stop_ts?: number;
  message?: string;
  channel?: string;
}

// ─── List Agents ────────────────────────────────────────────────────────────

export interface ListAgentsParams {
  state?: number;
  limit?: number;
  channel?: string;
  from_time?: number;
  to_time?: number;
  cursor?: string;
}

export interface ListAgentsResponse {
  data: {
    count: number;
    list: Array<{
      agent_id: string;
      status: AgentStatus;
      start_ts: number;
      stop_ts?: number;
      channel?: string;
    }>;
  };
  meta: {
    cursor?: string;
    total?: number;
  };
  status: string;
}

// ─── Update Agent ───────────────────────────────────────────────────────────

export interface UpdateAgentRequest {
  properties: Partial<Pick<AgentProperties, 'token' | 'llm'>>;
}

export interface UpdateAgentResponse {
  agent_id: string;
  create_ts: number;
  status: AgentStatus;
}

// ─── Speak ──────────────────────────────────────────────────────────────────

export type SpeakPriority = 'INTERRUPT' | 'APPEND' | 'IGNORE';

export interface SpeakRequest {
  text: string;
  priority?: SpeakPriority;
  interrupt?: boolean;
}

export interface SpeakResponse {
  agent_id: string;
  channel: string;
  start_ts: number;
}

// ─── History ────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
  turn_id?: string;
  timestamp?: number;
  metadata?: {
    source?: string;
    interrupted?: boolean;
  };
}

export interface HistoryResponse {
  agent_id: string;
  start_ts: number;
  status: AgentStatus;
  contents: HistoryEntry[];
}

// ─── Turns (Analytics) ─────────────────────────────────────────────────────

export interface TurnEntry {
  turn_id: string;
  start_ts: number;
  end_ts: number;
  type: 'voice_input' | 'greeting' | 'silence_timeout' | 'api_speak';
  end_reason: 'ok' | 'interrupted' | 'ignored' | 'error';
  e2e_latency_ms?: number;
  segmented_latency_ms?: {
    asr_ms?: number;
    llm_ms?: number;
    tts_ms?: number;
  };
}

export interface TurnsResponse {
  agent_id: string;
  turns: TurnEntry[];
}

// ─── Error Response ─────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  detail: string;
  reason: string;
}

// ─── Config Types ───────────────────────────────────────────────────────────

export interface ConvoAIConfig {
  app_id?: string;
  app_certificate?: string;
  customer_id?: string;
  customer_secret?: string;
  base_url?: string;
  region?: 'global' | 'cn';
  default_profile?: string;
  profiles?: Record<string, ProfileConfig>;
}

export interface ProfileConfig {
  app_id?: string;
  customer_id?: string;
  customer_secret?: string;
  base_url?: string;
  region?: 'global' | 'cn';
  llm?: Partial<LLMConfig>;
  tts?: Partial<TTSConfig>;
  asr?: Partial<ASRConfig>;
}
