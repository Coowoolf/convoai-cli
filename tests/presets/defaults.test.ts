import { describe, it, expect } from 'vitest';
import { PRESETS, getPreset, listPresets } from '../../src/presets/defaults.js';

describe('PRESETS', () => {
  it('contains 5 built-in presets', () => {
    expect(Object.keys(PRESETS)).toHaveLength(5);
  });

  it('has all expected preset names', () => {
    const names = Object.keys(PRESETS);
    expect(names).toContain('openai-gpt4o');
    expect(names).toContain('openai-mini');
    expect(names).toContain('anthropic-claude');
    expect(names).toContain('gemini');
    expect(names).toContain('realtime-openai');
  });

  it('each preset has description, llm, tts, asr, and properties', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      expect(preset.description, `${name} missing description`).toBeTruthy();
      expect(preset.llm, `${name} missing llm`).toBeTruthy();
      expect(preset.tts, `${name} missing tts`).toBeTruthy();
      expect(preset.asr, `${name} missing asr`).toBeTruthy();
      expect(preset.properties, `${name} missing properties`).toBeTruthy();
    }
  });

  it('openai-gpt4o uses gpt-4o model', () => {
    expect(PRESETS['openai-gpt4o'].properties.llm?.model).toBe('gpt-4o');
  });

  it('openai-mini uses gpt-4o-mini model', () => {
    expect(PRESETS['openai-mini'].properties.llm?.model).toBe('gpt-4o-mini');
  });

  it('anthropic-claude uses anthropic vendor', () => {
    expect(PRESETS['anthropic-claude'].properties.llm?.vendor).toBe('anthropic');
  });

  it('gemini uses google vendor', () => {
    expect(PRESETS['gemini'].properties.llm?.vendor).toBe('google');
  });

  it('realtime-openai enables MLLM', () => {
    expect(PRESETS['realtime-openai'].properties.advanced_features?.enable_mllm).toBe(true);
  });
});

describe('getPreset', () => {
  it('returns properties for known preset', () => {
    const props = getPreset('openai-gpt4o');
    expect(props).toBeDefined();
    expect(props?.llm?.model).toBe('gpt-4o');
  });

  it('returns undefined for unknown preset', () => {
    const props = getPreset('nonexistent');
    expect(props).toBeUndefined();
  });
});

describe('listPresets', () => {
  it('returns array with all 5 presets', () => {
    const list = listPresets();
    expect(list).toHaveLength(5);
  });

  it('each item has name, description, llm, tts, asr fields', () => {
    const list = listPresets();
    for (const item of list) {
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.llm).toBeTruthy();
      expect(item.tts).toBeTruthy();
      expect(item.asr).toBeTruthy();
    }
  });

  it('includes openai-gpt4o in the list', () => {
    const list = listPresets();
    const found = list.find((p) => p.name === 'openai-gpt4o');
    expect(found).toBeDefined();
    expect(found?.llm).toContain('GPT-4o');
  });
});
