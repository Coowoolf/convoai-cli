import { describe, it, expect, vi } from 'vitest';

describe('buildChannelName', () => {
  it('returns a string starting with call-', async () => {
    const { buildChannelName } = await import('../../src/commands/phone/_helpers.js');
    const name = buildChannelName();
    expect(name).toMatch(/^call-[a-z0-9]+$/);
  });

  it('returns unique names on each call', async () => {
    const { buildChannelName } = await import('../../src/commands/phone/_helpers.js');
    const a = buildChannelName();
    const b = buildChannelName();
    expect(a).not.toBe(b);
  });
});

describe('buildCallRequest', () => {
  it('constructs a valid SendCallRequest', async () => {
    const { buildCallRequest } = await import('../../src/commands/phone/_helpers.js');
    const req = buildCallRequest({
      fromNumber: '+15551234567',
      toNumber: '+81312345678',
      channelName: 'call-test123',
      agentToken: 'agent-token-xxx',
      sipToken: 'sip-token-xxx',
      llm: { vendor: 'openai', system_messages: [{ role: 'system', content: 'Hello' }] },
      tts: { vendor: 'microsoft' },
      asr: { vendor: 'deepgram' },
      idleTimeout: 600,
    });

    expect(req.sip.from_number).toBe('+15551234567');
    expect(req.sip.to_number).toBe('+81312345678');
    expect(req.sip.rtc_uid).toBe('1');
    expect(req.sip.rtc_token).toBe('sip-token-xxx');
    expect(req.properties.channel).toBe('call-test123');
    expect(req.properties.token).toBe('agent-token-xxx');
    expect(req.properties.agent_rtc_uid).toBe('0');
    expect(req.properties.remote_rtc_uids).toEqual(['1']);
    expect(req.properties.idle_timeout).toBe(600);
    expect(req.properties.llm).toEqual({ vendor: 'openai', system_messages: [{ role: 'system', content: 'Hello' }] });
  });
});

describe('buildTTSConfig', () => {
  it('returns base TTS when no voice profile', async () => {
    const { buildTTSConfig } = await import('../../src/commands/phone/_helpers.js');
    const tts = buildTTSConfig({ vendor: 'microsoft', params: { voice_name: 'en-US-Jenny' } });
    expect(tts.vendor).toBe('microsoft');
    expect(tts.params?.voice_name).toBe('en-US-Jenny');
  });

  it('overrides voice when voice profile provided', async () => {
    const { buildTTSConfig } = await import('../../src/commands/phone/_helpers.js');
    const tts = buildTTSConfig(
      { vendor: 'microsoft', params: { voice_name: 'en-US-Jenny' } },
      { provider: 'elevenlabs', voice_id: 'custom-voice-123' },
    );
    expect(tts.params?.voice).toBe('custom-voice-123');
  });
});
