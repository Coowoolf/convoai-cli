import type { LLMConfig, TTSConfig, ASRConfig } from '../../../api/types.js';

export interface CallConfig {
  mode: 'free' | 'translate' | 'agent';
  toNumber: string;
  fromNumber: string;
  llm: Record<string, unknown>;
  tts: Record<string, unknown>;
  asr: Record<string, unknown>;
  idleTimeout: number;
  label: string;
}

export interface FreeCallParams {
  toNumber: string;
  fromNumber: string;
  task?: string;
  llm: Partial<LLMConfig>;
  tts: Partial<TTSConfig>;
  asr: Partial<ASRConfig>;
}

const DEFAULT_PROMPT = 'You are a helpful voice assistant. Keep responses concise and conversational.';

export function buildFreeCallConfig(params: FreeCallParams): CallConfig {
  const systemMessage = params.task || DEFAULT_PROMPT;

  return {
    mode: 'free',
    toNumber: params.toNumber,
    fromNumber: params.fromNumber,
    llm: {
      ...params.llm,
      system_messages: [{ role: 'system', content: systemMessage }],
    },
    tts: { ...params.tts },
    asr: { ...params.asr },
    idleTimeout: 600,
    label: `📱 Free Call → ${params.toNumber}`,
  };
}

/** Interactive parameter collection for free call mode. */
export async function collectFreeParams(opts: {
  to?: string;
  from?: string;
  task?: string;
}): Promise<{ toNumber: string; task?: string }> {
  const { safePrompt } = await import('../../../ui/prompt.js');
  const { validateE164 } = await import('../_helpers.js');

  let toNumber = opts.to;
  if (!toNumber) {
    const ans = await safePrompt([{
      type: 'input',
      name: 'to',
      message: 'Phone number to call (E.164):',
      validate: (v: string) => /^\+[1-9]\d{1,14}$/.test(v.trim()) || 'Invalid E.164 format',
    }]);
    toNumber = ans.to;
  }
  toNumber = validateE164(toNumber!);

  let task = opts.task;
  if (task === undefined) {
    const ans = await safePrompt([{
      type: 'input',
      name: 'task',
      message: 'Anything to tell the agent? (optional):',
    }]);
    task = ans.task || undefined;
  }

  return { toNumber, task }; // fromNumber resolved by caller
}
