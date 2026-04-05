# ConvoAI Developer Platform — Web Starter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `convoai init` and `convoai dev` commands that scaffold a three-layer (Frontend / Customer Server / ConvoAI Engine) Web starter project from an embedded template.

**Architecture:** Starter template files live in `src/starters/web/` inside the CLI package. `convoai init` copies this directory to the user's project, injects `.env` credentials from CLI config. The starter is a fully independent Node.js project — Express server serves frontend static files + Agora RTC SDK from npm, with direct REST API calls to ConvoAI Engine.

**Tech Stack:** TypeScript, Express, Agora RTC SDK (npm), Agora Token, Vanilla HTML/CSS/JS frontend, Python FastAPI (sample), vitest (tests)

---

## File Structure

### New files in CLI codebase

| File | Responsibility |
|------|---------------|
| `src/commands/init.ts` | `convoai init [name]` command — copy template, inject .env |
| `src/commands/dev.ts` | `convoai dev` command — detect starter, delegate to npm run dev |
| `src/starters/web/package.json` | Starter manifest with `"convoai-starter": true` marker |
| `src/starters/web/.env.example` | Credential template (committable) |
| `src/starters/web/.gitignore` | Ignore .env, node_modules, dist |
| `src/starters/web/README.md` | Quickstart + customization guide |
| `src/starters/web/server/index.ts` | Express entry — static files + SDK + API routes |
| `src/starters/web/server/convoai-api.ts` | Direct Agora REST API wrapper + token generation |
| `src/starters/web/server/routes/session.ts` | POST /session/start, POST /session/stop |
| `src/starters/web/server/routes/token.ts` | GET /token |
| `src/starters/web/server/routes/callback.ts` | POST /callback webhook placeholder |
| `src/starters/web/server/routes/knowledge.ts` | POST /knowledge placeholder |
| `src/starters/web/server/tsconfig.json` | TypeScript config for starter |
| `src/starters/web/frontend/index.html` | Voice conversation UI page |
| `src/starters/web/frontend/style.css` | Dark geek theme (#16161a + #7f5af0) |
| `src/starters/web/frontend/app.js` | Agora RTC connection + UI logic |
| `src/starters/web/python-server/app.py` | FastAPI: health + session + token |
| `src/starters/web/python-server/token_builder.py` | AccessToken2 in pure Python |
| `src/starters/web/python-server/requirements.txt` | Python deps |
| `src/starters/web/python-server/.env.example` | Python env template |
| `src/starters/web/python-server/README.md` | Python setup guide |
| `src/starters/web/connectors/README.md` | Connector architecture docs |
| `tests/commands/init.test.ts` | Tests for init command |
| `tests/commands/dev.test.ts` | Tests for dev command |

### Modified files

| File | Change |
|------|--------|
| `src/index.ts` | Import + register `init` and `dev`, add to help text |
| `package.json` | Add `src/starters` to `"files"` array |

---

### Task 1: Starter project scaffolding files

**Files:**
- Create: `src/starters/web/package.json`
- Create: `src/starters/web/.env.example`
- Create: `src/starters/web/.gitignore`
- Create: `src/starters/web/server/tsconfig.json`

- [ ] **Step 1: Create starter package.json**

```json
// src/starters/web/package.json
{
  "name": "my-convoai-app",
  "version": "0.1.0",
  "private": true,
  "convoai-starter": true,
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "tsc -p server/tsconfig.json",
    "start": "node dist/server/index.js"
  },
  "dependencies": {
    "agora-rtc-sdk-ng": "^4.24.0",
    "agora-token": "^2.0.5",
    "dotenv": "^16.4.0",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create .env.example**

```ini
# src/starters/web/.env.example

# Agora Credentials (from https://console.agora.io)
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
AGORA_CUSTOMER_ID=
AGORA_CUSTOMER_SECRET=

# Region: "global" or "cn"
AGORA_REGION=global

# LLM Configuration
LLM_VENDOR=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=
LLM_URL=
LLM_STYLE=openai

# TTS Configuration
TTS_VENDOR=microsoft
TTS_API_KEY=

# ASR Configuration
ASR_VENDOR=ares
ASR_LANGUAGE=en-US
```

- [ ] **Step 3: Create .gitignore**

```gitignore
# src/starters/web/.gitignore
.env
node_modules/
dist/
__pycache__/
*.pyc
.venv/
```

- [ ] **Step 4: Create server/tsconfig.json**

```json
// src/starters/web/server/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "../dist/server",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["./**/*.ts"]
}
```

- [ ] **Step 5: Commit**

```bash
git add src/starters/web/package.json src/starters/web/.env.example src/starters/web/.gitignore src/starters/web/server/tsconfig.json
git commit -m "feat: starter project scaffolding (package.json, env, gitignore, tsconfig)"
```

---

### Task 2: Starter server — Agora API wrapper

**Files:**
- Create: `src/starters/web/server/convoai-api.ts`

This is the core file that wraps Agora ConvoAI REST API calls. No dependency on the convoai CLI package.

- [ ] **Step 1: Create convoai-api.ts**

```typescript
// src/starters/web/server/convoai-api.ts
//
// Direct Agora ConvoAI REST API wrapper.
// No dependency on the convoai CLI package — pure HTTP + token generation.
// Customize: add retry logic, error handling, or additional endpoints as needed.

import { RtcTokenBuilder, RtcRole } from 'agora-token';

// ─── Config ────────────────────────────────────────────────────────────────

const BASE_URLS: Record<string, string> = {
  global: 'https://api.agora.io/api/conversational-ai-agent/v2/projects',
  cn: 'https://api.agora.io/cn/api/conversational-ai-agent/v2/projects',
};

function getBaseUrl(appId: string, region: string = 'global'): string {
  const base = BASE_URLS[region] ?? BASE_URLS.global;
  return `${base}/${appId}`;
}

function getAuthHeader(customerId: string, customerSecret: string): string {
  return 'Basic ' + Buffer.from(`${customerId}:${customerSecret}`).toString('base64');
}

// ─── Token Generation ──────────────────────────────────────────────────────

export function generateToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
  expirationSeconds: number = 3600,
): string {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationSeconds;
  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    privilegeExpiredTs,
    privilegeExpiredTs,
  );
}

// ─── Start Agent ───────────────────────────────────────────────────────────

export interface StartAgentConfig {
  appId: string;
  appCertificate: string;
  customerId: string;
  customerSecret: string;
  region?: string;
  channel: string;
  agentUid?: number;
  clientUid: number;
  llm: {
    vendor?: string;
    model?: string;
    apiKey?: string;
    url?: string;
    style?: string;
  };
  tts: {
    vendor?: string;
    apiKey?: string;
  };
  asr?: {
    vendor?: string;
    language?: string;
  };
  greeting?: string;
}

export interface StartAgentResult {
  agentId: string;
  appId: string;
  channel: string;
  token: string;
  uid: number;
}

export async function startAgent(config: StartAgentConfig): Promise<StartAgentResult> {
  const {
    appId, appCertificate, customerId, customerSecret,
    region = 'global', channel, agentUid = 0, clientUid,
    llm, tts, asr, greeting,
  } = config;

  // Generate tokens
  const agentToken = generateToken(appId, appCertificate, channel, agentUid);
  const clientToken = generateToken(appId, appCertificate, channel, clientUid);

  // Build request body
  const body: Record<string, unknown> = {
    name: 'convoai-starter',
    properties: {
      channel: channel,
      token: agentToken,
      agent_rtc_uid: String(agentUid),
      remote_rtc_uids: [String(clientUid)],
      llm: {
        url: llm.url || undefined,
        api_key: llm.apiKey || undefined,
        vendor: llm.vendor || undefined,
        style: llm.style || undefined,
        model: llm.model || undefined,
        greeting_message: greeting || 'Hello! How can I help you today?',
        max_history: 20,
        params: {
          model: llm.model || undefined,
          max_tokens: 512,
          temperature: 0.7,
        },
      },
      tts: {
        vendor: tts.vendor || undefined,
        params: {
          key: tts.apiKey || undefined,
        },
      },
      asr: {
        vendor: asr?.vendor || 'ares',
        language: asr?.language || 'en-US',
      },
      parameters: {
        enable_metrics: true,
      },
    },
  };

  const url = `${getBaseUrl(appId, region)}/join`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(customerId, customerSecret),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ConvoAI API error (${res.status}): ${text}`);
  }

  const data = await res.json() as { agent_id: string };

  return {
    agentId: data.agent_id,
    appId,
    channel,
    token: clientToken,
    uid: clientUid,
  };
}

// ─── Stop Agent ────────────────────────────────────────────────────────────

export async function stopAgent(
  appId: string,
  agentId: string,
  customerId: string,
  customerSecret: string,
  region: string = 'global',
): Promise<void> {
  const url = `${getBaseUrl(appId, region)}/agents/${agentId}/leave`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(customerId, customerSecret),
    },
    body: '{}',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ConvoAI API error (${res.status}): ${text}`);
  }
}

// ─── Get History ───────────────────────────────────────────────────────────

export interface HistoryEntry {
  role: string;
  content: string;
  timestamp?: number;
}

export async function getHistory(
  appId: string,
  agentId: string,
  customerId: string,
  customerSecret: string,
  region: string = 'global',
): Promise<HistoryEntry[]> {
  const url = `${getBaseUrl(appId, region)}/agents/${agentId}/history`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(customerId, customerSecret),
    },
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json() as { history?: HistoryEntry[] };
  return data.history ?? [];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/starters/web/server/convoai-api.ts
git commit -m "feat: starter Agora ConvoAI API wrapper (direct REST, no CLI dependency)"
```

---

### Task 3: Starter server — Express routes

**Files:**
- Create: `src/starters/web/server/routes/session.ts`
- Create: `src/starters/web/server/routes/token.ts`
- Create: `src/starters/web/server/routes/callback.ts`
- Create: `src/starters/web/server/routes/knowledge.ts`

- [ ] **Step 1: Create session.ts**

```typescript
// src/starters/web/server/routes/session.ts
import { Router } from 'express';
import { startAgent, stopAgent, type StartAgentConfig } from '../convoai-api.js';

const router = Router();

// In-memory session store (single session for simplicity)
// Customize: replace with database or Redis for production
let currentSession: { agentId: string; channel: string } | null = null;

router.post('/session/start', async (req, res) => {
  try {
    if (currentSession) {
      res.status(409).json({ error: 'Session already active. Stop it first.' });
      return;
    }

    const appId = process.env.AGORA_APP_ID!;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE!;
    const customerId = process.env.AGORA_CUSTOMER_ID!;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET!;
    const region = process.env.AGORA_REGION || 'global';

    const channel = `session-${Date.now().toString(36)}`;
    const clientUid = Math.floor(Math.random() * 90000) + 10000;

    const config: StartAgentConfig = {
      appId,
      appCertificate,
      customerId,
      customerSecret,
      region,
      channel,
      clientUid,
      llm: {
        vendor: process.env.LLM_VENDOR,
        model: process.env.LLM_MODEL,
        apiKey: process.env.LLM_API_KEY,
        url: process.env.LLM_URL,
        style: process.env.LLM_STYLE,
      },
      tts: {
        vendor: process.env.TTS_VENDOR,
        apiKey: process.env.TTS_API_KEY,
      },
      asr: {
        vendor: process.env.ASR_VENDOR,
        language: process.env.ASR_LANGUAGE,
      },
    };

    const result = await startAgent(config);
    currentSession = { agentId: result.agentId, channel: result.channel };

    res.json({
      appId: result.appId,
      channel: result.channel,
      token: result.token,
      uid: result.uid,
      agentId: result.agentId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[session/start]', message);
    res.status(500).json({ error: message });
  }
});

router.post('/session/stop', async (req, res) => {
  try {
    if (!currentSession) {
      res.status(404).json({ error: 'No active session' });
      return;
    }

    const appId = process.env.AGORA_APP_ID!;
    const customerId = process.env.AGORA_CUSTOMER_ID!;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET!;
    const region = process.env.AGORA_REGION || 'global';

    await stopAgent(appId, currentSession.agentId, customerId, customerSecret, region);
    currentSession = null;

    res.json({ status: 'stopped' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[session/stop]', message);
    currentSession = null;
    res.status(500).json({ error: message });
  }
});

export default router;
```

- [ ] **Step 2: Create token.ts**

```typescript
// src/starters/web/server/routes/token.ts
import { Router } from 'express';
import { generateToken } from '../convoai-api.js';

const router = Router();

router.get('/token', (req, res) => {
  try {
    const appId = process.env.AGORA_APP_ID!;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE!;
    const channel = (req.query.channel as string) || `ch-${Date.now().toString(36)}`;
    const uid = parseInt(req.query.uid as string, 10) || 0;

    const token = generateToken(appId, appCertificate, channel, uid);

    res.json({ token, channel, uid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
```

- [ ] **Step 3: Create callback.ts**

```typescript
// src/starters/web/server/routes/callback.ts
//
// Webhook endpoint for ConvoAI Engine callbacks.
// Customize: add your webhook handling logic here.
// See: https://doc.shengwang.cn/api-ref/convo-ai/restful/webhooks

import { Router } from 'express';

const router = Router();

router.post('/callback', (req, res) => {
  console.log('[callback] Received webhook:', JSON.stringify(req.body, null, 2));

  // Customize: handle different event types
  // const { event_type, payload } = req.body;
  // switch (event_type) {
  //   case 'agent.started':
  //     break;
  //   case 'agent.stopped':
  //     break;
  //   case 'conversation.turn':
  //     break;
  // }

  res.json({ received: true });
});

export default router;
```

- [ ] **Step 4: Create knowledge.ts**

```typescript
// src/starters/web/server/routes/knowledge.ts
//
// Knowledge base query endpoint.
// Customize: connect your knowledge base, RAG pipeline, or vector DB here.

import { Router } from 'express';

const router = Router();

router.post('/knowledge', (req, res) => {
  const { query } = req.body || {};

  console.log('[knowledge] Query:', query);

  // Customize: replace with your knowledge base integration
  // Examples:
  //   - Query a vector database (Pinecone, Weaviate, Milvus)
  //   - Call a RAG pipeline
  //   - Search your documentation

  res.json({
    results: [],
    message: 'Knowledge base not configured. Edit server/routes/knowledge.ts to connect yours.',
  });
});

export default router;
```

- [ ] **Step 5: Commit**

```bash
git add src/starters/web/server/routes/
git commit -m "feat: starter Express routes (session, token, callback, knowledge)"
```

---

### Task 4: Starter server — Express entry point

**Files:**
- Create: `src/starters/web/server/index.ts`

- [ ] **Step 1: Create server/index.ts**

```typescript
// src/starters/web/server/index.ts
//
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── Middleware ─────────────────────────────────────────────────────────────

app.use(express.json());

// ─── Agora RTC SDK from npm ────────────────────────────────────────────────
// Served from node_modules so each `npm install` counts as an npm download.

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

  // Validate required env vars
  const required = ['AGORA_APP_ID', 'AGORA_APP_CERTIFICATE', 'AGORA_CUSTOMER_ID', 'AGORA_CUSTOMER_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.log(`  ⚠ Missing credentials in .env: ${missing.join(', ')}`);
    console.log(`  Run "convoai quickstart" to configure, or edit .env manually.`);
    console.log('');
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add src/starters/web/server/index.ts
git commit -m "feat: starter Express server entry point"
```

---

### Task 5: Starter frontend

**Files:**
- Create: `src/starters/web/frontend/index.html`
- Create: `src/starters/web/frontend/style.css`
- Create: `src/starters/web/frontend/app.js`

- [ ] **Step 1: Create index.html**

```html
<!-- src/starters/web/frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ConvoAI Starter</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <!-- Customize: add your logo here -->
  <header>
    <div class="status-bar">
      <span class="logo">ConvoAI</span>
      <span id="status" class="status disconnected">Disconnected</span>
    </div>
  </header>

  <main>
    <!-- Customize: modify conversation UI layout -->
    <div id="conversation" class="conversation">
      <div class="empty-state">
        <p>Click <strong>Start Conversation</strong> to begin talking with the AI agent.</p>
      </div>
    </div>
  </main>

  <footer>
    <div class="controls">
      <div id="volume-indicator" class="volume-indicator"></div>
      <button id="btn-start" class="btn btn-primary" onclick="toggleConversation()">
        Start Conversation
      </button>
    </div>
  </footer>

  <script src="/agora-sdk.js"></script>
  <script src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create style.css**

```css
/* src/starters/web/frontend/style.css */
/*
 * ConvoAI Starter — Dark Geek Theme
 * Palette: Happy Hues #4
 * Customize: change theme colors here
 */

:root {
  --bg: #16161a;
  --bg-card: #242629;
  --text: #fffffe;
  --text-secondary: #94a1b2;
  --accent: #7f5af0;
  --accent-hover: #6b4bd4;
  --success: #2cb67d;
  --gray: #72757e;
  --danger: #e74c3c;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
  background: var(--bg);
  color: var(--text);
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── Header ─────────────────────────────────────────────────────────────── */

header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--bg-card);
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 720px;
  margin: 0 auto;
}

.logo {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.5px;
}

.status {
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 100px;
  font-weight: 500;
}

.status.disconnected {
  color: var(--gray);
  background: rgba(114, 117, 126, 0.15);
}

.status.connecting {
  color: #f0c040;
  background: rgba(240, 192, 64, 0.15);
}

.status.connected {
  color: var(--success);
  background: rgba(44, 182, 125, 0.15);
}

/* ── Conversation ───────────────────────────────────────────────────────── */

main {
  flex: 1;
  overflow: hidden;
  padding: 24px;
}

.conversation {
  max-width: 720px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  text-align: center;
  font-size: 15px;
}

.message {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.5;
  animation: fadeIn 0.2s ease-out;
}

.message.user {
  align-self: flex-end;
  background: var(--accent);
  color: var(--text);
  border-bottom-right-radius: 4px;
}

.message.agent {
  align-self: flex-start;
  background: var(--bg-card);
  color: var(--text);
  border-bottom-left-radius: 4px;
}

.message .role {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  opacity: 0.6;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Footer Controls ────────────────────────────────────────────────────── */

footer {
  padding: 16px 24px 24px;
  border-top: 1px solid var(--bg-card);
}

.controls {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: center;
}

.volume-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--gray);
  transition: all 0.15s ease;
}

.volume-indicator.active {
  background: var(--success);
  box-shadow: 0 0 12px rgba(44, 182, 125, 0.5);
}

.btn {
  padding: 12px 32px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary {
  background: var(--accent);
  color: var(--text);
}

.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-danger {
  background: var(--danger);
  color: var(--text);
}

.btn-danger:hover {
  background: #c0392b;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* ── Scrollbar ──────────────────────────────────────────────────────────── */

.conversation::-webkit-scrollbar {
  width: 6px;
}

.conversation::-webkit-scrollbar-track {
  background: transparent;
}

.conversation::-webkit-scrollbar-thumb {
  background: var(--gray);
  border-radius: 3px;
}
```

- [ ] **Step 3: Create app.js**

```javascript
// src/starters/web/frontend/app.js
//
// ConvoAI Starter — Frontend Logic
// Handles Agora RTC connection, voice chat, and conversation display.
// Customize: modify the UI, add features, change interaction flow.

const SERVER = window.location.origin;

let client = null;
let localTrack = null;
let currentSession = null;
let historyTimer = null;
let lastHistoryCount = 0;

// ─── UI Helpers ────────────────────────────────────────────────────────────

function setStatus(text, state) {
  const el = document.getElementById('status');
  el.textContent = text;
  el.className = 'status ' + state;
}

function addMessage(role, content) {
  const conv = document.getElementById('conversation');

  // Remove empty state
  const empty = conv.querySelector('.empty-state');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = 'message ' + role;
  div.innerHTML = `<div class="role">${role}</div><div>${escapeHtml(content)}</div>`;
  conv.appendChild(div);
  conv.scrollTop = conv.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setButton(text, className, disabled) {
  const btn = document.getElementById('btn-start');
  btn.textContent = text;
  btn.className = 'btn ' + className;
  btn.disabled = disabled;
}

function setVolume(active) {
  const el = document.getElementById('volume-indicator');
  el.className = 'volume-indicator' + (active ? ' active' : '');
}

// ─── Session Management ────────────────────────────────────────────────────

async function toggleConversation() {
  if (currentSession) {
    await stopConversation();
  } else {
    await startConversation();
  }
}

async function startConversation() {
  setButton('Connecting...', 'btn-primary', true);
  setStatus('Connecting...', 'connecting');

  try {
    // 1. Ask server to start a ConvoAI agent
    const res = await fetch(SERVER + '/session/start', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start session');
    }
    currentSession = await res.json();

    // 2. Initialize Agora RTC client
    client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    // Subscribe to remote audio (the AI agent)
    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'audio') {
        user.audioTrack.play();
        setVolume(true);
      }
    });

    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'audio') setVolume(false);
    });

    client.on('user-left', () => {
      setVolume(false);
    });

    // 3. Join the channel
    await client.join(
      currentSession.appId,
      currentSession.channel,
      currentSession.token,
      currentSession.uid,
    );

    // 4. Create and publish microphone track
    localTrack = await AgoraRTC.createMicrophoneAudioTrack({
      AEC: true,
      ANS: true,
      AGC: true,
    });
    await client.publish([localTrack]);

    setStatus('Connected', 'connected');
    setButton('End Conversation', 'btn-danger', false);

    // 5. Poll conversation history for subtitles
    startHistoryPolling();

  } catch (err) {
    console.error('Start failed:', err);
    setStatus('Error: ' + err.message, 'disconnected');
    setButton('Start Conversation', 'btn-primary', false);
    currentSession = null;
  }
}

async function stopConversation() {
  setButton('Stopping...', 'btn-danger', true);

  stopHistoryPolling();

  try {
    if (localTrack) {
      localTrack.stop();
      localTrack.close();
      localTrack = null;
    }
    if (client) {
      await client.leave();
      client = null;
    }
    await fetch(SERVER + '/session/stop', { method: 'POST' });
  } catch (err) {
    console.error('Stop error:', err);
  }

  currentSession = null;
  setStatus('Disconnected', 'disconnected');
  setButton('Start Conversation', 'btn-primary', false);
  setVolume(false);
}

// ─── History Polling ───────────────────────────────────────────────────────
// Customize: replace with DataStream for real-time subtitles

function startHistoryPolling() {
  lastHistoryCount = 0;
  historyTimer = setInterval(async () => {
    if (!currentSession) return;
    try {
      const res = await fetch(
        SERVER + `/history?agentId=${currentSession.agentId}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const entries = data.history || [];

      // Only show new entries
      for (let i = lastHistoryCount; i < entries.length; i++) {
        const entry = entries[i];
        addMessage(entry.role === 'assistant' ? 'agent' : 'user', entry.content);
      }
      lastHistoryCount = entries.length;
    } catch {
      // Ignore polling errors
    }
  }, 2000);
}

function stopHistoryPolling() {
  if (historyTimer) {
    clearInterval(historyTimer);
    historyTimer = null;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/starters/web/frontend/
git commit -m "feat: starter frontend (HTML + CSS + JS, dark geek theme)"
```

---

### Task 6: Starter server — history route addition

The frontend polls `/history?agentId=...` for conversation subtitles. The server needs to proxy this to the Agora API.

**Files:**
- Modify: `src/starters/web/server/index.ts`

- [ ] **Step 1: Add history proxy route to server/index.ts**

Add this route block before the static file middleware line (`app.use(express.static(frontendDir))`):

```typescript
// ─── History Proxy (for frontend polling) ──────────────────────────────────

import { getHistory } from './convoai-api.js';

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
```

Note: This must be added as an import at the top and a route in the body. The full file was created in Task 4; this step adds the history route to it. Here is the complete updated `server/index.ts`:

```typescript
// src/starters/web/server/index.ts
//
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
// Served from node_modules so each `npm install` counts as an npm download.

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

// ─── History Proxy (for frontend polling) ──────────────────────────────────

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

  // Validate required env vars
  const required = ['AGORA_APP_ID', 'AGORA_APP_CERTIFICATE', 'AGORA_CUSTOMER_ID', 'AGORA_CUSTOMER_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.log(`  ⚠ Missing credentials in .env: ${missing.join(', ')}`);
    console.log(`  Run "convoai quickstart" to configure, or edit .env manually.`);
    console.log('');
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add src/starters/web/server/index.ts
git commit -m "feat: add history proxy route to starter server"
```

---

### Task 7: Starter Python server

**Files:**
- Create: `src/starters/web/python-server/token_builder.py`
- Create: `src/starters/web/python-server/app.py`
- Create: `src/starters/web/python-server/requirements.txt`
- Create: `src/starters/web/python-server/.env.example`
- Create: `src/starters/web/python-server/README.md`

- [ ] **Step 1: Create token_builder.py**

```python
# src/starters/web/python-server/token_builder.py
"""
Agora AccessToken2 builder for RTC.
Pure Python implementation — no external Agora SDK dependency.
Uses only stdlib: hmac, hashlib, struct, base64, time, secrets.
"""

import hmac
import hashlib
import struct
import base64
import time
import secrets

# Privilege constants
PRIVILEGE_JOIN_CHANNEL = 1
PRIVILEGE_PUBLISH_AUDIO = 2
PRIVILEGE_PUBLISH_VIDEO = 3
PRIVILEGE_PUBLISH_DATA = 4

# Service type
SERVICE_TYPE_RTC = 1


def _pack_uint16(value: int) -> bytes:
    return struct.pack("<H", value)


def _pack_uint32(value: int) -> bytes:
    return struct.pack("<I", value)


def _pack_string(value: str) -> bytes:
    encoded = value.encode("utf-8")
    return _pack_uint16(len(encoded)) + encoded


def _pack_map_uint32(m: dict[int, int]) -> bytes:
    result = _pack_uint16(len(m))
    for k, v in m.items():
        result += _pack_uint16(k) + _pack_uint32(v)
    return result


def _pack_service(service_type: int, privileges: dict[int, int]) -> bytes:
    return _pack_uint16(service_type) + _pack_map_uint32(privileges)


def build_token(
    app_id: str,
    app_certificate: str,
    channel_name: str,
    uid: int,
    expire_seconds: int = 3600,
) -> str:
    """Build an AccessToken2 for RTC with PUBLISHER role."""
    now = int(time.time())
    expire = now + expire_seconds

    # Privileges
    privileges = {
        PRIVILEGE_JOIN_CHANNEL: expire,
        PRIVILEGE_PUBLISH_AUDIO: expire,
        PRIVILEGE_PUBLISH_VIDEO: expire,
        PRIVILEGE_PUBLISH_DATA: expire,
    }

    # Pack service
    service_data = _pack_service(SERVICE_TYPE_RTC, privileges)

    # Channel + uid for signing
    uid_str = str(uid) if uid > 0 else ""
    channel_data = _pack_string(channel_name) + _pack_string(uid_str)

    # Message to sign
    salt = secrets.randbelow(0xFFFFFFFF)
    ts = now

    message = _pack_uint32(salt) + _pack_uint32(ts) + _pack_uint16(1) + service_data
    signing_content = channel_data + message

    # HMAC-SHA256 signing
    h1 = hmac.new(
        _pack_uint32(salt), app_certificate.encode("utf-8"), hashlib.sha256
    ).digest()
    h2 = hmac.new(h1, signing_content, hashlib.sha256).digest()

    # Pack final token
    sign_len = _pack_uint16(len(h2))
    token_content = sign_len + h2 + message

    # Version prefix + app_id + base64
    version = "007"
    token_b64 = base64.b64encode(token_content).decode("utf-8")

    return f"{version}{app_id}{token_b64}"
```

- [ ] **Step 2: Create app.py**

```python
# src/starters/web/python-server/app.py
"""
ConvoAI Starter — Python Server (FastAPI)
Alternative to the Node.js server. Same API routes, same frontend.

Usage:
    pip install -r requirements.txt
    cp .env.example .env  # fill in credentials
    uvicorn app:app --port 3000
"""

import os
import time
import random

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from token_builder import build_token

load_dotenv()

app = FastAPI(title="ConvoAI Starter")

# ─── In-memory session store ────────────────────────────────────────────────
# Customize: replace with database for production

current_session: dict | None = None

# ─── Config helpers ─────────────────────────────────────────────────────────

BASE_URLS = {
    "global": "https://api.agora.io/api/conversational-ai-agent/v2/projects",
    "cn": "https://api.agora.io/cn/api/conversational-ai-agent/v2/projects",
}


def get_base_url() -> str:
    app_id = os.environ["AGORA_APP_ID"]
    region = os.environ.get("AGORA_REGION", "global")
    base = BASE_URLS.get(region, BASE_URLS["global"])
    return f"{base}/{app_id}"


def get_auth() -> tuple[str, str]:
    return os.environ["AGORA_CUSTOMER_ID"], os.environ["AGORA_CUSTOMER_SECRET"]


# ─── Routes ─────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/session/start")
def session_start():
    global current_session

    if current_session:
        raise HTTPException(409, "Session already active. Stop it first.")

    app_id = os.environ["AGORA_APP_ID"]
    app_cert = os.environ["AGORA_APP_CERTIFICATE"]
    customer_id, customer_secret = get_auth()

    channel = f"session-{int(time.time()):x}"
    client_uid = random.randint(10000, 99999)
    agent_uid = 0

    agent_token = build_token(app_id, app_cert, channel, agent_uid)
    client_token = build_token(app_id, app_cert, channel, client_uid)

    body = {
        "name": "convoai-starter",
        "properties": {
            "channel": channel,
            "token": agent_token,
            "agent_rtc_uid": str(agent_uid),
            "remote_rtc_uids": [str(client_uid)],
            "llm": {
                "vendor": os.environ.get("LLM_VENDOR"),
                "api_key": os.environ.get("LLM_API_KEY"),
                "model": os.environ.get("LLM_MODEL"),
                "url": os.environ.get("LLM_URL") or None,
                "style": os.environ.get("LLM_STYLE") or None,
                "greeting_message": "Hello! How can I help you today?",
                "max_history": 20,
                "params": {
                    "model": os.environ.get("LLM_MODEL"),
                    "max_tokens": 512,
                    "temperature": 0.7,
                },
            },
            "tts": {
                "vendor": os.environ.get("TTS_VENDOR"),
                "params": {"key": os.environ.get("TTS_API_KEY")},
            },
            "asr": {
                "vendor": os.environ.get("ASR_VENDOR", "ares"),
                "language": os.environ.get("ASR_LANGUAGE", "en-US"),
            },
            "parameters": {"enable_metrics": True},
        },
    }

    url = f"{get_base_url()}/join"
    res = requests.post(
        url,
        json=body,
        auth=(customer_id, customer_secret),
    )

    if not res.ok:
        raise HTTPException(res.status_code, f"ConvoAI API error: {res.text}")

    data = res.json()
    current_session = {"agentId": data["agent_id"], "channel": channel}

    return {
        "appId": app_id,
        "channel": channel,
        "token": client_token,
        "uid": client_uid,
        "agentId": data["agent_id"],
    }


@app.post("/session/stop")
def session_stop():
    global current_session

    if not current_session:
        raise HTTPException(404, "No active session")

    customer_id, customer_secret = get_auth()
    url = f"{get_base_url()}/agents/{current_session['agentId']}/leave"

    try:
        requests.post(url, json={}, auth=(customer_id, customer_secret))
    except Exception:
        pass

    current_session = None
    return {"status": "stopped"}


@app.get("/token")
def get_token(channel: str = "", uid: int = 0):
    app_id = os.environ["AGORA_APP_ID"]
    app_cert = os.environ["AGORA_APP_CERTIFICATE"]
    ch = channel or f"ch-{int(time.time()):x}"

    token = build_token(app_id, app_cert, ch, uid)
    return {"token": token, "channel": ch, "uid": uid}


# ─── Serve frontend ────────────────────────────────────────────────────────
# Mount after API routes so /session/start etc. take precedence

app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")
```

- [ ] **Step 3: Create requirements.txt**

```
# src/starters/web/python-server/requirements.txt
fastapi>=0.115.0
uvicorn>=0.32.0
requests>=2.32.0
python-dotenv>=1.0.0
```

- [ ] **Step 4: Create python-server/.env.example**

```ini
# src/starters/web/python-server/.env.example

# Agora Credentials (from https://console.agora.io)
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
AGORA_CUSTOMER_ID=
AGORA_CUSTOMER_SECRET=

# Region: "global" or "cn"
AGORA_REGION=global

# LLM Configuration
LLM_VENDOR=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=
LLM_URL=
LLM_STYLE=openai

# TTS Configuration
TTS_VENDOR=microsoft
TTS_API_KEY=

# ASR Configuration
ASR_VENDOR=ares
ASR_LANGUAGE=en-US
```

- [ ] **Step 5: Create python-server/README.md**

```markdown
# ConvoAI Starter — Python Server

Alternative to the Node.js server. Same API routes, works with the same frontend.

## Quick Start

    cd python-server
    pip install -r requirements.txt
    cp .env.example .env     # fill in your Agora credentials
    uvicorn app:app --port 3000

Then open http://localhost:3000 — the frontend is served from `../frontend/`.

## Why Python?

If your backend is Python-based (Django, Flask, FastAPI), use this as your starting point instead of the Node.js server. The frontend doesn't care which server it talks to — same routes, same JSON format.

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | /session/start | Start ConvoAI agent, return RTC join params |
| POST | /session/stop | Stop ConvoAI agent |
| GET | /token | Generate RTC token |
| GET | /health | Health check |

## Customize

- `app.py` — add your business logic, authentication, database
- `token_builder.py` — pure Python AccessToken2 implementation (no external SDK)
```

- [ ] **Step 6: Commit**

```bash
git add src/starters/web/python-server/
git commit -m "feat: Python FastAPI starter server with token generation"
```

---

### Task 8: Starter documentation

**Files:**
- Create: `src/starters/web/README.md`
- Create: `src/starters/web/connectors/README.md`

- [ ] **Step 1: Create starter README.md**

```markdown
# ConvoAI Web Starter

A three-layer starter project for building voice AI applications with [Agora ConvoAI Engine](https://www.agora.io/en/products/convoai/).

## Quick Start

    npm install
    convoai dev          # or: npm run dev

Open http://localhost:3000 and click **Start Conversation**.

## Project Structure

    frontend/            <- Your UI (HTML / JS / CSS — no build step)
    server/              <- Your backend (Express + TypeScript)
    python-server/       <- Alternative Python backend (FastAPI)
    connectors/          <- Future: telephony, text, IoT extensions

## How to Customize

### Change the UI

Edit files in `frontend/`:
- `index.html` — page structure
- `style.css` — colors, layout, theme
- `app.js` — interaction logic, Agora RTC handling

### Add business logic

Edit files in `server/routes/`:
- `session.ts` — session start/stop (add auth, rate limiting, logging)
- `callback.ts` — handle ConvoAI webhooks
- `knowledge.ts` — connect your knowledge base or RAG pipeline

### Add authentication

Edit `server/index.ts` — add Express middleware before the API routes.

### Switch to Python

See `python-server/README.md`. Same API routes, same frontend.

## Architecture

    [Your Frontend]  -->  [Your Server]  -->  [ConvoAI Engine]
         HTML/JS          Express/FastAPI      Agora Cloud
         Agora RTC SDK    Token generation     ASR + LLM + TTS
         Voice capture    Business logic       Voice AI pipeline

    Future connectors plug in at the same server layer:
    [Phone / SIP]    -->  [Your Server]  -->  [ConvoAI Engine]
    [IoT Device]     -->  [Your Server]  -->  [ConvoAI Engine]
    [IM / Chat App]  -->  [Your Server]  -->  [ConvoAI Engine]

## From Local to Production

1. **Local** — `npm run dev` (you are here)
2. **Deploy server** — push `server/` to your cloud (Railway, Render, AWS, etc.)
3. **Deploy frontend** — push `frontend/` to CDN or same server
4. **Update .env** — swap local credentials for production ones

No code changes needed. Same architecture scales from laptop to production.

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| AGORA_APP_ID | Yes | From Agora Console |
| AGORA_APP_CERTIFICATE | Yes | From project settings |
| AGORA_CUSTOMER_ID | Yes | REST API credentials |
| AGORA_CUSTOMER_SECRET | Yes | REST API credentials |
| LLM_VENDOR | Yes | LLM provider (openai, anthropic, etc.) |
| LLM_API_KEY | Yes | LLM API key |
| TTS_VENDOR | Yes | TTS provider (microsoft, elevenlabs, etc.) |
| TTS_API_KEY | Yes | TTS API key |
```

- [ ] **Step 2: Create connectors/README.md**

```markdown
# ConvoAI Connectors

This directory is reserved for future communication connectors.

## Architecture

ConvoAI uses a three-layer architecture:

    [Connector]  -->  [Customer Server]  -->  [ConvoAI Engine]

New communication capabilities extend through the Connector layer.
The Customer Server and ConvoAI Engine remain the same.

**Web is the first connector** — implemented in `frontend/`.

## Planned Connectors

### Telephony / SIP (Phase 2)
- Inbound/outbound phone calls via SIP
- Connector handles call signaling; server handles business logic
- ConvoAI Engine handles voice AI pipeline

### Text / IM (Phase 3)
- Chat platforms (Slack, WhatsApp, web chat widgets)
- Connector handles message transport; server handles routing
- ConvoAI Engine handles text-based AI conversation

### Device / Edge (Phase 3)
- IoT devices, smart speakers, embedded systems
- Connector handles device communication; server handles orchestration
- ConvoAI Engine handles voice processing

## Design Principle

Each connector only handles communication transport.
Business logic stays in the Customer Server.
AI capabilities stay in ConvoAI Engine.

This means adding a new connector never requires rewriting your server or AI config.
```

- [ ] **Step 3: Commit**

```bash
git add src/starters/web/README.md src/starters/web/connectors/README.md
git commit -m "docs: starter README + connectors architecture guide"
```

---

### Task 9: CLI `init` command (TDD)

**Files:**
- Create: `tests/commands/init.test.ts`
- Create: `src/commands/init.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/commands/init.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const CLI = join(process.cwd(), 'dist/bin/convoai.js');

function cli(args: string, cwd?: string): string {
  try {
    return execSync(`node ${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 15000,
      cwd: cwd || process.cwd(),
    });
  } catch (err: any) {
    return err.stdout || err.stderr || '';
  }
}

describe('convoai init', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'convoai-init-'));
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('shows help with --help', () => {
    const output = cli('init --help');
    expect(output).toContain('project-name');
  });

  it('creates project directory with expected structure', () => {
    cli(`init test-app`, tempDir);
    const projectDir = join(tempDir, 'test-app');
    expect(existsSync(projectDir)).toBe(true);
    expect(existsSync(join(projectDir, 'frontend', 'index.html'))).toBe(true);
    expect(existsSync(join(projectDir, 'frontend', 'style.css'))).toBe(true);
    expect(existsSync(join(projectDir, 'frontend', 'app.js'))).toBe(true);
    expect(existsSync(join(projectDir, 'server', 'index.ts'))).toBe(true);
    expect(existsSync(join(projectDir, 'server', 'convoai-api.ts'))).toBe(true);
    expect(existsSync(join(projectDir, 'server', 'routes', 'session.ts'))).toBe(true);
    expect(existsSync(join(projectDir, 'python-server', 'app.py'))).toBe(true);
    expect(existsSync(join(projectDir, 'connectors', 'README.md'))).toBe(true);
    expect(existsSync(join(projectDir, 'package.json'))).toBe(true);
    expect(existsSync(join(projectDir, '.env.example'))).toBe(true);
    expect(existsSync(join(projectDir, '.gitignore'))).toBe(true);
    expect(existsSync(join(projectDir, 'README.md'))).toBe(true);
  });

  it('generates .env file', () => {
    cli(`init test-app`, tempDir);
    const envPath = join(tempDir, 'test-app', '.env');
    expect(existsSync(envPath)).toBe(true);
  });

  it('starter package.json has convoai-starter marker', () => {
    cli(`init test-app`, tempDir);
    const pkg = JSON.parse(readFileSync(join(tempDir, 'test-app', 'package.json'), 'utf-8'));
    expect(pkg['convoai-starter']).toBe(true);
  });

  it('uses default name when no argument given', () => {
    const output = cli('init', tempDir);
    const projectDir = join(tempDir, 'my-convoai-app');
    expect(existsSync(projectDir)).toBe(true);
  });

  it('errors when directory already exists and is non-empty', () => {
    const existingDir = join(tempDir, 'existing-app');
    mkdirSync(existingDir);
    writeFileSync(join(existingDir, 'file.txt'), 'content');
    const output = cli('init existing-app', tempDir);
    expect(output.toLowerCase()).toContain('already exists');
  });

  it('prints next steps after success', () => {
    const output = cli('init test-app', tempDir);
    expect(output).toContain('cd test-app');
    expect(output).toContain('npm install');
    expect(output).toContain('convoai dev');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run build && npx vitest run tests/commands/init.test.ts`
Expected: FAIL (command not registered yet)

- [ ] **Step 3: Implement init command**

```typescript
// src/commands/init.ts
import { Command } from 'commander';
import { cpSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findStarterDir(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'src', 'starters', 'web');
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    dir = dirname(dir);
  }
  throw new Error('Could not find starter template. Reinstall the package: npm install -g convoai');
}

function loadCliConfig(): Record<string, any> {
  try {
    const homedir = process.env.HOME || process.env.USERPROFILE || '';
    const configPath = join(homedir, '.config', 'convoai', '.convoai.json');
    if (!existsSync(configPath)) return {};
    const raw = require('node:fs').readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function generateEnv(config: Record<string, any>): string {
  const profile = config.profiles?.default ?? config.profiles?.[config.default_profile ?? ''] ?? {};

  const lines: string[] = [
    '# Agora Credentials',
    `AGORA_APP_ID=${config.app_id ?? ''}`,
    `AGORA_APP_CERTIFICATE=${config.app_certificate ?? ''}`,
    `AGORA_CUSTOMER_ID=${config.customer_id ?? ''}`,
    `AGORA_CUSTOMER_SECRET=${config.customer_secret ?? ''}`,
    '',
    `# Region: "global" or "cn"`,
    `AGORA_REGION=${config.region ?? 'global'}`,
    '',
    '# LLM Configuration',
    `LLM_VENDOR=${profile.llm?.vendor ?? ''}`,
    `LLM_MODEL=${profile.llm?.params?.model ?? profile.llm?.model ?? ''}`,
    `LLM_API_KEY=${profile.llm?.api_key ?? ''}`,
    `LLM_URL=${profile.llm?.url ?? ''}`,
    `LLM_STYLE=${profile.llm?.style ?? ''}`,
    '',
    '# TTS Configuration',
    `TTS_VENDOR=${profile.tts?.vendor ?? ''}`,
    `TTS_API_KEY=${profile.tts?.params?.key ?? ''}`,
    '',
    '# ASR Configuration',
    `ASR_VENDOR=${profile.asr?.vendor ?? 'ares'}`,
    `ASR_LANGUAGE=${profile.asr?.language ?? 'en-US'}`,
  ];

  return lines.join('\n') + '\n';
}

export function registerInit(program: Command): void {
  program
    .command('init [project-name]')
    .description('Create a new ConvoAI starter project')
    .action(async (projectName?: string) => {
      const name = projectName || 'my-convoai-app';
      const targetDir = join(process.cwd(), name);

      // 1. Check target directory
      if (existsSync(targetDir)) {
        try {
          const entries = readdirSync(targetDir);
          if (entries.length > 0) {
            console.error(chalk.red(`\n  Error: Directory "${name}" already exists and is not empty.\n`));
            process.exit(1);
          }
        } catch {
          console.error(chalk.red(`\n  Error: Cannot read directory "${name}".\n`));
          process.exit(1);
        }
      }

      // 2. Find and copy template
      try {
        const starterDir = findStarterDir();
        cpSync(starterDir, targetDir, { recursive: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(chalk.red(`\n  Error: ${msg}\n`));
        process.exit(1);
      }

      // 3. Generate .env from CLI config
      const config = loadCliConfig();
      const envContent = generateEnv(config);
      writeFileSync(join(targetDir, '.env'), envContent, 'utf-8');

      // 4. Update package name in starter's package.json
      try {
        const pkgPath = join(targetDir, 'package.json');
        const pkg = JSON.parse(require('node:fs').readFileSync(pkgPath, 'utf-8'));
        pkg.name = name;
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      } catch { /* non-critical */ }

      // 5. Print success
      const hasCredentials = !!(config.app_id && config.customer_id);

      console.log('');
      console.log(chalk.green(`  ✓ Project created: ${name}/`));
      console.log('');

      if (!hasCredentials) {
        console.log(chalk.yellow('  ⚠ No Agora credentials found.'));
        console.log(chalk.yellow('  Run "convoai quickstart" first, or edit .env manually.'));
        console.log('');
      }

      console.log(chalk.bold('  Next steps:'));
      console.log(chalk.cyan(`    cd ${name}`));
      console.log(chalk.cyan('    npm install'));
      console.log(chalk.cyan('    convoai dev'));
      console.log('');
      console.log(chalk.dim('  Project structure:'));
      console.log(chalk.dim('    frontend/       ← customize your UI'));
      console.log(chalk.dim('    server/         ← add your business logic'));
      console.log(chalk.dim('    python-server/  ← alternative Python server'));
      console.log('');
    });
}
```

- [ ] **Step 4: Build and run tests**

Run: `npm run build && npx vitest run tests/commands/init.test.ts`
Expected: PASS (most tests — registration test will still fail until Task 11)

- [ ] **Step 5: Commit**

```bash
git add tests/commands/init.test.ts src/commands/init.ts
git commit -m "feat: convoai init command with tests"
```

---

### Task 10: CLI `dev` command (TDD)

**Files:**
- Create: `tests/commands/dev.test.ts`
- Create: `src/commands/dev.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/commands/dev.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const CLI = join(process.cwd(), 'dist/bin/convoai.js');

function cli(args: string, cwd?: string): string {
  try {
    return execSync(`node ${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
      cwd: cwd || process.cwd(),
    });
  } catch (err: any) {
    return err.stdout || err.stderr || '';
  }
}

describe('convoai dev', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'convoai-dev-'));
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('shows help with --help', () => {
    const output = cli('dev --help');
    expect(output).toContain('starter');
  });

  it('errors when not in a starter project directory', () => {
    const output = cli('dev', tempDir);
    expect(output.toLowerCase()).toMatch(/not.*starter|not.*convoai/i);
  });

  it('errors when package.json exists but missing convoai-starter marker', () => {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));
    const output = cli('dev', tempDir);
    expect(output.toLowerCase()).toMatch(/not.*starter|not.*convoai/i);
  });

  it('errors when node_modules is missing', () => {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ 'convoai-starter': true }));
    const output = cli('dev', tempDir);
    expect(output.toLowerCase()).toMatch(/npm install/i);
  });

  it('detects valid starter project', () => {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      'convoai-starter': true,
      scripts: { dev: 'echo ok' },
    }));
    mkdirSync(join(tempDir, 'node_modules'));
    // The spawn will fail quickly since there's no real server, but it should attempt to run
    const output = cli('dev', tempDir);
    // Should NOT contain the "not a starter" error
    expect(output.toLowerCase()).not.toMatch(/not.*starter/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run build && npx vitest run tests/commands/dev.test.ts`
Expected: FAIL (command not registered yet)

- [ ] **Step 3: Implement dev command**

```typescript
// src/commands/dev.ts
import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import chalk from 'chalk';

export function registerDev(program: Command): void {
  program
    .command('dev')
    .description('Start the ConvoAI starter dev server')
    .action(async () => {
      const cwd = process.cwd();
      const pkgPath = join(cwd, 'package.json');

      // 1. Check for package.json with convoai-starter marker
      if (!existsSync(pkgPath)) {
        console.error(chalk.red('\n  Error: No package.json found in current directory.'));
        console.error(chalk.dim('  This is not a ConvoAI starter project.'));
        console.error(chalk.dim('  Run: convoai init <name>\n'));
        process.exit(1);
      }

      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (!pkg['convoai-starter']) {
          console.error(chalk.red('\n  Error: This is not a ConvoAI starter project.'));
          console.error(chalk.dim('  Run: convoai init <name>\n'));
          process.exit(1);
        }
      } catch {
        console.error(chalk.red('\n  Error: Invalid package.json.\n'));
        process.exit(1);
      }

      // 2. Check node_modules exists
      if (!existsSync(join(cwd, 'node_modules'))) {
        console.error(chalk.red('\n  Error: Dependencies not installed.'));
        console.error(chalk.cyan('  Run: npm install\n'));
        process.exit(1);
      }

      // 3. Delegate to npm run dev
      const child = spawn('npm', ['run', 'dev'], {
        stdio: 'inherit',
        cwd,
        shell: true,
      });

      child.on('close', (code) => {
        process.exit(code ?? 0);
      });
    });
}
```

- [ ] **Step 4: Build and run tests**

Run: `npm run build && npx vitest run tests/commands/dev.test.ts`
Expected: PASS (most tests — registration test will still fail until Task 11)

- [ ] **Step 5: Commit**

```bash
git add tests/commands/dev.test.ts src/commands/dev.ts
git commit -m "feat: convoai dev command with tests"
```

---

### Task 11: CLI registration and packaging

**Files:**
- Modify: `src/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Add imports to src/index.ts**

Add these two import lines after the existing Go import (line 54):

```typescript
// ─── Init ────────────────────────────────────────────────────────────────────
import { registerInit } from './commands/init.js';

// ─── Dev ─────────────────────────────────────────────────────────────────────
import { registerDev } from './commands/dev.js';
```

- [ ] **Step 2: Register commands in src/index.ts**

Add these two lines after `registerGo(program);` (around line 255) and before `registerOpenClaw(program);`:

```typescript
  // ── init ───────────────────────────────────────────────────────────────
  registerInit(program);

  // ── dev ────────────────────────────────────────────────────────────────
  registerDev(program);
```

- [ ] **Step 3: Update help text in customHelp()**

In the `customHelp()` function, add `init` and `dev` to the "Start" group. After the `go` line and before `quickstart`:

```typescript
  lines.push(`  ${chalk.cyan('init')}              ${chalk.dim('Create a new starter project')}`);
  lines.push(`  ${chalk.cyan('dev')}               ${chalk.dim('Start starter dev server')}`);
```

Also add init example to the Examples section:

```typescript
  lines.push(chalk.dim('  convoai init my-app                        Create a new project'));
```

- [ ] **Step 4: Add src/starters to package.json files array**

In the root `package.json`, update the `"files"` array from:

```json
"files": [
  "dist",
  "bin",
  "src/web",
  "README.md",
  "LICENSE"
]
```

to:

```json
"files": [
  "dist",
  "bin",
  "src/web",
  "src/starters",
  "README.md",
  "LICENSE"
]
```

- [ ] **Step 5: Build and run all tests**

Run: `npm run build && npm test`
Expected: All existing tests pass + new init and dev tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts package.json
git commit -m "feat: register init + dev commands, add starters to npm package"
```

---

### Task 12: Build, full test run, and verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass (existing 487 + new init and dev tests).

- [ ] **Step 3: Verify CLI help shows new commands**

Run: `node dist/bin/convoai.js --help`
Expected: Output includes `init`, `dev` in the Start group.

- [ ] **Step 4: Verify init creates project**

```bash
cd /tmp
node /path/to/convoai-cli/dist/bin/convoai.js init test-verify
ls -la test-verify/
ls -la test-verify/frontend/
ls -la test-verify/server/
ls -la test-verify/python-server/
cat test-verify/.env
cat test-verify/package.json
rm -rf test-verify
```

Expected: All directories and files exist. `.env` contains credentials from CLI config (or empty if not configured). `package.json` has `"convoai-starter": true` and `"name": "test-verify"`.

- [ ] **Step 5: Verify dev detection**

```bash
cd /tmp && mkdir dev-test && cd dev-test
node /path/to/convoai-cli/dist/bin/convoai.js dev
```

Expected: Error message about "not a ConvoAI starter project".

- [ ] **Step 6: Commit verification results**

No commit needed — this is a manual verification step.

---

## Self-Review

### Spec Coverage Check

| Spec Section | Covered By |
|-------------|-----------|
| 1.1 convoai init | Task 9, 11 |
| 1.2 convoai dev | Task 10, 11 |
| 1.3 Unchanged commands | Not modified — verified in Task 12 |
| 1.4 Command positioning | Task 11 (help text) |
| 1.5 Help text update | Task 11 |
| 2. Starter structure | Tasks 1-8 |
| 3. Frontend design | Task 5 |
| 4. Server design | Tasks 2-4, 6 |
| 5. Python server | Task 7 |
| 6. Connector extension | Task 8 |
| 7. NPM download growth | Tasks 1 (agora-rtc-sdk-ng dep), 4 (SDK serving) |
| 8. Documentation | Task 8 |
| 9. Files changed | All tasks |
| 10. Acceptance criteria | Task 12 |

### Placeholder Scan

No TBD, TODO, "implement later", or "similar to Task N" found.

### Type Consistency

- `StartAgentConfig` and `StartAgentResult` defined in Task 2, used in Task 3 (session.ts) — consistent.
- `generateToken` defined in Task 2, used in Tasks 3 (token.ts) and 6 (server history route) — consistent.
- `getHistory` defined in Task 2, used in Task 6 — consistent.
- `registerInit` defined in Task 9, imported in Task 11 — consistent.
- `registerDev` defined in Task 10, imported in Task 11 — consistent.
