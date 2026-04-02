# Terminal Voice Chat (`convoai chat`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `convoai chat --channel room1` starts a voice conversation with an AI agent entirely in the terminal — no browser window, real-time transcription displayed inline.

**Architecture:** Use Puppeteer (headless Chromium) to run the Agora Web SDK in the background. The browser is invisible — it handles WebRTC mic/speaker. The terminal shows a live conversation UI: ASR transcriptions and agent responses streamed in real-time via a WebSocket bridge between the headless page and the Node.js process.

**Tech Stack:** Puppeteer (headless browser), Agora Web SDK (inside headless page), WebSocket (page ↔ Node.js bridge), chalk + readline (terminal UI)

---

## File Structure

```
src/
  commands/agent/chat.ts       — `convoai chat` command (terminal UI + orchestration)
  web/chat-client.html         — headless page (Agora WebRTC + WebSocket bridge)
```

Only 2 new files. The existing `join.ts` stays untouched (browser mode preserved).

---

### Task 1: Install Puppeteer dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install puppeteer**

```bash
cd ~/Desktop/convoai-cli
npm install puppeteer
```

Puppeteer bundles Chromium (~170MB). For production, we'll use `puppeteer` (not `puppeteer-core`) so users don't need Chrome installed.

- [ ] **Step 2: Add to package.json files for npm publish**

The `node_modules/.cache/puppeteer` chromium binary is auto-downloaded on `npm install`. No changes needed to `files` field — puppeteer is a dependency, not a bundled file.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add puppeteer for headless voice chat"
```

---

### Task 2: Create the headless chat client HTML

**Files:**
- Create: `src/web/chat-client.html`

This page runs inside headless Chromium. It:
1. Connects to the Node.js process via WebSocket on `ws://localhost:{wsPort}`
2. Joins the Agora RTC channel
3. Publishes microphone audio
4. Receives agent audio and plays it (headless Chrome still outputs audio to system speakers)
5. Sends events to Node.js via WebSocket: `{type: "status", text: "..."}`, `{type: "agent_speaking", speaking: true/false}`

- [ ] **Step 1: Write chat-client.html**

```html
<!DOCTYPE html>
<html>
<head><title>ConvoAI Chat Client</title></head>
<body>
<script src="https://download.agora.io/sdk/release/AgoraRTC_N-4.22.0.js"></script>
<script>
  const P = new URLSearchParams(location.search);
  const appId = P.get('appId');
  const channel = P.get('channel');
  const token = P.get('token') || null;
  const uid = Number(P.get('uid')) || 0;
  const wsPort = P.get('wsPort') || '3211';

  let ws, client, localTrack;

  function send(msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  async function start() {
    // Connect WebSocket to Node.js process
    ws = new WebSocket(`ws://localhost:${wsPort}`);
    ws.onopen = () => send({ type: 'status', text: 'WebSocket connected' });
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'stop') {
        cleanup();
      }
    };

    try {
      client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          user.audioTrack.play();
          send({ type: 'agent_speaking', speaking: true });

          // Monitor volume for visual feedback
          const volInterval = setInterval(() => {
            if (!user.audioTrack) { clearInterval(volInterval); return; }
            const vol = user.audioTrack.getVolumeLevel();
            send({ type: 'volume', level: vol });
          }, 200);
        }
      });

      client.on('user-unpublished', (user, mediaType) => {
        if (mediaType === 'audio') {
          send({ type: 'agent_speaking', speaking: false });
        }
      });

      client.on('user-left', () => {
        send({ type: 'agent_left' });
      });

      send({ type: 'status', text: 'Joining channel...' });
      await client.join(appId, channel, token, uid || null);
      send({ type: 'status', text: 'Joined channel' });

      localTrack = await AgoraRTC.createMicrophoneAudioTrack();
      await client.publish([localTrack]);
      send({ type: 'ready' });

    } catch (err) {
      send({ type: 'error', text: err.message });
    }
  }

  async function cleanup() {
    if (localTrack) { localTrack.stop(); localTrack.close(); }
    if (client) await client.leave();
    send({ type: 'stopped' });
  }

  start();
</script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/web/chat-client.html
git commit -m "feat: headless chat client page for terminal voice chat"
```

---

### Task 3: Create the `convoai chat` command

**Files:**
- Create: `src/commands/agent/chat.ts`

This is the main command. It:
1. Starts the ConvoAI agent (reuses logic from join.ts)
2. Launches headless Puppeteer with chat-client.html
3. Starts a WebSocket server to receive events from the headless page
4. Renders a live terminal UI showing conversation state
5. Polls agent history API periodically to show transcribed messages
6. On Ctrl+C: stops agent, closes browser, exits

- [ ] **Step 1: Write chat.ts**

The command file structure:

```typescript
import { Command } from 'commander';
import { createServer as createHttpServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import chalk from 'chalk';
import type { StartAgentRequest, LLMConfig } from '../../api/types.js';
import { getAgentAPI, formatTimestamp } from './_helpers.js';
import { resolveConfig, loadConfig } from '../../config/manager.js';
import { getPreset } from '../../presets/defaults.js';
import { generateRtcToken } from '../../utils/token.js';
import { withSpinner } from '../../ui/spinner.js';
import { printSuccess, printError } from '../../ui/output.js';
import { printKeyValue } from '../../ui/table.js';
import { handleError } from '../../utils/errors.js';
import { track } from '../../utils/telemetry.js';

// ... (findClientHtml helper — same as join.ts but for chat-client.html)

export function registerAgentChat(program: Command): void {
  program
    .command('chat')
    .description('Voice chat with an AI agent directly in your terminal')
    .requiredOption('-c, --channel <name>', 'Channel name')
    .option('--preset <name>', 'Use a built-in preset')
    .option('--model <model>', 'LLM model name')
    .option('--tts <vendor>', 'TTS vendor')
    .option('--asr <vendor>', 'ASR vendor')
    .option('--system-message <msg>', 'System prompt')
    .option('--greeting <msg>', 'Greeting message')
    .option('--idle-timeout <seconds>', 'Idle timeout', '300')
    .option('--profile <name>', 'Config profile')
    .action(async (opts) => { ... });
}
```

The action function:
1. Build agent request (same logic as join.ts — tokens, LLM merge, greeting)
2. Start agent via API
3. Start HTTP server serving chat-client.html
4. Start WebSocket server on port 3211
5. Launch Puppeteer headless, navigate to `http://localhost:{httpPort}?appId=...&wsPort=3211`
6. Listen for WebSocket messages to update terminal
7. Poll `api.history(agentId)` every 2 seconds to display new messages
8. Render terminal UI with chalk
9. Handle Ctrl+C cleanup

Terminal UI layout:
```
  ⚡🐦 ConvoAI Voice Chat
  ─────────────────────────
  Channel: my-room | Agent: A42AX...

  [assistant] 你好，有什么可以帮你的？
  [you]       今天天气怎么样？
  [assistant] 让我来查一下...

  🎙 Listening... (speak now)
  Press Ctrl+C to exit
```

- [ ] **Step 2: Build and verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/commands/agent/chat.ts
git commit -m "feat: convoai chat command — terminal voice chat via headless browser"
```

---

### Task 4: Register the chat command in index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add import and registration**

Add after the `registerAgentJoin` import:
```typescript
import { registerAgentChat } from './commands/agent/chat.js';
```

Add after `registerAgentJoin(agent)`:
```typescript
registerAgentChat(agent);
```

- [ ] **Step 2: Build and verify**

```bash
npx tsc && node dist/bin/convoai.js agent --help
```

Should show `chat` in the command list.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: register chat command in CLI"
```

---

### Task 5: End-to-end test

- [ ] **Step 1: Build**

```bash
npx tsc
```

- [ ] **Step 2: Test the chat command**

```bash
convoai chat --channel test-chat
```

Expected:
1. Agent starts (spinner)
2. Terminal shows "Voice Chat" UI
3. Headless browser connects (no visible window)
4. Agent greeting plays through speakers
5. User speaks, agent responds (audio through speakers)
6. Conversation appears in terminal as text
7. Ctrl+C stops everything cleanly

- [ ] **Step 3: Run test suite**

```bash
npx vitest run
```

All existing tests should still pass.

- [ ] **Step 4: Publish**

```bash
# bump version, build, publish
```

---

### Task 6: Make `chat` the default for `agent join`

**Files:**
- Modify: `src/commands/agent/join.ts`

- [ ] **Step 1: Add `--browser` flag to join**

Add flag `--browser` to `join` command. When NOT set, default to chat (headless) mode. When `--browser` is set, use the existing browser behavior.

This makes headless the default while preserving browser mode:
- `convoai agent join -c room` → headless terminal chat (new default)
- `convoai agent join -c room --browser` → opens browser (old behavior)

- [ ] **Step 2: Commit and publish**
