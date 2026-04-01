import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallAPI } from '../../src/api/calls.js';

function createMockClient() {
  return {
    get: vi.fn(),
    post: vi.fn(),
  };
}

describe('CallAPI', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let api: CallAPI;

  beforeEach(() => {
    mockClient = createMockClient();
    api = new CallAPI(mockClient as any);
  });

  describe('initiate', () => {
    it('sends POST to /call with request body', async () => {
      const mockResponse = { agent_id: 'call-123', status: 'RUNNING' };
      mockClient.post.mockResolvedValue({ data: mockResponse });

      const result = await api.initiate({
        name: 'call-test',
        properties: {
          channel: 'call-channel',
          phone_number: '+15551234567',
        },
      });

      expect(mockClient.post).toHaveBeenCalledWith('/call', {
        name: 'call-test',
        properties: {
          channel: 'call-channel',
          phone_number: '+15551234567',
        },
      });
      expect(result.agent_id).toBe('call-123');
    });
  });

  describe('hangup', () => {
    it('sends POST to /calls/{id}/hangup', async () => {
      mockClient.post.mockResolvedValue({});

      await api.hangup('call-123');

      expect(mockClient.post).toHaveBeenCalledWith('/calls/call-123/hangup');
    });
  });

  describe('status', () => {
    it('sends GET to /calls/{id}', async () => {
      const mockResponse = {
        agent_id: 'call-123',
        status: 'answered',
        direction: 'outbound',
        phone_number: '+15551234567',
        start_ts: 123456,
      };
      mockClient.get.mockResolvedValue({ data: mockResponse });

      const result = await api.status('call-123');

      expect(mockClient.get).toHaveBeenCalledWith('/calls/call-123');
      expect(result.direction).toBe('outbound');
    });
  });
});
