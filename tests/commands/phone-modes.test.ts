import { describe, it, expect } from 'vitest';

describe('free mode: buildFreeCallConfig', () => {
  it('builds config from explicit params', async () => {
    const { buildFreeCallConfig } = await import('../../src/commands/phone/_modes/free.js');
    const config = buildFreeCallConfig({
      toNumber: '+15551234567',
      fromNumber: '+14151234567',
      task: 'Help navigate the phone menu',
      llm: { vendor: 'openai' },
      tts: { vendor: 'microsoft' },
      asr: { vendor: 'deepgram', language: 'en-US' },
    });

    expect(config.toNumber).toBe('+15551234567');
    expect(config.fromNumber).toBe('+14151234567');
    expect(config.llm.system_messages[0].content).toContain('Help navigate the phone menu');
    expect(config.tts).toEqual({ vendor: 'microsoft' });
    expect(config.asr).toEqual({ vendor: 'deepgram', language: 'en-US' });
    expect(config.mode).toBe('free');
  });

  it('uses default system message when no task provided', async () => {
    const { buildFreeCallConfig } = await import('../../src/commands/phone/_modes/free.js');
    const config = buildFreeCallConfig({
      toNumber: '+15551234567',
      fromNumber: '+14151234567',
      llm: { vendor: 'openai' },
      tts: { vendor: 'microsoft' },
      asr: { vendor: 'deepgram' },
    });

    expect(config.llm.system_messages[0].content).toContain('voice assistant');
  });
});

describe('translate mode: buildTranslateCallConfig', () => {
  it('builds config with language pair', async () => {
    const { buildTranslateCallConfig } = await import('../../src/commands/phone/_modes/translate.js');
    const config = buildTranslateCallConfig({
      toNumber: '+81312345678',
      fromNumber: '+15551234567',
      sourceLang: 'zh',
      targetLang: 'ja',
      llm: { vendor: 'openai' },
      tts: { vendor: 'microsoft' },
      asr: { vendor: 'deepgram' },
    });

    expect(config.mode).toBe('translate');
    expect(config.llm.system_messages[0].content).toContain('zh');
    expect(config.llm.system_messages[0].content).toContain('ja');
    expect(config.label).toContain('zh → ja');
  });
});

describe('parseLanguagePair', () => {
  it('parses "zh:ja" into source and target', async () => {
    const { parseLanguagePair } = await import('../../src/commands/phone/_modes/translate.js');
    const { source, target } = parseLanguagePair('zh:ja');
    expect(source).toBe('zh');
    expect(target).toBe('ja');
  });

  it('throws on invalid format', async () => {
    const { parseLanguagePair } = await import('../../src/commands/phone/_modes/translate.js');
    expect(() => parseLanguagePair('zh')).toThrow();
    expect(() => parseLanguagePair('')).toThrow();
  });
});
