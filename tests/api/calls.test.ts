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

  describe('send', () => {
    it('sends POST to /call with SIP config', async () => {
      const mockResponse = { agent_id: 'call-123' };
      mockClient.post.mockResolvedValue({ data: mockResponse });

      const request = {
        name: 'call-test',
        sip: {
          to_number: '+15559876543',
          from_number: '+15551234567',
          rtc_uid: '1',
          rtc_token: 'token-sip',
        },
        properties: {
          channel: 'call-channel',
          token: 'token-agent',
          agent_rtc_uid: '0',
          remote_rtc_uids: ['1'],
        },
      };

      const result = await api.send(request);

      expect(mockClient.post).toHaveBeenCalledWith('/call', request);
      expect(result.agent_id).toBe('call-123');
    });
  });

  describe('hangup', () => {
    it('sends POST to /agents/{id}/leave', async () => {
      mockClient.post.mockResolvedValue({});

      await api.hangup('call-123');

      expect(mockClient.post).toHaveBeenCalledWith('/agents/call-123/leave');
    });
  });

  describe('status', () => {
    it('sends GET to /agents/{id}', async () => {
      const mockResponse = {
        agent_id: 'call-123',
        status: 'RUNNING',
        start_ts: 123456,
        channel: 'call-channel',
      };
      mockClient.get.mockResolvedValue({ data: mockResponse });

      const result = await api.status('call-123');

      expect(mockClient.get).toHaveBeenCalledWith('/agents/call-123');
      expect(result.status).toBe('RUNNING');
    });
  });

  describe('list', () => {
    it('sends GET to /agents with params', async () => {
      mockClient.get.mockResolvedValue({ data: { data: { list: [] } } });

      await api.list({ limit: 10 });

      expect(mockClient.get).toHaveBeenCalledWith('/agents', { params: { limit: 10 } });
    });
  });
});
