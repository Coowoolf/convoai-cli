# Phone Go: One-Command Phone Experience

**Date:** 2026-04-09
**Version:** v1.8.0
**Status:** Draft
**Inspiration:** [Tuwa.ai](http://tuwa.ai) — AI phone network with real-time translation and agent outbound

## Overview

`convoai phone go` provides a zero-config, one-command phone experience for developers. After quickstart or minimal setup, developers can immediately make translated calls, dispatch AI agents for tasks, or place simple outbound calls — all with a live browser dashboard.

This is the telephony equivalent of `convoai go` for voice chat.

## Goals

1. One-liner phone experience: `convoai phone go` → choose mode → call active
2. Three modes: Translate Call, Agent Outbound, Free Call
3. Live browser dashboard showing call status, translation text, and controls
4. Reuse existing phone infrastructure (API client, helpers, phone send logic)
5. Leave voice profile interface for future voice cloning integration

## Non-Goals

- Voice cloning implementation (interface only, implementation deferred)
- E2E realtime audio models (stay on ASR→LLM→TTS pipeline)
- Persistent phone session / multi-call management
- Inbound call handling

---

## Command Interface

```
convoai phone go [options]

Options:
  --mode <mode>         Skip mode selection (translate|agent|free)
  --to <number>         Target phone number (E.164)
  --from <number>       Caller ID (E.164)
  --lang <pair>         Language pair, e.g. "zh:ja" (translate mode)
  --task <prompt>       Task description (agent mode)
  --task-lang <lang>    Language for agent to speak (agent mode)
  --no-dashboard        Skip browser dashboard
  --profile <name>      Config profile
  --json                JSON output, no dashboard, no interactive prompts
  --dry-run             Show request payload without calling
```

All options are optional. Without flags, the command runs fully interactive.

---

## Interactive Flow

### Mode Selection

```
$ convoai phone go

📞 ConvoAI Phone

? Choose a mode:
  ❯ 🌐 Translate Call — real-time translation, each side speaks their own language
    🤖 Agent Outbound — AI completes a task autonomously (reservations, confirmations, etc.)
    📱 Free Call — quick dial with optional AI assistance
```

### Translate Call Mode

```
? Your language: (auto-detect / select from list)
? Target language: (select from list)
? Phone number to call: +81 ...
? Your caller ID: (pick from imported numbers / inline import)

🚀 Starting translated call...
📊 Dashboard: http://localhost:3211/phone
📞 Call active [zh → ja] — 00:00:12 — Press Ctrl+C to hang up
```

**Parameter collection:**
1. Source language — select or auto-detect
2. Target language — select from supported list
3. Target phone number — E.164 input with validation
4. Caller ID — pick from imported numbers; if none exist, trigger inline `phone import` wizard

**API request construction:**
- ASR configured for source language
- LLM system prompt: translation instruction (translate from source to target, preserve meaning, conversational tone)
- TTS configured for target language and appropriate voice
- Translation parameters passed to Agora ConvoAI Engine backend

### Agent Outbound Mode

```
? Describe the task: Book a dinner reservation for 2 at 7pm tomorrow
? Phone number to call: +81 ...
? Your caller ID: (pick)
? Language to speak: Japanese

🚀 Dispatching agent...
📊 Dashboard: http://localhost:3211/phone
🤖 Agent active — 00:00:08 — Press Ctrl+C to hang up
```

**Parameter collection:**
1. Task description — free-form text, used as LLM system prompt
2. Target phone number
3. Caller ID
4. Agent language — language the agent speaks on the call

**API request construction:**
- ASR configured for agent language
- LLM system prompt: task-oriented (include task description, completion criteria)
- TTS configured for agent language
- Idle timeout adjusted based on task complexity

### Free Call Mode

```
? Phone number to call: +1 ...
? Your caller ID: (pick)
? Anything to tell the agent? (optional): Help me navigate the call menu

🚀 Starting call...
📊 Dashboard: http://localhost:3211/phone
📞 Call active — 00:00:05 — Press Ctrl+C to hang up
```

**Parameter collection:**
1. Target phone number
2. Caller ID
3. Optional task prompt

This is a simplified `phone send` — same API call, friendlier UX.

---

## Dashboard

### Architecture

```
CLI (phone go)
  ├─ Starts local HTTP server on port 3211
  ├─ Serves phone-dashboard.html (single file)
  ├─ SSE endpoint: GET /events
  │   └─ Pushes: status, duration, transcript lines, mode info
  ├─ Control endpoint: POST /hangup
  │   └─ Calls Agora API: POST /agents/{agentId}/leave
  └─ Opens browser automatically (reuse find-chrome logic)

Dashboard (browser)
  ├─ Connects to SSE stream
  ├─ Renders mode-specific UI
  ├─ Hang Up button → POST /hangup
  └─ Auto-closes when call ends
```

### UI Layout

**Translate Mode:**
- Split-panel: left side = your language transcript, right side = their language transcript
- Real-time text updates via SSE
- Mode indicator, status badge, duration timer
- Hang Up button

**Agent Mode:**
- Task description display
- Single transcript panel (agent's conversation)
- Task status indicator (in-progress / completed / failed)
- Duration timer, Hang Up button

**Free Call Mode:**
- Single transcript panel
- Status, duration, Hang Up

### Technical Details

- Single HTML file: `src/web/phone-dashboard.html`
- No build step, no dependencies — vanilla HTML/CSS/JS
- SSE for server→browser updates (simpler than WebSocket, sufficient for one-way push)
- Default port: 3211 (avoids conflict with `convoai go` on 3210)
- Port conflict: auto-increment 3211→3220
- Dashboard server managed by `src/commands/phone/_dashboard.ts`

---

## Code Structure

### New Files

```
src/commands/phone/
  ├── go.ts              — Main entry: mode selection, orchestration, lifecycle
  ├── _modes/
  │   ├── translate.ts   — Translate mode: language pair collection, API config
  │   ├── agent.ts       — Agent mode: task collection, API config
  │   └── free.ts        — Free call mode: simplified phone send
  └── _dashboard.ts      — Dashboard HTTP server, SSE, hangup endpoint

src/web/
  └── phone-dashboard.html  — Browser dashboard (single file)
```

### Modified Files

```
src/commands/phone/index.ts  — Register `go` subcommand
src/commands/phone/send.ts   — Extract shared call-building logic into reusable functions
src/commands/phone/_helpers.ts — Add shared utilities if needed
src/api/types.ts             — Add TranslateConfig, VoiceProfile types
src/config/schema.ts         — Add voice_profile optional field
src/commands/completion.ts   — Add phone go completions
```

### Reuse Map

| Existing Code | Reused By |
|---------------|-----------|
| `_helpers.ts` → E.164 validation | All modes |
| `_helpers.ts` → `pickOutboundNumber()` | All modes |
| `_helpers.ts` → `getCallAPI()` | All modes |
| `send.ts` → token generation (agent uid=0, SIP uid=1) | Extracted to shared function |
| `send.ts` → `SendCallRequest` construction | Extracted to shared function |
| `send.ts` → `--wait` polling logic | Dashboard SSE polling |
| `serve.ts` → HTTP server pattern | Dashboard server |
| `find-chrome.ts` → browser launch | Dashboard auto-open |
| Presets → LLM/TTS/ASR config | Mode-specific config building |

---

## Voice Profile Interface (Deferred)

Data structure reserved for future voice cloning integration. No implementation in v1.8.

```typescript
// src/api/types.ts
interface VoiceProfile {
  id?: string;
  provider?: string;       // e.g., 'elevenlabs', 'playht'
  voice_id?: string;       // Provider-specific voice identifier
}

// src/config/schema.ts — added to config schema as optional
voice_profile?: VoiceProfile;
```

**Integration point:** When building TTS config for any mode, check for voice profile:

```typescript
function buildTTSConfig(config: ConvoAIConfig, voiceProfile?: VoiceProfile) {
  const tts = { ...resolveTTS(config) };
  if (voiceProfile?.voice_id) {
    tts.params = { ...tts.params, voice: voiceProfile.voice_id };
  }
  return tts;
}
```

Implementation details to be provided via separate documentation.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No imported phone numbers | Trigger inline `phone import` wizard (existing pattern from `phone send`) |
| Agora API rejects translate params | Degrade to single-language call, print warning |
| Dashboard port 3211 occupied | Auto-try ports 3211–3220 |
| Ctrl+C during active call | Call hangup API first, then exit cleanly |
| Non-TTY environment (CI/scripts) | Require all params via flags, skip interactive prompts |
| `--json` flag | No dashboard, no interactive prompts, output JSON status |
| `--no-dashboard` flag | CLI-only status display, no browser |
| Call fails to connect | Print error with hint, suggest checking number/SIP config |
| SSE connection lost in browser | Auto-reconnect with backoff |

---

## CLI Flag Compatibility

Non-interactive usage for scripting/CI:

```bash
# Translate call
convoai phone go --mode translate --lang zh:ja --to +81... --from +1... --no-dashboard --json

# Agent outbound
convoai phone go --mode agent --task "Book dinner for 2 at 7pm" --task-lang ja --to +81... --from +1... --json

# Free call
convoai phone go --mode free --to +1... --from +1... --json
```

---

## Testing Strategy

- **Unit tests:** Each mode module (translate, agent, free) — parameter validation, API request construction
- **Unit tests:** Dashboard server — SSE event formatting, port selection, hangup endpoint
- **Unit tests:** go.ts — mode routing, flag parsing, lifecycle management
- **Integration tests:** End-to-end flow with mocked Agora API
- **Existing test patterns:** Follow vitest structure from `phone send` tests
