import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SALT = createHash('sha256').update('convoai-embedded-v1').digest();

/** XOR encrypt a plaintext string → hex. Exported for embed script and tests. */
export function encrypt(plaintext: string): string {
  const data = Buffer.from(plaintext);
  const encrypted = Buffer.from(data.map((b, i) => b ^ SALT[i % SALT.length]));
  return encrypted.toString('hex');
}

/** XOR decrypt a hex string → plaintext. */
export function decrypt(hex: string): string {
  const data = Buffer.from(hex, 'hex');
  return Buffer.from(data.map((b, i) => b ^ SALT[i % SALT.length])).toString();
}

/**
 * Get a built-in API key by provider name.
 * Returns null if embedded keys file doesn't exist (dev environment).
 */
export function getEmbeddedKey(provider: 'qwen' | 'minimax'): string | null {
  try {
    const { EMBEDDED_KEYS } = require('./embedded.js');
    const hex = EMBEDDED_KEYS?.[provider];
    if (!hex) return null;
    return decrypt(hex);
  } catch {
    return null;
  }
}

/**
 * Resolve __embedded__ placeholders in LLM/TTS config with real keys.
 * Call this before sending API requests.
 */
export function resolveEmbeddedKeys(config: {
  llm?: Record<string, unknown>;
  tts?: Record<string, unknown>;
}): void {
  if (config.llm?.api_key === '__embedded__') {
    const key = getEmbeddedKey('qwen');
    if (key) {
      config.llm.api_key = key;
    } else {
      throw new Error(
        'Built-in Qwen key not available. Run "convoai quickstart" to configure your own API key.',
      );
    }
  }

  const ttsParams = config.tts?.params as Record<string, unknown> | undefined;
  if (ttsParams?.key === '__embedded__') {
    const key = getEmbeddedKey('minimax');
    if (key) {
      ttsParams.key = key;
    } else {
      throw new Error(
        'Built-in MiniMax key not available. Run "convoai quickstart" to configure your own API key.',
      );
    }
  }
}
