import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), `convoai-tpl-ops-${Date.now()}`);

vi.mock('../../src/config/paths.js', () => ({
  getConfigDir: () => {
    mkdirSync(TEST_DIR, { recursive: true });
    return TEST_DIR;
  },
  getConfigPath: () => join(TEST_DIR, 'config.json'),
  getProjectConfigPath: () => join(process.cwd(), '.convoai.json'),
}));

const {
  saveTemplate,
  loadTemplate,
  listTemplates,
  deleteTemplate,
  templateExists,
} = await import('../../src/templates/manager.js');

describe('Template Operations - Deep', () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, 'templates'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('can save template with full agent properties', () => {
    saveTemplate({
      name: 'full-template',
      description: 'A fully configured template',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      properties: {
        channel: 'default-channel',
        agent_rtc_uid: 'Agent',
        remote_rtc_uids: ['*'],
        idle_timeout: 30,
        llm: {
          url: 'https://api.openai.com/v1/chat/completions',
          vendor: 'openai',
          model: 'gpt-4o',
          style: 'openai',
          system_messages: [{ role: 'system', content: 'You are helpful' }],
          greeting_message: 'Hello!',
          max_history: 20,
          params: { temperature: 0.7, max_tokens: 512 },
        },
        tts: {
          vendor: 'microsoft',
          params: { voice_name: 'en-US-AndrewMultilingualNeural' },
        },
        asr: {
          vendor: 'deepgram',
          language: 'en-US',
        },
        turn_detection: {
          type: 'agora_vad',
          interrupt_mode: 'interrupt',
          silence_duration_ms: 480,
        },
        advanced_features: {
          enable_aivad: false,
          enable_rtm: false,
        },
      },
    });

    const loaded = loadTemplate('full-template');
    expect(loaded).not.toBeNull();
    expect(loaded!.properties.llm?.model).toBe('gpt-4o');
    expect(loaded!.properties.tts?.vendor).toBe('microsoft');
    expect(loaded!.properties.asr?.language).toBe('en-US');
    expect(loaded!.properties.turn_detection?.type).toBe('agora_vad');
  });

  it('overwriting a template preserves the new data', () => {
    saveTemplate({
      name: 'overwrite-me',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      properties: { llm: { model: 'old-model' } },
    });

    saveTemplate({
      name: 'overwrite-me',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
      properties: { llm: { model: 'new-model' } },
    });

    const loaded = loadTemplate('overwrite-me');
    expect(loaded!.properties.llm?.model).toBe('new-model');
    expect(loaded!.updated_at).toBe('2024-01-02');
  });

  it('listing multiple templates returns sorted', () => {
    const names = ['charlie', 'alpha', 'bravo'];
    for (const name of names) {
      saveTemplate({
        name,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        properties: {},
      });
    }

    const list = listTemplates();
    expect(list.map((t) => t.name)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('delete removes only the target template', () => {
    saveTemplate({ name: 'keep', created_at: '', updated_at: '', properties: {} });
    saveTemplate({ name: 'remove', created_at: '', updated_at: '', properties: {} });

    expect(listTemplates()).toHaveLength(2);
    deleteTemplate('remove');
    expect(listTemplates()).toHaveLength(1);
    expect(templateExists('keep')).toBe(true);
    expect(templateExists('remove')).toBe(false);
  });

  it('template with empty properties', () => {
    saveTemplate({
      name: 'empty',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      properties: {},
    });

    const loaded = loadTemplate('empty');
    expect(loaded).not.toBeNull();
    expect(loaded!.properties).toEqual({});
  });

  it('template name with hyphens and underscores', () => {
    saveTemplate({
      name: 'my-cool_template-v2',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      properties: { llm: { model: 'test' } },
    });

    expect(templateExists('my-cool_template-v2')).toBe(true);
    const loaded = loadTemplate('my-cool_template-v2');
    expect(loaded!.name).toBe('my-cool_template-v2');
  });
});
