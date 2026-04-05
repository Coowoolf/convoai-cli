# ConvoAI CLI v1.6.0 — Release Notes

> **From CLI Tool to Developer Platform.**

```bash
npm install -g convoai
convoai init my-app && cd my-app && npm install && convoai dev
```

---

## Highlights

### Developer Platform: `convoai init` + `convoai dev`

Scaffold a complete Web starter project with one command. Three-layer architecture (Frontend / Customer Server / ConvoAI Engine) with clear separation.

```bash
convoai init my-app    # Creates project with all files + credentials
cd my-app && npm install
convoai dev            # Starts server, auto-opens browser
```

**What you get:**
- `frontend/` — Dark geek UI (Happy Hues #4), voice conversation, real-time subtitles, mic/mute, interrupt
- `server/` — Express + TypeScript, direct Agora REST API calls, token generation, webhook placeholders
- `python-server/` — FastAPI alternative with pure Python token builder, same API routes
- `connectors/` — Architecture docs for future Telephony / IoT / Text extensions

### Inline Credential Setup

`convoai init` auto-detects if you have Agora credentials. If not, it runs an inline wizard (Platform, Agora keys, LLM provider, TTS provider) — no need to run `quickstart` separately.

### Agora RTC SDK via NPM

Switched from CDN `<script>` to npm package `agora-rtc-sdk-ng`. Every `npm install -g convoai` and every `npm install` in a starter project counts as an npm download.

### Real-time User Subtitles

DataStream-based transcription shows what you're saying in real-time (partial + final). Agent responses via history API fallback.

---

## New Commands

| Command | Description |
|---------|-------------|
| `convoai init [name]` | Create a new starter project (defaults to `my-convoai-app`) |
| `convoai dev` | Start the starter's dev server (delegates to `npm run dev`) |

## Improvements

- **Port conflict detection** — `convoai dev` checks the configured PORT before starting, shows clear error
- **Windows compatibility** — `convoai dev` uses `shell: true` on Windows for `npm.cmd`
- **Gemini URL resolution** — `{model}` and `{api_key}` placeholders resolved during init
- **TTS provider params** — MiniMax group_id, Microsoft region/voice, OpenAI api_key all handled correctly
- **Credential validation** — Session start returns 503 with clear message when .env is empty
- **SDK resolve fix** — `require.resolve('agora-rtc-sdk-ng')` instead of blocked subpath

## Stats

| Metric | Value |
|--------|-------|
| Source files | 77 |
| Source code | ~13,000 lines |
| Starter template | 20 files, ~1,600 lines |
| Test files | 41 |
| Tests passing | 507 / 507 |
| npm dependencies | agora-rtc-sdk-ng, agora-token, + 9 more |

---

*Built with Claude Code (Opus 4.6)*
