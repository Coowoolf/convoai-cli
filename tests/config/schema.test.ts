import { describe, it, expect } from 'vitest';
import { validateConfig, ConvoAIConfigSchema, ProfileConfigSchema } from '../../src/config/schema.js';

describe('validateConfig', () => {
  it('validates an empty object', () => {
    const result = validateConfig({});
    expect(result).toEqual({});
  });

  it('validates a minimal config', () => {
    const result = validateConfig({
      app_id: 'test-app',
      customer_id: 'cid',
      customer_secret: 'csecret',
    });

    expect(result.app_id).toBe('test-app');
    expect(result.customer_id).toBe('cid');
    expect(result.customer_secret).toBe('csecret');
  });

  it('validates a full config with profiles', () => {
    const config = {
      app_id: 'app',
      customer_id: 'cid',
      customer_secret: 'cs',
      region: 'global' as const,
      default_profile: 'dev',
      profiles: {
        dev: {
          app_id: 'dev-app',
          llm: { model: 'gpt-4o-mini', vendor: 'openai' },
        },
        prod: {
          app_id: 'prod-app',
          region: 'cn' as const,
        },
      },
    };

    const result = validateConfig(config);
    expect(result.profiles?.dev?.app_id).toBe('dev-app');
    expect(result.profiles?.prod?.region).toBe('cn');
  });

  it('validates region enum values', () => {
    expect(() => validateConfig({ region: 'global' })).not.toThrow();
    expect(() => validateConfig({ region: 'cn' })).not.toThrow();
    expect(() => validateConfig({ region: 'invalid' })).toThrow();
  });

  it('validates LLM style enum', () => {
    const config = {
      profiles: {
        test: {
          llm: { style: 'openai' as const },
        },
      },
    };
    expect(() => validateConfig(config)).not.toThrow();

    const invalid = {
      profiles: {
        test: {
          llm: { style: 'invalid' },
        },
      },
    };
    expect(() => validateConfig(invalid)).toThrow();
  });

  it('allows unknown fields in nested objects (passthrough)', () => {
    const config = {
      profiles: {
        test: {
          llm: { vendor: 'openai', unknown_field: 'extra' },
        },
      },
    };
    expect(() => validateConfig(config)).not.toThrow();
  });
});

describe('voice_profile config', () => {
  it('accepts config with voice_profile', () => {
    const result = validateConfig({
      app_id: 'test',
      voice_profile: {
        provider: 'elevenlabs',
        voice_id: 'abc123',
      },
    });
    expect(result.voice_profile).toEqual({ provider: 'elevenlabs', voice_id: 'abc123' });
  });

  it('accepts config without voice_profile', () => {
    const result = validateConfig({ app_id: 'test' });
    expect(result.voice_profile).toBeUndefined();
  });
});

describe('ProfileConfigSchema', () => {
  it('accepts valid profile with all optional fields', () => {
    const profile = {
      app_id: 'app',
      customer_id: 'cid',
      customer_secret: 'cs',
      base_url: 'https://custom.com',
      region: 'cn' as const,
      llm: { vendor: 'openai', model: 'gpt-4o' },
      tts: { vendor: 'microsoft' },
      asr: { language: 'en-US', vendor: 'deepgram' },
    };

    const result = ProfileConfigSchema.parse(profile);
    expect(result.app_id).toBe('app');
    expect(result.llm?.vendor).toBe('openai');
  });

  it('accepts an empty profile', () => {
    const result = ProfileConfigSchema.parse({});
    expect(result).toEqual({});
  });
});
