import { describe, it, expect } from 'vitest';
import { getStrings } from '../../src/ui/i18n.js';

describe('getStrings', () => {
  it('returns Chinese strings for "cn"', () => {
    const s = getStrings('cn');
    expect(s.step1.title).toBe('配置凭证');
    expect(s.step1.emoji).toBe('🔑');
  });

  it('returns English strings for "global"', () => {
    const s = getStrings('global');
    expect(s.step1.title).toBe('Credentials');
    expect(s.step1.emoji).toBe('🔑');
  });

  it('cn and global have the same top-level keys', () => {
    const cn = getStrings('cn');
    const en = getStrings('global');
    expect(Object.keys(cn).sort()).toEqual(Object.keys(en).sort());
  });

  it('all steps have title, subtitle, emoji', () => {
    for (const lang of ['cn', 'global'] as const) {
      const s = getStrings(lang);
      for (const step of [s.step1, s.step2, s.step3, s.step4, s.step5, s.step6]) {
        expect(step.title).toBeTruthy();
        expect(step.emoji).toBeTruthy();
      }
    }
  });

  it('cn step1 has detailed body with 4 steps', () => {
    const s = getStrings('cn');
    expect(s.step1.body).toBeDefined();
    expect(s.step1.body!.length).toBeGreaterThan(10);
    expect(s.step1.body!.join('')).toContain('①');
    expect(s.step1.body!.join('')).toContain('④');
  });

  it('en step1 has minimal body', () => {
    const s = getStrings('global');
    expect(s.step1.body).toBeDefined();
    expect(s.step1.body!.length).toBeLessThan(10);
    expect(s.step1.body!.join('')).toContain('console.agora.io');
  });

  it('cn step3 subtitle is "选择 Agent 的大脑"', () => {
    const s = getStrings('cn');
    expect(s.step3.subtitle).toBe('选择 Agent 的大脑');
  });

  it('en step3 subtitle is "Choose Agent\'s brain"', () => {
    const s = getStrings('global');
    expect(s.step3.subtitle).toBe("Choose Agent's brain");
  });

  it('cn LLM provider ordering note', () => {
    const s = getStrings('cn');
    expect(s.llmProvider).toBe('大模型服务商');
  });

  it('all string values are non-empty', () => {
    for (const lang of ['cn', 'global'] as const) {
      const s = getStrings(lang);
      for (const [key, val] of Object.entries(s)) {
        if (typeof val === 'string') {
          expect(val.length, `${lang}.${key} is empty`).toBeGreaterThan(0);
        }
      }
    }
  });
});
