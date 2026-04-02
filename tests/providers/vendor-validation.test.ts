import { describe, it, expect } from 'vitest';
import { LLM_PROVIDERS, TTS_PROVIDERS, ASR_PROVIDERS } from '../../src/providers/catalog.js';

/**
 * These tests validate that all vendor configurations match
 * the official Agora ConvoAI documentation and vendor APIs.
 * If a test fails, the vendor config is wrong and will break for users.
 */

describe('LLM Vendor URLs — verified against official docs', () => {
  it('DashScope URL is the China OpenAI-compatible endpoint', () => {
    const p = LLM_PROVIDERS.find(p => p.value === 'dashscope')!;
    expect(p.url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
  });

  it('DeepSeek URL is the official chat completions endpoint', () => {
    const p = LLM_PROVIDERS.find(p => p.value === 'deepseek')!;
    expect(p.url).toContain('api.deepseek.com');
    expect(p.url).toContain('chat/completions');
  });

  it('OpenAI URL is the standard endpoint', () => {
    const p = LLM_PROVIDERS.find(p => p.value === 'openai')!;
    expect(p.url).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('Groq URL uses the /openai/ path', () => {
    const p = LLM_PROVIDERS.find(p => p.value === 'groq')!;
    expect(p.url).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  it('Anthropic URL is /v1/messages (NOT /chat/completions)', () => {
    const p = LLM_PROVIDERS.find(p => p.value === 'anthropic')!;
    expect(p.url).toBe('https://api.anthropic.com/v1/messages');
    expect(p.style).toBe('anthropic');
    expect(p.headers).toContain('anthropic-version');
    expect(p.headers).toContain('2023-06-01');
  });

  it('Gemini URL uses streamGenerateContent with SSE and key in URL', () => {
    const p = LLM_PROVIDERS.find(p => p.value === 'gemini')!;
    expect(p.url).toContain('generativelanguage.googleapis.com');
    expect(p.url).toContain('streamGenerateContent');
    expect(p.url).toContain('alt=sse');
    expect(p.url).toContain('{api_key}');
    expect(p.url).toContain('{model}');
    expect(p.style).toBe('gemini');
    expect(p.urlHasKey).toBe(true);
  });

  it('Only Anthropic and Gemini have style set (custom LLMs must NOT)', () => {
    for (const p of LLM_PROVIDERS) {
      if (p.value === 'anthropic') {
        expect(p.style).toBe('anthropic');
      } else if (p.value === 'gemini') {
        expect(p.style).toBe('gemini');
      } else {
        expect(p.style, `${p.value} should NOT have style`).toBeUndefined();
      }
    }
  });

  it('Only Anthropic has headers set', () => {
    for (const p of LLM_PROVIDERS) {
      if (p.value === 'anthropic') {
        expect(p.headers).toBeTruthy();
      } else {
        expect(p.headers, `${p.value} should NOT have headers`).toBeUndefined();
      }
    }
  });
});

describe('TTS Vendor Configs — verified against Agora docs', () => {
  it('ElevenLabs has required defaultParams: base_url, model_id, voice_id', () => {
    const p = TTS_PROVIDERS.find(p => p.vendor === 'elevenlabs')!;
    expect(p.defaultParams).toBeDefined();
    expect(p.defaultParams!.base_url).toBe('wss://api.elevenlabs.io/v1');
    expect(p.defaultParams!.model_id).toBe('eleven_flash_v2_5');
    expect(p.defaultParams!.voice_id).toBeTruthy();
    expect(p.defaultParams!.sample_rate).toBe(24000);
  });

  it('Microsoft requires key + region + voice_name', () => {
    const p = TTS_PROVIDERS.find(p => p.vendor === 'microsoft')!;
    expect(p.requiresKey).toBe(true);
    expect(p.requiresRegion).toBe(true);
    expect(p.defaultVoice).toBe('en-US-AndrewMultilingualNeural');
  });

  it('MiniMax has required defaultParams: model, voice_setting, url', () => {
    const p = TTS_PROVIDERS.find(p => p.vendor === 'minimax')!;
    expect(p.requiresGroupId).toBe(true);
    expect(p.defaultParams).toBeDefined();
    expect(p.defaultParams!.model).toBe('speech-02-turbo');
    expect(p.defaultParams!.url).toContain('minimax');
    expect(p.defaultParams!.url).toContain('t2a_v2');
    const vs = p.defaultParams!.voice_setting as { voice_id: string };
    expect(vs.voice_id).toBeTruthy();
  });

  it('OpenAI TTS has required defaultParams: base_url, model, voice', () => {
    const p = TTS_PROVIDERS.find(p => p.vendor === 'openai')!;
    expect(p.defaultParams).toBeDefined();
    expect(p.defaultParams!.base_url).toBe('https://api.openai.com/v1');
    expect(p.defaultParams!.model).toBeTruthy();
    expect(p.defaultParams!.voice).toBeTruthy();
  });

  it('Cartesia has required defaultParams: model_id, voice', () => {
    const p = TTS_PROVIDERS.find(p => p.vendor === 'cartesia')!;
    expect(p.defaultParams).toBeDefined();
    expect(p.defaultParams!.model_id).toBe('sonic-2');
    const voice = p.defaultParams!.voice as { mode: string; id: string };
    expect(voice.mode).toBe('id');
    expect(voice.id).toBeTruthy();
  });

  it('All TTS providers require a key', () => {
    for (const p of TTS_PROVIDERS) {
      expect(p.requiresKey, `${p.vendor} should require key`).toBe(true);
    }
  });
});

describe('ASR Vendor Configs — verified against Agora docs', () => {
  it('ARES needs NO key, NO params', () => {
    const p = ASR_PROVIDERS.find(p => p.vendor === 'ares')!;
    expect(p.requiresKey).toBe(false);
    expect(p.defaultParams).toBeUndefined();
  });

  it('Deepgram has defaultParams with url and model', () => {
    const p = ASR_PROVIDERS.find(p => p.vendor === 'deepgram')!;
    expect(p.requiresKey).toBe(true);
    expect(p.defaultParams).toBeDefined();
    expect(p.defaultParams!.url).toBe('wss://api.deepgram.com/v1/listen');
    expect(p.defaultParams!.model).toBe('nova-3');
  });

  it('Microsoft ASR requires region', () => {
    const p = ASR_PROVIDERS.find(p => p.vendor === 'microsoft')!;
    expect(p.requiresKey).toBe(true);
    expect(p.requiresRegion).toBe(true);
    expect(p.defaultParams?.region).toBe('eastus');
  });
});

describe('Cross-vendor consistency', () => {
  it('No LLM provider has duplicate value', () => {
    const values = LLM_PROVIDERS.map(p => p.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('No TTS provider has duplicate vendor', () => {
    const vendors = TTS_PROVIDERS.map(p => p.vendor);
    expect(new Set(vendors).size).toBe(vendors.length);
  });

  it('No ASR provider has duplicate vendor', () => {
    const vendors = ASR_PROVIDERS.map(p => p.vendor);
    expect(new Set(vendors).size).toBe(vendors.length);
  });

  it('All LLM providers with fixed URLs use HTTPS', () => {
    for (const p of LLM_PROVIDERS) {
      if (p.url) {
        expect(p.url, `${p.value} URL must be HTTPS`).toMatch(/^https:\/\//);
      }
    }
  });

  it('All TTS WebSocket URLs use WSS (not WS)', () => {
    for (const p of TTS_PROVIDERS) {
      const url = p.defaultParams?.url as string | undefined;
      const baseUrl = p.defaultParams?.base_url as string | undefined;
      if (url && url.startsWith('ws')) {
        expect(url, `${p.vendor} must use WSS`).toMatch(/^wss:\/\//);
      }
      if (baseUrl && baseUrl.startsWith('ws')) {
        expect(baseUrl, `${p.vendor} must use WSS`).toMatch(/^wss:\/\//);
      }
    }
  });

  it('All ASR WebSocket URLs use WSS', () => {
    for (const p of ASR_PROVIDERS) {
      const url = p.defaultParams?.url as string | undefined;
      if (url && url.startsWith('ws')) {
        expect(url, `${p.vendor} must use WSS`).toMatch(/^wss:\/\//);
      }
    }
  });
});
