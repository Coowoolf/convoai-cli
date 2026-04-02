// Provider catalog — single source of truth for all supported providers.

// ---------------------------------------------------------------------------
// LLM Providers
// ---------------------------------------------------------------------------

export interface LLMProvider {
  name: string;
  value: string;
  url: string;
  defaultModel: string;
  models: string[];
  style?: 'anthropic' | 'gemini';
  headers?: string;
  urlHasKey?: boolean;
  note?: string;
}

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    name: 'Alibaba Qwen',
    value: 'dashscope',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-plus',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'],
    note: 'China-optimized, no proxy needed',
  },
  {
    name: 'DeepSeek',
    value: 'deepseek',
    url: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    note: 'China-optimized, great price-performance',
  },
  {
    name: 'OpenAI',
    value: 'openai',
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
    note: 'Requires proxy in China',
  },
  {
    name: 'Groq',
    value: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
    ],
    note: 'Fast inference, free tier available',
  },
  {
    name: 'Anthropic Claude',
    value: 'anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-5-haiku-latest',
    models: ['claude-3-5-haiku-latest', 'claude-sonnet-4-20250514'],
    style: 'anthropic',
    headers: '{"anthropic-version":"2023-06-01"}',
  },
  {
    name: 'Google Gemini',
    value: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    style: 'gemini',
    urlHasKey: true,
  },
  {
    name: 'Azure OpenAI',
    value: 'azure',
    url: '',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o'],
    note: 'Enter your Azure endpoint URL',
  },
  {
    name: 'Amazon Bedrock',
    value: 'bedrock',
    url: '',
    defaultModel: '',
    models: [],
    note: 'Enter your Bedrock endpoint URL',
  },
  {
    name: 'Dify',
    value: 'dify',
    url: '',
    defaultModel: '',
    models: [],
    note: 'Enter your Dify endpoint URL',
  },
  {
    name: 'Custom',
    value: 'custom',
    url: '',
    defaultModel: '',
    models: [],
    note: 'Any service with OpenAI-compatible API',
  },
];

// ---------------------------------------------------------------------------
// TTS Providers
// ---------------------------------------------------------------------------

export interface TTSProvider {
  name: string;
  vendor: string;
  requiresKey: boolean;
  requiresRegion?: boolean;
  requiresGroupId?: boolean;
  defaultVoice?: string;
  defaultParams?: Record<string, unknown>;
  beta?: boolean;
  note?: string;
}

export const TTS_PROVIDERS: TTSProvider[] = [
  {
    name: 'ElevenLabs',
    vendor: 'elevenlabs',
    requiresKey: true,
    note: 'High quality, multilingual',
  },
  {
    name: 'Microsoft Azure',
    vendor: 'microsoft',
    requiresKey: true,
    requiresRegion: true,
    defaultVoice: 'en-US-AndrewMultilingualNeural',
    note: 'Wide language support',
  },
  {
    name: 'MiniMax',
    vendor: 'minimax',
    requiresKey: true,
    requiresGroupId: true,
    note: 'Requires API Key + Group ID from minimax.chat',
    defaultParams: {
      model: 'speech-02-turbo',
      voice_setting: { voice_id: 'English_captivating_female1' },
      url: 'wss://api.minimaxi.com/ws/v1/t2a_v2',
    },
  },
  {
    name: 'OpenAI TTS',
    vendor: 'openai',
    requiresKey: true,
    beta: true,
  },
  {
    name: 'Cartesia',
    vendor: 'cartesia',
    requiresKey: true,
    beta: true,
  },
  {
    name: 'Hume AI',
    vendor: 'humeai',
    requiresKey: true,
    beta: true,
  },
  {
    name: 'Rime',
    vendor: 'rime',
    requiresKey: true,
    beta: true,
  },
  {
    name: 'Fish Audio',
    vendor: 'fishaudio',
    requiresKey: true,
    beta: true,
  },
  {
    name: 'Google TTS',
    vendor: 'google',
    requiresKey: true,
    beta: true,
  },
  {
    name: 'Amazon Polly',
    vendor: 'amazon',
    requiresKey: true,
    beta: true,
  },
  {
    name: 'Murf',
    vendor: 'murf',
    requiresKey: true,
    beta: true,
  },
  {
    name: 'Sarvam',
    vendor: 'sarvam',
    requiresKey: true,
    beta: true,
  },
];

// ---------------------------------------------------------------------------
// ASR Providers
// ---------------------------------------------------------------------------

export interface ASRProvider {
  name: string;
  vendor: string;
  requiresKey: boolean;
  beta?: boolean;
  note?: string;
}

export const ASR_PROVIDERS: ASRProvider[] = [
  {
    name: 'ARES',
    vendor: 'ares',
    requiresKey: false,
    note: 'Agora built-in, no extra API key needed',
  },
  {
    name: 'Microsoft Azure',
    vendor: 'microsoft',
    requiresKey: true,
  },
  {
    name: 'Deepgram',
    vendor: 'deepgram',
    requiresKey: true,
  },
  {
    name: 'OpenAI Whisper',
    vendor: 'openai',
    requiresKey: true,
    beta: true,
  },
  {
    name: 'Speechmatics',
    vendor: 'speechmatics',
    requiresKey: true,
  },
  {
    name: 'AssemblyAI',
    vendor: 'assemblyai',
    requiresKey: true,
    beta: true,
  },
  {
    name: 'Amazon Transcribe',
    vendor: 'amazon',
    requiresKey: true,
    beta: true,
  },
  {
    name: 'Google STT',
    vendor: 'google',
    requiresKey: true,
    beta: true,
  },
  {
    name: 'Sarvam',
    vendor: 'sarvam',
    requiresKey: true,
    beta: true,
  },
];

// ---------------------------------------------------------------------------
// ASR Languages (ARES supported)
// ---------------------------------------------------------------------------

export const ASR_LANGUAGES = [
  { name: 'Chinese (\u4e2d\u6587)', value: 'zh-CN' },
  { name: 'English (US)', value: 'en-US' },
  { name: 'Japanese (\u65e5\u672c\u8a9e)', value: 'ja-JP' },
  { name: 'Korean (\ud55c\uad6d\uc5b4)', value: 'ko-KR' },
  { name: 'French', value: 'fr-FR' },
  { name: 'German', value: 'de-DE' },
  { name: 'Spanish', value: 'es-ES' },
  { name: 'Russian', value: 'ru-RU' },
  { name: 'Hindi', value: 'hi-IN' },
  { name: 'Arabic', value: 'ar-SA' },
  { name: 'Portuguese', value: 'pt-PT' },
  { name: 'Italian', value: 'it-IT' },
  { name: 'Thai', value: 'th-TH' },
  { name: 'Turkish', value: 'tr-TR' },
  { name: 'Vietnamese', value: 'vi-VN' },
  { name: 'Indonesian', value: 'id-ID' },
  { name: 'Malay', value: 'ms-MY' },
  { name: 'Dutch', value: 'nl-NL' },
  { name: 'Filipino', value: 'fil-PH' },
  { name: 'Chinese (Hong Kong)', value: 'zh-HK' },
  { name: 'Chinese (Taiwan)', value: 'zh-TW' },
  { name: 'English (India)', value: 'en-IN' },
  { name: 'Persian', value: 'fa-IR' },
  { name: 'Hebrew', value: 'he-IL' },
] as const;
