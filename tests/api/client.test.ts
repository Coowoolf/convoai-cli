import { describe, it, expect } from 'vitest';
import { resolveBaseUrl, createClient } from '../../src/api/client.js';

describe('resolveBaseUrl', () => {
  it('returns global URL with appId by default', () => {
    const url = resolveBaseUrl('test-app');
    expect(url).toBe(
      'https://api.agora.io/api/conversational-ai-agent/v2/projects/test-app',
    );
  });

  it('returns global URL when region is "global"', () => {
    const url = resolveBaseUrl('my-app', 'global');
    expect(url).toBe(
      'https://api.agora.io/api/conversational-ai-agent/v2/projects/my-app',
    );
  });

  it('returns CN URL when region is "cn"', () => {
    const url = resolveBaseUrl('cn-app', 'cn');
    expect(url).toBe(
      'https://api.agora.io/cn/api/conversational-ai-agent/v2/projects/cn-app',
    );
  });

  it('uses custom base URL when provided', () => {
    const url = resolveBaseUrl('ignored', undefined, 'https://custom.api.com/v2');
    expect(url).toBe('https://custom.api.com/v2');
  });

  it('strips trailing slash from custom URL', () => {
    const url = resolveBaseUrl('ignored', undefined, 'https://custom.api.com/v2/');
    expect(url).toBe('https://custom.api.com/v2');
  });

  it('falls back to global for unknown region', () => {
    const url = resolveBaseUrl('app', 'unknown');
    expect(url).toBe(
      'https://api.agora.io/api/conversational-ai-agent/v2/projects/app',
    );
  });
});

describe('createClient', () => {
  it('creates an axios instance with correct baseURL', () => {
    const client = createClient({
      appId: 'test-app',
      customerId: 'cid',
      customerSecret: 'csecret',
    });

    expect(client.defaults.baseURL).toBe(
      'https://api.agora.io/api/conversational-ai-agent/v2/projects/test-app',
    );
  });

  it('sets Basic auth header with base64 credentials', () => {
    const client = createClient({
      appId: 'app',
      customerId: 'myid',
      customerSecret: 'mysecret',
    });

    const expected = Buffer.from('myid:mysecret').toString('base64');
    expect(client.defaults.headers['Authorization']).toBe(`Basic ${expected}`);
  });

  it('sets Content-Type to JSON', () => {
    const client = createClient({
      appId: 'app',
      customerId: 'id',
      customerSecret: 'secret',
    });

    expect(client.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('sets 30s timeout', () => {
    const client = createClient({
      appId: 'app',
      customerId: 'id',
      customerSecret: 'secret',
    });

    expect(client.defaults.timeout).toBe(30_000);
  });

  it('uses CN region URL when specified', () => {
    const client = createClient({
      appId: 'cn-app',
      customerId: 'id',
      customerSecret: 'secret',
      region: 'cn',
    });

    expect(client.defaults.baseURL).toContain('/cn/api/');
  });

  it('uses custom base URL when specified', () => {
    const client = createClient({
      appId: 'app',
      customerId: 'id',
      customerSecret: 'secret',
      baseUrl: 'https://custom.example.com',
    });

    expect(client.defaults.baseURL).toBe('https://custom.example.com');
  });
});
