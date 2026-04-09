import { z } from 'zod';

// ─── LLM / TTS / ASR partial schemas (for profile embedding) ───────────────

const LLMPartialSchema = z.object({
  url: z.string().optional(),
  api_key: z.string().optional(),
  vendor: z.string().optional(),
  style: z.enum(['openai', 'gemini', 'anthropic', 'dify']).optional(),
  model: z.string().optional(),
  headers: z.string().optional(),
  system_messages: z.array(z.record(z.unknown())).optional(),
  greeting_message: z.string().optional(),
  failure_message: z.string().optional(),
  max_history: z.number().optional(),
  input_modalities: z.array(z.string()).optional(),
  output_modalities: z.array(z.string()).optional(),
  params: z.record(z.unknown()).optional(),
}).passthrough().optional();

const TTSPartialSchema = z.object({
  vendor: z.string().optional(),
  params: z.record(z.unknown()).optional(),
}).passthrough().optional();

const ASRPartialSchema = z.object({
  language: z.string().optional(),
  vendor: z.string().optional(),
  params: z.record(z.unknown()).optional(),
}).passthrough().optional();

const VoiceProfileSchema = z.object({
  id: z.string().optional(),
  provider: z.string().optional(),
  voice_id: z.string().optional(),
}).optional();

// ─── Profile Config ─────────────────────────────────────────────────────────

export const ProfileConfigSchema = z.object({
  app_id: z.string().optional(),
  customer_id: z.string().optional(),
  customer_secret: z.string().optional(),
  base_url: z.string().optional(),
  region: z.enum(['global', 'cn']).optional(),
  llm: LLMPartialSchema,
  tts: TTSPartialSchema,
  asr: ASRPartialSchema,
  turn_detection: z.record(z.unknown()).optional(),
}).passthrough();

// ─── Top-Level Config ───────────────────────────────────────────────────────

export const ConvoAIConfigSchema = z.object({
  app_id: z.string().optional(),
  app_certificate: z.string().optional(),
  customer_id: z.string().optional(),
  customer_secret: z.string().optional(),
  base_url: z.string().optional(),
  region: z.enum(['global', 'cn']).optional(),
  default_profile: z.string().optional(),
  profiles: z.record(ProfileConfigSchema).optional(),
  voice_profile: VoiceProfileSchema,
});

// ─── Validation Helper ──────────────────────────────────────────────────────

export type ValidatedConfig = z.infer<typeof ConvoAIConfigSchema>;

/**
 * Validate and parse raw data against the ConvoAI config schema.
 * Throws a ZodError if the data is invalid.
 */
export function validateConfig(data: unknown): ValidatedConfig {
  return ConvoAIConfigSchema.parse(data);
}
