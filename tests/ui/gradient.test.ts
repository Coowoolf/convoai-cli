import { describe, it, expect } from 'vitest';
import { gradientBox, gradientTitle, gradientProgress, gradientBoxGreen } from '../../src/ui/gradient.js';

describe('gradientBox', () => {
  it('returns an array of strings', () => {
    const lines = gradientBox({ title: 'Test', subtitle: 'Sub', emoji: '🔑' });
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(3);
  });

  it('contains the title text', () => {
    const lines = gradientBox({ title: '配置凭证', subtitle: '说明', emoji: '🔑' });
    const joined = lines.join('');
    // Each title character is individually gradient-colored, so they won't be
    // adjacent in the raw string. Verify each character is present.
    for (const ch of '配置凭证') {
      expect(joined).toContain(ch);
    }
  });

  it('contains the subtitle text', () => {
    const lines = gradientBox({ title: 'T', subtitle: 'My subtitle', emoji: '🔑' });
    expect(lines.join('')).toContain('My subtitle');
  });

  it('supports extra body lines', () => {
    const lines = gradientBox({ title: 'T', subtitle: 'S', emoji: '🔑', body: ['line1', 'line2'] });
    const joined = lines.join('');
    expect(joined).toContain('line1');
    expect(joined).toContain('line2');
  });

  it('has top border with ╭ and ╮', () => {
    const lines = gradientBox({ title: 'T', subtitle: 'S', emoji: '🔑' });
    expect(lines[0]).toContain('╭');
    expect(lines[0]).toContain('╮');
  });

  it('has bottom border with ╰ and ╯', () => {
    const lines = gradientBox({ title: 'T', subtitle: 'S', emoji: '🔑' });
    const last = lines[lines.length - 1];
    expect(last).toContain('╰');
    expect(last).toContain('╯');
  });
});

describe('gradientBoxGreen', () => {
  it('returns an array of strings', () => {
    const lines = gradientBoxGreen({ title: 'Done', subtitle: 'Complete', emoji: '✅' });
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(3);
  });

  it('contains green color codes', () => {
    const lines = gradientBoxGreen({ title: 'Done', subtitle: 'Complete', emoji: '✅' });
    // Green is rgb(16,185,129). Chalk truecolor emits ANSI "38;2;16;185;129".
    expect(lines.join('')).toContain('16;185;129');
  });
});

describe('gradientTitle', () => {
  it('returns a string containing the text characters', () => {
    const result = gradientTitle('Hello');
    expect(result).toContain('H');
    expect(result).toContain('o');
  });

  it('works with Chinese characters', () => {
    const result = gradientTitle('配置凭证');
    expect(result).toContain('配');
    expect(result).toContain('证');
  });
});

describe('gradientProgress', () => {
  it('returns a string for step 1/6', () => {
    const result = gradientProgress(1, 6);
    expect(result).toContain('1/6');
  });

  it('returns a string for step 6/6', () => {
    const result = gradientProgress(6, 6);
    expect(result).toContain('6/6');
  });

  it('progress bar grows with steps', () => {
    const p1 = gradientProgress(1, 6);
    const p3 = gradientProgress(3, 6);
    // p3 should have more colored blocks than p1
    // We can check by counting background color escape sequences
    const countBg = (s: string) => (s.match(/\[48;/g) || []).length;
    expect(countBg(p3)).toBeGreaterThan(countBg(p1));
  });
});
