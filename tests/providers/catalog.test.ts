import { describe, it, expect } from 'vitest';
import {
  LLM_PROVIDERS,
  TTS_PROVIDERS,
  ASR_PROVIDERS,
  ASR_LANGUAGES,
} from '../../src/providers/catalog.js';

describe('LLM_PROVIDERS', () => {
  it('has 10 providers', () => {
    expect(LLM_PROVIDERS).toHaveLength(10);
  });

  it('each has name and value', () => {
    for (const p of LLM_PROVIDERS) {
      expect(p.name, `provider missing name`).toBeTruthy();
      expect(p.value, `${p.name} missing value`).toBeTruthy();
    }
  });

  it('providers with fixed URLs have non-empty url', () => {
    const noUrlRequired = new Set(['azure', 'bedrock', 'dify', 'custom']);
    for (const p of LLM_PROVIDERS) {
      if (!noUrlRequired.has(p.value)) {
        expect(p.url, `${p.value} missing url`).toBeTruthy();
      }
    }
  });

  it('includes dashscope (Alibaba Qwen)', () => {
    const qwen = LLM_PROVIDERS.find(p => p.value === 'dashscope');
    expect(qwen).toBeDefined();
    expect(qwen!.url).toContain('dashscope.aliyuncs.com');
    expect(qwen!.defaultModel).toBe('qwen-plus');
  });

  it('includes deepseek', () => {
    const ds = LLM_PROVIDERS.find(p => p.value === 'deepseek');
    expect(ds).toBeDefined();
    expect(ds!.url).toContain('deepseek.com');
  });

  it('anthropic has style and headers', () => {
    const claude = LLM_PROVIDERS.find(p => p.value === 'anthropic');
    expect(claude?.style).toBe('anthropic');
    expect(claude?.headers).toContain('anthropic-version');
  });

  it('gemini has style and urlHasKey', () => {
    const gemini = LLM_PROVIDERS.find(p => p.value === 'gemini');
    expect(gemini?.style).toBe('gemini');
    expect(gemini?.urlHasKey).toBe(true);
    expect(gemini?.url).toContain('{api_key}');
  });

  it('groq has free tier note', () => {
    const groq = LLM_PROVIDERS.find(p => p.value === 'groq');
    expect(groq).toBeDefined();
    expect(groq!.url).toContain('groq.com');
  });

  it('has unique values', () => {
    const values = LLM_PROVIDERS.map(p => p.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('TTS_PROVIDERS', () => {
  it('has 12 providers', () => {
    expect(TTS_PROVIDERS).toHaveLength(12);
  });

  it('each has name and vendor', () => {
    for (const p of TTS_PROVIDERS) {
      expect(p.name).toBeTruthy();
      expect(p.vendor).toBeTruthy();
    }
  });

  it('microsoft requires region', () => {
    const ms = TTS_PROVIDERS.find(p => p.vendor === 'microsoft');
    expect(ms?.requiresRegion).toBe(true);
    expect(ms?.defaultVoice).toBeTruthy();
  });

  it('elevenlabs does not require region', () => {
    const el = TTS_PROVIDERS.find(p => p.vendor === 'elevenlabs');
    expect(el?.requiresRegion).toBeFalsy();
  });

  it('all require key', () => {
    for (const p of TTS_PROVIDERS) {
      expect(p.requiresKey, `${p.vendor} should require key`).toBe(true);
    }
  });

  it('has beta providers', () => {
    const betas = TTS_PROVIDERS.filter(p => p.beta);
    expect(betas.length).toBeGreaterThan(0);
  });

  it('has unique vendors', () => {
    const vendors = TTS_PROVIDERS.map(p => p.vendor);
    expect(new Set(vendors).size).toBe(vendors.length);
  });
});

describe('ASR_PROVIDERS', () => {
  it('has 9 providers', () => {
    expect(ASR_PROVIDERS).toHaveLength(9);
  });

  it('ares does not require key', () => {
    const ares = ASR_PROVIDERS.find(p => p.vendor === 'ares');
    expect(ares?.requiresKey).toBe(false);
  });

  it('all others require key', () => {
    for (const p of ASR_PROVIDERS.filter(p => p.vendor !== 'ares')) {
      expect(p.requiresKey, `${p.vendor} should require key`).toBe(true);
    }
  });

  it('ares is first in the list (recommended)', () => {
    expect(ASR_PROVIDERS[0].vendor).toBe('ares');
  });

  it('has unique vendors', () => {
    const vendors = ASR_PROVIDERS.map(p => p.vendor);
    expect(new Set(vendors).size).toBe(vendors.length);
  });
});

describe('ASR_LANGUAGES', () => {
  it('has 24 languages', () => {
    expect(ASR_LANGUAGES).toHaveLength(24);
  });

  it('includes zh-CN and en-US', () => {
    expect(ASR_LANGUAGES.find(l => l.value === 'zh-CN')).toBeDefined();
    expect(ASR_LANGUAGES.find(l => l.value === 'en-US')).toBeDefined();
  });

  it('zh-CN is first (recommended for CN region)', () => {
    expect(ASR_LANGUAGES[0].value).toBe('zh-CN');
  });

  it('en-US is second', () => {
    expect(ASR_LANGUAGES[1].value).toBe('en-US');
  });

  it('has unique values', () => {
    const values = ASR_LANGUAGES.map(l => l.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('each has name and BCP-47 value', () => {
    for (const l of ASR_LANGUAGES) {
      expect(l.name).toBeTruthy();
      expect(l.value).toMatch(/^[a-z]{2,3}-[A-Z]{2}$/);
    }
  });
});
