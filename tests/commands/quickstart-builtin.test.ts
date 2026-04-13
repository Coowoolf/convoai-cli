import { describe, it, expect } from 'vitest';
import { LLM_PROVIDERS, TTS_PROVIDERS, ASR_PROVIDERS } from '../../src/providers/catalog.js';

describe('quickstart built-in provider labels', () => {
  it('LLM choices include built-in label for Qwen', () => {
    const qwen = LLM_PROVIDERS.find(p => p.value === 'dashscope');
    expect(qwen).toBeDefined();
    expect(qwen!.builtin).toBe(true);
  });

  it('TTS choices include built-in label for MiniMax', () => {
    const minimax = TTS_PROVIDERS.find(p => p.vendor === 'minimax');
    expect(minimax).toBeDefined();
    expect(minimax!.builtin).toBe(true);
  });

  it('ASR choices include built-in label for ARES', () => {
    const ares = ASR_PROVIDERS.find(p => p.vendor === 'ares');
    expect(ares).toBeDefined();
    expect(ares!.builtin).toBe(true);
  });
});
