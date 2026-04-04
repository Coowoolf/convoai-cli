// ConvoAI Starter — Express Server
// Serves frontend static files + Agora RTC SDK + API routes.

import 'dotenv/config';
import express from 'express';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import sessionRouter from './routes/session.js';
import tokenRouter from './routes/token.js';
import callbackRouter from './routes/callback.js';
import knowledgeRouter from './routes/knowledge.js';
import { getHistory } from './convoai-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── Middleware ─────────────────────────────────────────────────────────────

app.use(express.json());

// ─── Agora RTC SDK from npm ────────────────────────────────────────────────

let sdkCache: Buffer | null = null;

app.get('/agora-sdk.js', (_req, res) => {
  if (!sdkCache) {
    const sdkPath = require.resolve('agora-rtc-sdk-ng/AgoraRTC_N-production.js');
    sdkCache = readFileSync(sdkPath);
  }
  res.set({
    'Content-Type': 'application/javascript; charset=utf-8',
    'Content-Length': String(sdkCache.length),
    'Cache-Control': 'public, max-age=86400',
  });
  res.send(sdkCache);
});

// ─── API Routes ────────────────────────────────────────────────────────────

app.use(sessionRouter);
app.use(tokenRouter);
app.use(callbackRouter);
app.use(knowledgeRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ─── History Proxy ─────────────────────────────────────────────────────────

app.get('/history', async (req, res) => {
  const agentId = req.query.agentId as string;
  if (!agentId) {
    res.status(400).json({ error: 'Missing agentId query parameter' });
    return;
  }

  try {
    const appId = process.env.AGORA_APP_ID!;
    const customerId = process.env.AGORA_CUSTOMER_ID!;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET!;
    const region = process.env.AGORA_REGION || 'global';

    const history = await getHistory(appId, agentId, customerId, customerSecret, region);
    res.json({ history });
  } catch {
    res.json({ history: [] });
  }
});

// ─── Frontend Static Files ─────────────────────────────────────────────────

const frontendDir = join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// ─── Start Server ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log(`  ConvoAI Starter Server running at:`);
  console.log(`  -> http://localhost:${PORT}`);
  console.log('');
  console.log(`  API routes:`);
  console.log(`    POST /session/start   Start voice conversation`);
  console.log(`    POST /session/stop    Stop conversation`);
  console.log(`    GET  /token           Generate RTC token`);
  console.log(`    GET  /health          Health check`);
  console.log('');

  const required = ['AGORA_APP_ID', 'AGORA_APP_CERTIFICATE', 'AGORA_CUSTOMER_ID', 'AGORA_CUSTOMER_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.log(`  ⚠ Missing credentials in .env: ${missing.join(', ')}`);
    console.log(`  Run "convoai quickstart" to configure, or edit .env manually.`);
    console.log('');
  }
});
