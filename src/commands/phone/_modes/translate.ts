import type { LLMConfig, TTSConfig, ASRConfig } from '../../../api/types.js';
import type { CallConfig } from './free.js';

export const SUPPORTED_LANGUAGES = [
  { value: 'zh', name: 'Chinese (中文)' },
  { value: 'en', name: 'English' },
  { value: 'ja', name: 'Japanese (日本語)' },
  { value: 'ko', name: 'Korean (한국어)' },
  { value: 'es', name: 'Spanish (Español)' },
  { value: 'fr', name: 'French (Français)' },
  { value: 'de', name: 'German (Deutsch)' },
  { value: 'pt', name: 'Portuguese (Português)' },
  { value: 'ru', name: 'Russian (Русский)' },
  { value: 'ar', name: 'Arabic (العربية)' },
  { value: 'hi', name: 'Hindi (हिन्दी)' },
  { value: 'th', name: 'Thai (ไทย)' },
  { value: 'vi', name: 'Vietnamese (Tiếng Việt)' },
  { value: 'it', name: 'Italian (Italiano)' },
  { value: 'tr', name: 'Turkish (Türkçe)' },
  { value: 'id', name: 'Indonesian (Bahasa)' },
];

export interface TranslateCallParams {
  toNumber: string;
  fromNumber: string;
  sourceLang: string;
  targetLang: string;
  llm: Partial<LLMConfig>;
  tts: Partial<TTSConfig>;
  asr: Partial<ASRConfig>;
}

/** Parse a "source:target" language pair string. */
export function parseLanguagePair(pair: string): { source: string; target: string } {
  const parts = pair.split(':');
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
    throw new Error(`Invalid language pair "${pair}". Use format: zh:ja`);
  }
  return { source: parts[0].trim(), target: parts[1].trim() };
}

export function buildTranslateCallConfig(params: TranslateCallParams): CallConfig {
  const translationPrompt =
    `You are a real-time voice translator. ` +
    `The caller speaks ${params.sourceLang}. The person on the other end speaks ${params.targetLang}. ` +
    `Translate everything the caller says into ${params.targetLang}, and everything the other person says into ${params.sourceLang}. ` +
    `Translate naturally and conversationally. Do not add commentary, just translate. ` +
    `Preserve tone and intent.`;

  return {
    mode: 'translate',
    toNumber: params.toNumber,
    fromNumber: params.fromNumber,
    llm: {
      ...params.llm,
      system_messages: [{ role: 'system', content: translationPrompt }],
    },
    tts: { ...params.tts },
    asr: { ...params.asr },
    idleTimeout: 1800,
    label: `🌐 Translate [${params.sourceLang} → ${params.targetLang}] → ${params.toNumber}`,
  };
}

/** Interactive parameter collection for translate mode. */
export async function collectTranslateParams(opts: {
  to?: string;
  lang?: string;
}): Promise<{ toNumber: string; sourceLang: string; targetLang: string }> {
  const { default: inquirer } = await import('inquirer');
  const { validateE164 } = await import('../_helpers.js');

  let sourceLang: string;
  let targetLang: string;

  if (opts.lang) {
    const parsed = parseLanguagePair(opts.lang);
    sourceLang = parsed.source;
    targetLang = parsed.target;
  } else {
    const langAns = await inquirer.prompt([
      {
        type: 'list',
        name: 'source',
        message: 'Your language:',
        choices: SUPPORTED_LANGUAGES,
      },
      {
        type: 'list',
        name: 'target',
        message: 'Target language:',
        choices: SUPPORTED_LANGUAGES,
      },
    ]);
    sourceLang = langAns.source;
    targetLang = langAns.target;
  }

  let toNumber = opts.to;
  if (!toNumber) {
    const ans = await inquirer.prompt([{
      type: 'input',
      name: 'to',
      message: 'Phone number to call (E.164):',
      validate: (v: string) => /^\+[1-9]\d{1,14}$/.test(v.trim()) || 'Invalid E.164 format',
    }]);
    toNumber = ans.to;
  }
  toNumber = validateE164(toNumber!);

  return { toNumber, sourceLang, targetLang };
}
