import type { AgentProperties } from '../api/types.js';

// ─── Preset Metadata ────────────────────────────────────────────────────────

interface PresetInfo {
  description: string;
  llm: string;
  tts: string;
  asr: string;
  properties: Partial<AgentProperties>;
}

// ─── Built-In Presets ───────────────────────────────────────────────────────

export const PRESETS: Record<string, PresetInfo> = {
  'openai-gpt4o': {
    description: 'OpenAI GPT-4o with Microsoft TTS and Deepgram ASR',
    llm: 'OpenAI GPT-4o',
    tts: 'Microsoft TTS',
    asr: 'Deepgram',
    properties: {
      llm: {
        vendor: 'openai',
        model: 'gpt-4o',
        style: 'openai',
        system_messages: [
          {
            role: 'system',
            content: 'You are a helpful voice assistant. Keep responses concise and conversational.',
          },
        ],
        max_history: 20,
        params: {
          temperature: 0.7,
          max_tokens: 512,
        },
      },
      tts: {
        vendor: 'microsoft',
        params: {
          voice_name: 'en-US-AndrewMultilingualNeural',
          speed: 1.0,
        },
      },
      asr: {
        vendor: 'deepgram',
        language: 'en-US',
        params: {
          model: 'nova-2',
        },
      },
    },
  },

  'openai-mini': {
    description: 'OpenAI GPT-4o-mini with Microsoft TTS and Deepgram ASR',
    llm: 'OpenAI GPT-4o-mini',
    tts: 'Microsoft TTS',
    asr: 'Deepgram',
    properties: {
      llm: {
        vendor: 'openai',
        model: 'gpt-4o-mini',
        style: 'openai',
        system_messages: [
          {
            role: 'system',
            content: 'You are a helpful voice assistant. Keep responses concise and conversational.',
          },
        ],
        max_history: 20,
        params: {
          temperature: 0.7,
          max_tokens: 512,
        },
      },
      tts: {
        vendor: 'microsoft',
        params: {
          voice_name: 'en-US-AndrewMultilingualNeural',
          speed: 1.0,
        },
      },
      asr: {
        vendor: 'deepgram',
        language: 'en-US',
        params: {
          model: 'nova-2',
        },
      },
    },
  },

  'anthropic-claude': {
    description: 'Anthropic Claude with Microsoft TTS and Deepgram ASR',
    llm: 'Anthropic Claude',
    tts: 'Microsoft TTS',
    asr: 'Deepgram',
    properties: {
      llm: {
        vendor: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        style: 'anthropic',
        system_messages: [
          {
            role: 'system',
            content: 'You are a helpful voice assistant. Keep responses concise and conversational.',
          },
        ],
        max_history: 20,
        params: {
          temperature: 0.7,
          max_tokens: 512,
        },
      },
      tts: {
        vendor: 'microsoft',
        params: {
          voice_name: 'en-US-AndrewMultilingualNeural',
          speed: 1.0,
        },
      },
      asr: {
        vendor: 'deepgram',
        language: 'en-US',
        params: {
          model: 'nova-2',
        },
      },
    },
  },

  gemini: {
    description: 'Google Gemini with Microsoft TTS and Deepgram ASR',
    llm: 'Google Gemini',
    tts: 'Microsoft TTS',
    asr: 'Deepgram',
    properties: {
      llm: {
        vendor: 'google',
        model: 'gemini-2.0-flash',
        style: 'gemini',
        system_messages: [
          {
            role: 'system',
            content: 'You are a helpful voice assistant. Keep responses concise and conversational.',
          },
        ],
        max_history: 20,
        params: {
          temperature: 0.7,
          max_tokens: 512,
        },
      },
      tts: {
        vendor: 'microsoft',
        params: {
          voice_name: 'en-US-AndrewMultilingualNeural',
          speed: 1.0,
        },
      },
      asr: {
        vendor: 'deepgram',
        language: 'en-US',
        params: {
          model: 'nova-2',
        },
      },
    },
  },

  'realtime-openai': {
    description: 'OpenAI Realtime API (multimodal LLM mode)',
    llm: 'OpenAI Realtime',
    tts: 'Built-in (MLLM)',
    asr: 'Built-in (MLLM)',
    properties: {
      llm: {
        vendor: 'openai',
        model: 'gpt-4o-realtime-preview',
        style: 'openai',
        input_modalities: ['text', 'audio'],
        output_modalities: ['text', 'audio'],
        system_messages: [
          {
            role: 'system',
            content: 'You are a helpful voice assistant. Keep responses concise and conversational.',
          },
        ],
      },
      advanced_features: {
        enable_mllm: true,
      },
    },
  },
};

// ─── Public Helpers ─────────────────────────────────────────────────────────

/** Look up a preset by name. Returns undefined if not found. */
export function getPreset(name: string): Partial<AgentProperties> | undefined {
  return PRESETS[name]?.properties;
}

/** List all available presets with their metadata. */
export function listPresets(): Array<{
  name: string;
  description: string;
  llm: string;
  tts: string;
  asr: string;
}> {
  return Object.entries(PRESETS).map(([name, info]) => ({
    name,
    description: info.description,
    llm: info.llm,
    tts: info.tts,
    asr: info.asr,
  }));
}
