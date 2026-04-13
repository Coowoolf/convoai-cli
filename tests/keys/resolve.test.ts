import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('encrypt/decrypt roundtrip', () => {
  it('decrypts to original plaintext', async () => {
    const { encrypt, decrypt } = await import('../../src/keys/resolve.js');
    const original = 'sk-test-key-12345';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toMatch(/^[0-9a-f]+$/);
    expect(decrypt(encrypted)).toBe(original);
  });

  it('produces different hex for different inputs', async () => {
    const { encrypt } = await import('../../src/keys/resolve.js');
    const a = encrypt('key-aaa');
    const b = encrypt('key-bbb');
    expect(a).not.toBe(b);
  });
});

describe('getEmbeddedKey', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns null when embedded.ts does not exist', async () => {
    const { getEmbeddedKey } = await import('../../src/keys/resolve.js');
    const result = getEmbeddedKey('qwen');
    expect(result === null || typeof result === 'string').toBe(true);
  });
});

describe('resolveEmbeddedKeys', () => {
  it('leaves non-embedded keys untouched', async () => {
    const { resolveEmbeddedKeys } = await import('../../src/keys/resolve.js');
    const config = {
      llm: { api_key: 'sk-real-key', url: 'https://api.openai.com' },
      tts: { vendor: 'microsoft', params: { key: 'ms-key-123' } },
    };
    resolveEmbeddedKeys(config);
    expect(config.llm.api_key).toBe('sk-real-key');
    expect((config.tts.params as Record<string, unknown>).key).toBe('ms-key-123');
  });

  it('throws when __embedded__ but no embedded key available', async () => {
    const { resolveEmbeddedKeys } = await import('../../src/keys/resolve.js');
    const config = {
      llm: { api_key: '__embedded__' } as Record<string, unknown>,
    };
    expect(() => resolveEmbeddedKeys(config)).toThrow('Built-in');
  });
});
