# ConvoAI CLI v1.8.0 — Release Notes

> **Phone Go: One-Command Phone Experience**

```bash
npm install -g convoai
convoai phone go
```

---

## Highlights

### Phone Go �� Translate, Agent, or Free Call

One command, three modes, live browser dashboard:

```bash
convoai phone go
```

```
📞 ConvoAI Phone

? Choose a mode:
  ❯ 🌐 Translate Call — real-time translation, each side speaks their own language
    🤖 Agent Outbound — AI completes a task autonomously
    📱 Free Call — quick dial with optional AI assistance
```

### Translate Call

Each side speaks their own language. Real-time translation via ASR → LLM → TTS pipeline.

```bash
convoai phone go --mode translate --lang zh:ja --to +81312345678
```

16 languages supported: Chinese, English, Japanese, Korean, Spanish, French, German, Portuguese, Russian, Arabic, Hindi, Thai, Vietnamese, Italian, Turkish, Indonesian.

### Agent Outbound

Describe a task. The AI agent calls and completes it autonomously.

```bash
convoai phone go --mode agent --task "Book dinner for 2 at 7pm tomorrow" --task-lang ja --to +81312345678
```

### Live Dashboard

Every call opens a browser dashboard at `localhost:3211` showing:
- Call status and duration timer
- Mode-specific UI (split-panel for translate, task display for agent)
- Hang Up button
- Real-time updates via Server-Sent Events

### Voice Profile Interface

Placeholder for future voice cloning integration. Config now accepts `voice_profile` with `provider` and `voice_id` fields. Implementation deferred — interface ready for provider integration.

---

## New Commands

| Command | Description |
|---------|-------------|
| `phone go` | One-command phone experience (translate / agent / free) |
| `phone go --mode translate` | Real-time translation call |
| `phone go --mode agent` | AI agent outbound call |
| `phone go --mode free` | Quick dial with AI |
| `phone go --no-dashboard` | CLI-only, no browser |
| `phone go --dry-run` | Preview API request |

## All Phone Go Flags

| Flag | Description |
|------|-------------|
| `--mode <mode>` | Skip mode selection (translate\|agent\|free) |
| `--to <number>` | Target phone number (E.164) |
| `--from <number>` | Caller ID (E.164) |
| `--lang <pair>` | Language pair, e.g. "zh:ja" (translate mode) |
| `--task <prompt>` | Task description (agent/free mode) |
| `--task-lang <lang>` | Language for agent to speak |
| `--no-dashboard` | Skip browser dashboard |
| `--profile <name>` | Config profile |
| `--json` | JSON output, no dashboard |
| `--dry-run` | Show request payload without calling |

## Internal Improvements

- Extracted shared call-building helpers (`buildChannelName`, `buildCallRequest`, `buildTTSConfig`) from `phone send`
- Dashboard server binds to `127.0.0.1` only (secure by default)
- Mode validation rejects invalid `--mode` values
- Graceful SIGINT cleanup without `process.exit`

## Stats

| Metric | Value |
|--------|-------|
| New files | 6 source + 4 test |
| Source code | ~16,000 lines |
| Tests | 542 / 542 |
| npm | [convoai@1.8.0](https://www.npmjs.com/package/convoai) |

---

*Built with Claude Code (Opus 4.6)*
