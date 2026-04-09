import { describe, it, expect, vi, afterEach } from 'vitest';
import { createServer } from 'node:http';

describe('PhoneDashboard', () => {
  it('creates an instance with mode and agent info', async () => {
    const { PhoneDashboard } = await import('../../src/commands/phone/_dashboard.js');
    const dash = new PhoneDashboard({
      mode: 'translate',
      label: '🌐 Translate [zh → ja]',
      agentId: 'agent-123',
      callApi: {} as any,
    });
    expect(dash).toBeDefined();
  });

  it('formatSSE returns valid SSE format', async () => {
    const { formatSSE } = await import('../../src/commands/phone/_dashboard.js');
    const result = formatSSE('status', { status: 'RUNNING', duration: 10 });
    expect(result).toContain('event: status');
    expect(result).toContain('"status":"RUNNING"');
    expect(result).toContain('\n\n');
  });

  it('findAvailablePort finds a free port', async () => {
    const { findAvailablePort } = await import('../../src/commands/phone/_dashboard.js');
    const port = await findAvailablePort(3211);
    expect(port).toBeGreaterThanOrEqual(3211);
    expect(port).toBeLessThanOrEqual(3220);
  });

  it('findAvailablePort skips occupied port', async () => {
    const { findAvailablePort } = await import('../../src/commands/phone/_dashboard.js');
    // Occupy port 3211
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(3211, resolve));
    try {
      const port = await findAvailablePort(3211);
      expect(port).toBeGreaterThan(3211);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
