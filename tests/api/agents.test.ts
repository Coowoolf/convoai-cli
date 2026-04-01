import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentAPI } from '../../src/api/agents.js';

function createMockClient() {
  return {
    get: vi.fn(),
    post: vi.fn(),
  };
}

describe('AgentAPI', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let api: AgentAPI;

  beforeEach(() => {
    mockClient = createMockClient();
    api = new AgentAPI(mockClient as any);
  });

  describe('start', () => {
    it('sends POST to /join with request body', async () => {
      const mockResponse = { agent_id: 'abc123', create_ts: 1234567890, status: 'RUNNING' };
      mockClient.post.mockResolvedValue({ data: mockResponse });

      const result = await api.start({
        name: 'test-agent',
        properties: { channel: 'test-channel' },
      });

      expect(mockClient.post).toHaveBeenCalledWith('/join', {
        name: 'test-agent',
        properties: { channel: 'test-channel' },
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('stop', () => {
    it('sends POST to /agents/{id}/leave', async () => {
      mockClient.post.mockResolvedValue({});

      await api.stop('agent-123');

      expect(mockClient.post).toHaveBeenCalledWith('/agents/agent-123/leave');
    });
  });

  describe('status', () => {
    it('sends GET to /agents/{id}', async () => {
      const mockResponse = { agent_id: 'agent-123', status: 'RUNNING', start_ts: 123 };
      mockClient.get.mockResolvedValue({ data: mockResponse });

      const result = await api.status('agent-123');

      expect(mockClient.get).toHaveBeenCalledWith('/agents/agent-123');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('list', () => {
    it('sends GET to /agents with no params by default', async () => {
      const mockResponse = { data: { count: 0, list: [] }, meta: {}, status: 'ok' };
      mockClient.get.mockResolvedValue({ data: mockResponse });

      const result = await api.list();

      expect(mockClient.get).toHaveBeenCalledWith('/agents', { params: undefined });
      expect(result).toEqual(mockResponse);
    });

    it('passes query params for filtering', async () => {
      const mockResponse = { data: { count: 1, list: [] }, meta: {}, status: 'ok' };
      mockClient.get.mockResolvedValue({ data: mockResponse });

      await api.list({ state: 2, limit: 10, channel: 'test' });

      expect(mockClient.get).toHaveBeenCalledWith('/agents', {
        params: { state: 2, limit: 10, channel: 'test' },
      });
    });
  });

  describe('update', () => {
    it('sends POST to /agents/{id}/update with body', async () => {
      const mockResponse = { agent_id: 'abc', create_ts: 123, status: 'RUNNING' };
      mockClient.post.mockResolvedValue({ data: mockResponse });

      const result = await api.update('abc', {
        properties: { llm: { system_messages: [{ role: 'system', content: 'New prompt' }] } },
      });

      expect(mockClient.post).toHaveBeenCalledWith('/agents/abc/update', {
        properties: { llm: { system_messages: [{ role: 'system', content: 'New prompt' }] } },
      });
      expect(result.agent_id).toBe('abc');
    });
  });

  describe('speak', () => {
    it('sends POST to /agents/{id}/speak with text and priority', async () => {
      const mockResponse = { agent_id: 'abc', channel: 'ch', start_ts: 123 };
      mockClient.post.mockResolvedValue({ data: mockResponse });

      const result = await api.speak('abc', { text: 'Hello!', priority: 'INTERRUPT' });

      expect(mockClient.post).toHaveBeenCalledWith('/agents/abc/speak', {
        text: 'Hello!',
        priority: 'INTERRUPT',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('interrupt', () => {
    it('sends POST to /agents/{id}/interrupt', async () => {
      mockClient.post.mockResolvedValue({});

      await api.interrupt('abc');

      expect(mockClient.post).toHaveBeenCalledWith('/agents/abc/interrupt');
    });
  });

  describe('history', () => {
    it('sends GET to /agents/{id}/history', async () => {
      const mockResponse = { agent_id: 'abc', start_ts: 123, status: 'RUNNING', contents: [] };
      mockClient.get.mockResolvedValue({ data: mockResponse });

      const result = await api.history('abc');

      expect(mockClient.get).toHaveBeenCalledWith('/agents/abc/history');
      expect(result.contents).toEqual([]);
    });
  });

  describe('turns', () => {
    it('sends GET to /agents/{id}/turns', async () => {
      const mockResponse = { agent_id: 'abc', turns: [] };
      mockClient.get.mockResolvedValue({ data: mockResponse });

      const result = await api.turns('abc');

      expect(mockClient.get).toHaveBeenCalledWith('/agents/abc/turns');
      expect(result.turns).toEqual([]);
    });
  });
});
