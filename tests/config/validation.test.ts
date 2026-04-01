import { describe, it, expect } from 'vitest';
import { validateConfig } from '../../src/config/schema.js';

describe('Config Validation - Stress Tests', () => {
  it('rejects non-object input', () => {
    expect(() => validateConfig('string')).toThrow();
    expect(() => validateConfig(42)).toThrow();
    expect(() => validateConfig(null)).toThrow();
    expect(() => validateConfig(true)).toThrow();
  });

  it('accepts array as undefined', () => {
    // Arrays are objects but should fail zod parsing
    expect(() => validateConfig([])).toThrow();
  });

  it('accepts config with only app_id', () => {
    const result = validateConfig({ app_id: 'only-app' });
    expect(result.app_id).toBe('only-app');
    expect(result.customer_id).toBeUndefined();
  });

  it('accepts config with empty profiles', () => {
    const result = validateConfig({ profiles: {} });
    expect(result.profiles).toEqual({});
  });

  it('validates profile LLM with all valid styles', () => {
    const styles = ['openai', 'gemini', 'anthropic', 'dify'] as const;
    for (const style of styles) {
      const config = {
        profiles: { test: { llm: { style } } },
      };
      expect(() => validateConfig(config)).not.toThrow();
    }
  });

  it('rejects profile LLM with invalid style', () => {
    expect(() =>
      validateConfig({
        profiles: { test: { llm: { style: 'grok' } } },
      }),
    ).toThrow();
  });

  it('accepts profile with full ASR config', () => {
    const config = {
      profiles: {
        test: {
          asr: {
            language: 'en-US',
            vendor: 'deepgram',
            params: { model: 'nova-2' },
          },
        },
      },
    };
    const result = validateConfig(config);
    expect(result.profiles?.test?.asr?.language).toBe('en-US');
  });

  it('accepts profile with TTS params as record', () => {
    const config = {
      profiles: {
        test: {
          tts: {
            vendor: 'microsoft',
            params: {
              voice_name: 'en-US-Andrew',
              speed: 1.0,
              custom_param: 'value',
            },
          },
        },
      },
    };
    const result = validateConfig(config);
    expect(result.profiles?.test?.tts?.vendor).toBe('microsoft');
  });

  it('accepts config with both regions', () => {
    expect(() => validateConfig({ region: 'global' })).not.toThrow();
    expect(() => validateConfig({ region: 'cn' })).not.toThrow();
  });

  it('accepts config with multiple profiles', () => {
    const config = {
      profiles: {
        dev: { app_id: 'dev' },
        staging: { app_id: 'staging', region: 'cn' as const },
        prod: { app_id: 'prod', region: 'global' as const },
      },
    };
    const result = validateConfig(config);
    expect(Object.keys(result.profiles!)).toHaveLength(3);
  });

  it('accepts LLM with system_messages array', () => {
    const config = {
      profiles: {
        test: {
          llm: {
            system_messages: [
              { role: 'system', content: 'You are a bot.' },
              { role: 'user', content: 'Hello' },
            ],
          },
        },
      },
    };
    const result = validateConfig(config);
    expect(result.profiles?.test?.llm?.system_messages).toHaveLength(2);
  });

  it('rejects system_messages with wrong shape', () => {
    expect(() =>
      validateConfig({
        profiles: {
          test: {
            llm: { system_messages: [{ wrong: 'shape' }] },
          },
        },
      }),
    ).toThrow();
  });

  it('accepts LLM params as record', () => {
    const config = {
      profiles: {
        test: {
          llm: {
            params: {
              temperature: 0.7,
              max_tokens: 512,
              top_p: 0.9,
              custom: 'value',
            },
          },
        },
      },
    };
    const result = validateConfig(config);
    expect(result.profiles?.test?.llm?.params?.temperature).toBe(0.7);
  });
});
