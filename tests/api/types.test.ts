import { describe, it, expect } from 'vitest';
import { AgentStatusCode, AgentStatusNumber } from '../../src/api/types.js';

describe('AgentStatusCode', () => {
  it('maps numeric codes to status strings', () => {
    expect(AgentStatusCode[0]).toBe('IDLE');
    expect(AgentStatusCode[1]).toBe('STARTING');
    expect(AgentStatusCode[2]).toBe('RUNNING');
    expect(AgentStatusCode[3]).toBe('STOPPING');
    expect(AgentStatusCode[4]).toBe('STOPPED');
    expect(AgentStatusCode[5]).toBe('RECOVERING');
    expect(AgentStatusCode[6]).toBe('FAILED');
  });

  it('covers all 7 statuses', () => {
    expect(Object.keys(AgentStatusCode)).toHaveLength(7);
  });
});

describe('AgentStatusNumber', () => {
  it('maps status strings to numeric codes', () => {
    expect(AgentStatusNumber.IDLE).toBe(0);
    expect(AgentStatusNumber.STARTING).toBe(1);
    expect(AgentStatusNumber.RUNNING).toBe(2);
    expect(AgentStatusNumber.STOPPING).toBe(3);
    expect(AgentStatusNumber.STOPPED).toBe(4);
    expect(AgentStatusNumber.RECOVERING).toBe(5);
    expect(AgentStatusNumber.FAILED).toBe(6);
  });

  it('is the inverse of AgentStatusCode', () => {
    for (const [code, status] of Object.entries(AgentStatusCode)) {
      expect(AgentStatusNumber[status as keyof typeof AgentStatusNumber]).toBe(Number(code));
    }
  });
});
