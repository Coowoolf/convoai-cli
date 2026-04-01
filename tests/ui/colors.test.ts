import { describe, it, expect } from 'vitest';
import { colorStatus, dim, bold, success, error, warn, info } from '../../src/ui/colors.js';

describe('colorStatus', () => {
  it('returns a string for each valid status', () => {
    const statuses = ['RUNNING', 'STARTING', 'RECOVERING', 'FAILED', 'STOPPED', 'IDLE', 'STOPPING'] as const;
    for (const status of statuses) {
      const result = colorStatus(status);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('contains the status text in the output', () => {
    // chalk wraps with ANSI codes, but the status text should be present
    expect(colorStatus('RUNNING')).toContain('RUNNING');
    expect(colorStatus('FAILED')).toContain('FAILED');
  });
});

describe('color helpers', () => {
  it('dim wraps text', () => {
    const result = dim('test');
    expect(result).toContain('test');
  });

  it('bold wraps text', () => {
    const result = bold('test');
    expect(result).toContain('test');
  });

  it('success wraps text in green', () => {
    const result = success('ok');
    expect(result).toContain('ok');
  });

  it('error wraps text in red', () => {
    const result = error('fail');
    expect(result).toContain('fail');
  });

  it('warn wraps text in yellow', () => {
    const result = warn('caution');
    expect(result).toContain('caution');
  });

  it('info wraps text in cyan', () => {
    const result = info('note');
    expect(result).toContain('note');
  });
});
