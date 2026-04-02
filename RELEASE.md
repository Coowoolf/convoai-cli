# ConvoAI CLI v1.2.1 — Release Notes

> **⚡🐦 Voice AI in your terminal. One command to talk to AI.**

```bash
curl -fsSL https://convobench.org/install.sh | bash
```

---

## Highlights

### One-Liner Install
```bash
curl -fsSL https://convobench.org/install.sh | bash
```
Detects Node.js, installs the CLI, launches a 6-step quickstart wizard. From zero to voice conversation in under 3 minutes.

### Terminal Voice Chat (`convoai chat`)
Talk to AI agents directly in the terminal — no browser needed. Uses headless Chrome for audio I/O, displays real-time conversation with inline latency metrics.

```bash
convoai chat -c my-room
```

### OpenClaw Integration (`convoai openclaw`)
Voice-enable your local [OpenClaw](https://openclaw.ai) assistant. Speak to OpenClaw instead of typing — powered by an auto-provisioned ngrok tunnel.

```bash
convoai openclaw
```

### 30+ Supported Providers
| Type | Count | Providers |
|------|-------|-----------|
| LLM | 10 | Alibaba Qwen, DeepSeek, OpenAI, Groq, Anthropic Claude, Google Gemini, Azure OpenAI, Amazon Bedrock, Dify, Custom |
| TTS | 12 | ElevenLabs, Microsoft Azure, MiniMax, OpenAI, Cartesia, Hume AI, Rime, Fish Audio, Google, Amazon Polly, Murf, Sarvam |
| ASR | 9 | ARES (built-in), Microsoft Azure, Deepgram, OpenAI Whisper, Speechmatics, AssemblyAI, Amazon Transcribe, Google, Sarvam |
| Languages | 24 | Chinese, English, Japanese, Korean, French, German, Spanish, Russian, Hindi, Arabic, and 14 more |

### Live Dashboard
Real-time analytics at [convobench.org/dashboard](https://convobench.org/dashboard) — quickstart funnel, step timing, session tracking, error breakdown. Powered by Upstash Redis.

---

## All Commands

### Core
| Command | Description |
|---------|-------------|
| `convoai quickstart` | Full guided setup: credentials → LLM → TTS → ASR → voice chat |
| `convoai chat -c <channel>` | Voice chat in terminal (no browser) |
| `convoai agent join -c <channel>` | Voice chat via browser |
| `convoai openclaw` | Voice-enable local OpenClaw assistant |

### Agent Management
| Command | Description |
|---------|-------------|
| `convoai agent start` | Start an agent (API only) |
| `convoai agent stop <id>` | Stop an agent |
| `convoai agent stop --all` | Stop all running agents |
| `convoai agent status <id>` | Query agent status |
| `convoai agent list` | List running agents |
| `convoai agent update <id>` | Update agent config |
| `convoai agent speak <id> <text>` | Make agent speak |
| `convoai agent interrupt <id>` | Interrupt agent speech |
| `convoai agent history <id>` | View conversation history |
| `convoai agent turns <id>` | View turn-level latency analytics |
| `convoai agent watch <id>` | Real-time monitoring dashboard |

### Configuration
| Command | Description |
|---------|-------------|
| `convoai config init` | Interactive config wizard |
| `convoai config set <key> <value>` | Set config value |
| `convoai config get <key>` | Get config value |
| `convoai config show` | Show full config |
| `convoai config path` | Print config file path |
| `convoai auth login` | Configure credentials |
| `convoai auth status` | Check connection |

### Templates & Presets
| Command | Description |
|---------|-------------|
| `convoai preset list` | List built-in presets |
| `convoai preset use <name>` | Apply a preset |
| `convoai template save <name>` | Save agent config as template |
| `convoai template list` | List saved templates |
| `convoai template use <name>` | Start agent from template |

### Telephony (Beta)
| Command | Description |
|---------|-------------|
| `convoai call initiate` | Start outbound phone call |
| `convoai call hangup <id>` | Hang up call |
| `convoai call status <id>` | Get call status |

### Utilities
| Command | Description |
|---------|-------------|
| `convoai token -c <channel>` | Generate RTC token |
| `convoai completion install` | Install shell completions |
| `convoai repl` | Interactive shell |

---

## Architecture

```
Developer Terminal
    │
    ├── convoai CLI (Node.js / TypeScript)
    │     ├── Config Manager (~/.config/convoai/)
    │     ├── Token Generator (agora-token)
    │     ├── REST API Client → Agora ConvoAI Engine
    │     ├── Telemetry → convobench.org/api/t
    │     └── Local HTTP Server → Browser/Headless Voice Client
    │
    ├── Browser Mode (Agora Web SDK 4.22.0)
    │     └── Microphone → RTC Channel ↔ ConvoAI Agent
    │
    ├── Terminal Mode (puppeteer-core + system Chrome)
    │     └── Headless browser handles WebRTC, terminal shows conversation
    │
    └── OpenClaw Mode (ngrok tunnel)
          └── ASR → ngrok → local OpenClaw bridge → TTS
```

---

## Config Hierarchy

```
CLI flags > Environment variables > Project .convoai.json > Profile > Base config
```

**Environment variables:** `CONVOAI_APP_ID`, `CONVOAI_CUSTOMER_ID`, `CONVOAI_CUSTOMER_SECRET`, `CONVOAI_BASE_URL`, `CONVOAI_REGION`

---

## Quality

| Metric | Value |
|--------|-------|
| TypeScript | Strict mode, zero errors |
| Tests | 448 passing / 35 files |
| Security | Config 0600, dir 0700, template name validation, no PII telemetry |
| Vendor validation | All 31 providers verified against official docs |
| Error messages | Friendly diagnosis + actionable repair hints for all error codes |

---

## Links

- **npm:** https://www.npmjs.com/package/convoai
- **GitHub:** https://github.com/Coowoolf/convoai-cli
- **Dashboard:** https://convobench.org/dashboard
- **Install script:** https://convobench.org/install.sh
- **Product docs:** [PRODUCT.md](./PRODUCT.md)

---

## What's Next

- **ConvoBench:** Automated voice agent quality benchmarking
- **OpenClaw PR:** Native voice channel for OpenClaw
- **Session Report:** Post-conversation latency analysis in terminal
- **Agent personas:** Community-shared voice agent personalities

---

*Built with ⚡🐦 by the ConvoAI CLI team.*
