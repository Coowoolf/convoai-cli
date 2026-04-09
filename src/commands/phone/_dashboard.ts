import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import net from 'node:net';
import type { CallAPI, CallStatusResponse } from '../../api/calls.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Format a Server-Sent Event message. */
export function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Find first available port in range [start, start+9]. */
export async function findAvailablePort(start: number): Promise<number> {
  for (let port = start; port <= start + 9; port++) {
    const available = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => { server.close(); resolve(true); });
      server.listen(port);
    });
    if (available) return port;
  }
  throw new Error(`No available port in range ${start}–${start + 9}`);
}

export interface DashboardOptions {
  mode: string;
  label: string;
  agentId: string;
  callApi: CallAPI;
  config?: Record<string, unknown>;
}

export class PhoneDashboard {
  private server: ReturnType<typeof createServer> | null = null;
  private sseClients: Set<ServerResponse> = new Set();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private startTime = Date.now();
  private port = 3211;

  constructor(private readonly opts: DashboardOptions) {}

  /** Start the dashboard server and begin polling call status. */
  async start(): Promise<number> {
    this.port = await findAvailablePort(3211);
    const html = this.loadHTML();

    this.server = createServer((req, res) => this.handleRequest(req, res, html));
    await new Promise<void>((resolve) => this.server!.listen(this.port, resolve));

    // Start polling call status
    this.pollTimer = setInterval(() => this.pollStatus(), 2000);
    // Send initial state
    this.broadcast('init', {
      mode: this.opts.mode,
      label: this.opts.label,
      agentId: this.opts.agentId,
      config: this.opts.config ?? {},
    });

    return this.port;
  }

  /** Stop the dashboard server and clean up. */
  async stop(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    for (const client of this.sseClients) {
      client.end();
    }
    this.sseClients.clear();
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    }
  }

  /** Broadcast an SSE event to all connected clients. */
  private broadcast(event: string, data: unknown): void {
    const msg = formatSSE(event, data);
    for (const client of this.sseClients) {
      client.write(msg);
    }
  }

  /** Poll call status from Agora API and broadcast updates. */
  private async pollStatus(): Promise<void> {
    try {
      const status = await this.opts.callApi.status(this.opts.agentId);
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      this.broadcast('status', {
        status: status.status,
        duration: elapsed,
        channel: status.channel,
        message: status.message,
      });

      if (status.status === 'STOPPED' || status.status === 'FAILED') {
        this.broadcast('ended', { status: status.status, duration: elapsed });
        if (this.pollTimer) clearInterval(this.pollTimer);
      }
    } catch {
      // Ignore poll errors — dashboard stays alive
    }
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse, html: string): void {
    const pathname = (req.url || '/').split('?')[0];

    if (pathname === '/events' && req.method === 'GET') {
      // SSE endpoint
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      this.sseClients.add(res);
      req.on('close', () => this.sseClients.delete(res));

      // Send current state immediately
      res.write(formatSSE('init', {
        mode: this.opts.mode,
        label: this.opts.label,
        agentId: this.opts.agentId,
        config: this.opts.config ?? {},
      }));
      return;
    }

    if (pathname === '/hangup' && req.method === 'POST') {
      this.opts.callApi.hangup(this.opts.agentId)
        .then(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        })
        .catch((err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        });
      return;
    }

    // Serve dashboard HTML
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  private loadHTML(): string {
    const htmlPath = join(__dirname, '../../web/phone-dashboard.html');
    return readFileSync(htmlPath, 'utf-8');
  }
}
