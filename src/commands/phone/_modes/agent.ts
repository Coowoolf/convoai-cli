import type { LLMConfig, TTSConfig, ASRConfig } from '../../../api/types.js';
import type { CallConfig } from './free.js';
import { SUPPORTED_LANGUAGES } from './translate.js';

export interface AgentCallParams {
  toNumber: string;
  fromNumber: string;
  task: string;
  taskLang: string;
  llm: Partial<LLMConfig>;
  tts: Partial<TTSConfig>;
  asr: Partial<ASRConfig>;
}

export function buildAgentCallConfig(params: AgentCallParams): CallConfig {
  const agentPrompt =
    `You are an AI phone agent. Your task: ${params.task}\n\n` +
    `Speak in ${params.taskLang}. Be polite and professional. ` +
    `Introduce yourself, state your purpose clearly, and work toward completing the task. ` +
    `If you successfully complete the task, confirm the details. ` +
    `If the task cannot be completed, politely end the conversation.`;

  return {
    mode: 'agent',
    toNumber: params.toNumber,
    fromNumber: params.fromNumber,
    llm: {
      ...params.llm,
      system_messages: [{ role: 'system', content: agentPrompt }],
    },
    tts: { ...params.tts },
    asr: { ...params.asr, language: params.taskLang },
    idleTimeout: 900,
    label: `🤖 Agent → ${params.toNumber}`,
  };
}

/** Interactive parameter collection for agent mode. */
export async function collectAgentParams(opts: {
  to?: string;
  task?: string;
  taskLang?: string;
}): Promise<{ toNumber: string; task: string; taskLang: string }> {
  const { safePrompt } = await import('../../../ui/prompt.js');
  const { validateE164 } = await import('../_helpers.js');

  let task = opts.task;
  if (!task) {
    const ans = await safePrompt([{
      type: 'input',
      name: 'task',
      message: 'Describe the task:',
      validate: (v: string) => v.trim().length > 0 || 'Task description is required',
    }]);
    task = ans.task;
  }

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

  let taskLang = opts.taskLang;
  if (!taskLang) {
    const ans = await safePrompt([{
      type: 'list',
      name: 'lang',
      message: 'Language to speak:',
      choices: SUPPORTED_LANGUAGES,
    }]);
    taskLang = ans.lang;
  }

  return { toNumber, task: task!, taskLang: taskLang! };
}
