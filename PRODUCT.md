# ConvoAI CLI — Product Documentation

> CLI for Agora ConvoAI Engine — start, manage, and monitor conversational AI agents from the terminal.

---

## 1. Product Overview

**ConvoAI CLI** is a command-line tool that lets developers create, manage, and interact with conversational AI voice agents powered by the [Agora ConvoAI Engine](https://www.agora.io). It handles everything from credential management and token generation to launching a browser-based voice chat client — all without leaving the terminal.

**Mascot:** ⚡🐦 Blue Thunderbird

**Version:** 1.7.0  
**License:** MIT  
**Runtime:** Node.js >= 18.0.0

### Install

One-liner (installs Node.js if needed, then launches the quickstart wizard):

```bash
curl -fsSL https://convobench.org/install.sh | bash
```

Via npm:

```bash
npm install -g convoai
```

### Links

| Resource | URL |
|----------|-----|
| GitHub | https://github.com/Coowoolf/convoai-cli |
| npm | https://www.npmjs.com/package/convoai |
| Agora Console (Global) | https://console.agora.io |
| Agora Console (China) | https://console.shengwang.cn |

---

## 2. Quick Start (3 Minutes)

### Option A: One-Liner

```bash
curl -fsSL https://convobench.org/install.sh | bash
```

This script will:
1. Detect your OS (macOS or Linux).
2. Check for Node.js >= 18 and install it via Homebrew (macOS) or NodeSource (Linux) if missing.
3. Install the `convoai` package globally via npm.
4. Automatically launch `convoai quickstart`.

### Option B: Manual

```bash
npm install -g convoai
convoai quickstart
```

### Returning Users

If you already have credentials and providers configured, skip the wizard entirely:

```bash
convoai go
```

This zero-params command starts a voice agent and opens the browser client immediately. Use `convoai go --setup` to re-run guided setup, or `convoai go --model gpt-4o` to override the model for a single session.

### What the Quickstart Wizard Does

The `convoai quickstart` command walks through **6 steps**:

**Step 1 — Agora Credentials**  
Select your platform (Agora.io Global or Shengwang.cn China), then enter your App ID, App Certificate, Customer ID, and Customer Secret. The wizard shows you the console URL where you can find these. If credentials are already saved, this step is skipped.

**Step 2 — LLM (Large Language Model)**  
Choose from 10 LLM providers (Alibaba Qwen, DeepSeek, OpenAI, Groq, Anthropic, Gemini, Azure, Bedrock, Dify, Custom). Enter your API key, select a model, and confirm the API URL. The wizard auto-fills default URLs and model lists per provider.

**Step 3 — TTS (Text-to-Speech)**  
Choose from 12 TTS vendors (ElevenLabs, Microsoft Azure, MiniMax, OpenAI, Cartesia, etc.). Enter your TTS API key. Microsoft Azure additionally prompts for region and voice name.

**Step 4 — ASR (Speech-to-Text)**  
Choose from 9 ASR vendors. ARES (Agora built-in) requires no extra API key. For other vendors, enter an API key. Then select from 24 supported languages.

**Step 5 — Start Voice Agent**  
The CLI generates RTC tokens, sends a start request to the Agora ConvoAI Engine, launches a local HTTP server on port 3210, and opens a browser-based voice chat client. You see the agent ID and channel name, then speak to the AI agent through your microphone.

**Step 6 — Results**  
After you press Enter, the CLI fetches conversation history, displays latency analytics (E2E, ASR, LLM, TTS per turn), shows the final agent status, and stops the agent. It then prints suggested next commands.

---

## 3. Architecture

```
Developer Terminal
    |
    +-- convoai CLI (Node.js)
    |     +-- Config Manager (~/.config/convoai/)
    |     +-- Token Generator (agora-token)
    |     +-- REST API Client --> Agora ConvoAI Engine
    |     +-- Local HTTP Server --> Browser Voice Client
    |
    +-- Browser (Agora Web SDK 4.22.0)
          +-- Microphone --> ASR --> LLM --> TTS --> Speaker
          +-- RTC Channel <--> ConvoAI Agent
```

### Component Details

| Component | Technology | Purpose |
|-----------|-----------|---------|
| CLI framework | Commander.js 12 | Command parsing, help generation |
| Config storage | JSON files (`~/.config/convoai/config.json`) | Credentials, profiles, provider settings |
| Token generation | `agora-token` 2.x | Local RTC token creation from App Certificate |
| HTTP client | Axios 1.7 | REST API calls to Agora ConvoAI Engine |
| Interactive prompts | Inquirer.js 9 | Guided setup wizards |
| Terminal UI | Chalk 5, cli-table3, Ora 8 | Colors, tables, spinners |
| Validation | Zod 3 | Config schema validation |
| Web voice client | Agora Web SDK (AgoraRTC_N-4.22.0) | Browser-based RTC audio, microphone capture |

### Config Resolution Order

Configuration is resolved in this priority (highest wins):

1. **CLI flags** (e.g., `--model gpt-4o`)
2. **Environment variables** (`CONVOAI_APP_ID`, `CONVOAI_CUSTOMER_ID`, etc.)
3. **Project-level** `.convoai.json` in the current working directory
4. **Named profile** in `~/.config/convoai/config.json`
5. **Base config** (top-level fields in `config.json`)

---

## 4. Supported Providers

### LLM Providers (10)

| Provider | ID | Default Model | URL | Notes |
|----------|-----|---------------|-----|-------|
| Alibaba Qwen | `dashscope` | qwen-plus | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | China-optimized, no proxy needed |
| DeepSeek | `deepseek` | deepseek-chat | `https://api.deepseek.com/v1/chat/completions` | China-optimized, great price-performance |
| OpenAI | `openai` | gpt-4o-mini | `https://api.openai.com/v1/chat/completions` | Requires proxy in China |
| Groq | `groq` | llama-3.3-70b-versatile | `https://api.groq.com/openai/v1/chat/completions` | Fast inference, free tier available |
| Anthropic Claude | `anthropic` | claude-3-5-haiku-latest | `https://api.anthropic.com/v1/messages` | Uses `anthropic` style + special headers |
| Google Gemini | `gemini` | gemini-2.0-flash | `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}` | Uses `gemini` style; API key embedded in URL |
| Azure OpenAI | `azure` | gpt-4o-mini | *(user-provided)* | Enter your Azure endpoint URL |
| Amazon Bedrock | `bedrock` | *(user-provided)* | *(user-provided)* | Enter your Bedrock endpoint URL |
| Dify | `dify` | *(user-provided)* | *(user-provided)* | Enter your Dify endpoint URL |
| Custom | `custom` | *(user-provided)* | *(user-provided)* | Any service with OpenAI-compatible API |

**Available models per provider:**

| Provider | Models |
|----------|--------|
| Alibaba Qwen | qwen-plus, qwen-turbo, qwen-max, qwen-long |
| DeepSeek | deepseek-chat, deepseek-reasoner |
| OpenAI | gpt-4o-mini, gpt-4o, gpt-4.1-mini, gpt-4.1 |
| Groq | llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768 |
| Anthropic | claude-3-5-haiku-latest, claude-sonnet-4-20250514 |
| Gemini | gemini-2.0-flash, gemini-2.5-flash, gemini-2.5-pro |
| Azure OpenAI | gpt-4o-mini, gpt-4o |

### TTS Providers (12)

| Provider | Vendor ID | Requires Key | Beta | Notes |
|----------|-----------|:------------:|:----:|-------|
| ElevenLabs | `elevenlabs` | Yes | No | High quality, multilingual |
| Microsoft Azure | `microsoft` | Yes | No | Wide language support; also requires region + voice name |
| MiniMax | `minimax` | Yes | No | — |
| OpenAI TTS | `openai` | Yes | Yes | — |
| Cartesia | `cartesia` | Yes | Yes | — |
| Hume AI | `humeai` | Yes | Yes | — |
| Rime | `rime` | Yes | Yes | — |
| Fish Audio | `fishaudio` | Yes | Yes | — |
| Google TTS | `google` | Yes | Yes | — |
| Amazon Polly | `amazon` | Yes | Yes | — |
| Murf | `murf` | Yes | Yes | — |
| Sarvam | `sarvam` | Yes | Yes | — |

### ASR Providers (9)

| Provider | Vendor ID | Requires Key | Beta | Notes |
|----------|-----------|:------------:|:----:|-------|
| ARES | `ares` | No | No | Agora built-in, no extra API key needed |
| Microsoft Azure | `microsoft` | Yes | No | — |
| Deepgram | `deepgram` | Yes | No | — |
| OpenAI Whisper | `openai` | Yes | Yes | — |
| Speechmatics | `speechmatics` | Yes | No | — |
| AssemblyAI | `assemblyai` | Yes | Yes | — |
| Amazon Transcribe | `amazon` | Yes | Yes | — |
| Google STT | `google` | Yes | Yes | — |
| Sarvam | `sarvam` | Yes | Yes | — |

### ASR Languages (24)

| Language | Code | Language | Code |
|----------|------|----------|------|
| Chinese (Simplified) | `zh-CN` | English (US) | `en-US` |
| Japanese | `ja-JP` | Korean | `ko-KR` |
| French | `fr-FR` | German | `de-DE` |
| Spanish | `es-ES` | Russian | `ru-RU` |
| Hindi | `hi-IN` | Arabic | `ar-SA` |
| Portuguese | `pt-PT` | Italian | `it-IT` |
| Thai | `th-TH` | Turkish | `tr-TR` |
| Vietnamese | `vi-VN` | Indonesian | `id-ID` |
| Malay | `ms-MY` | Dutch | `nl-NL` |
| Filipino | `fil-PH` | Chinese (Hong Kong) | `zh-HK` |
| Chinese (Taiwan) | `zh-TW` | English (India) | `en-IN` |
| Persian | `fa-IR` | Hebrew | `he-IL` |

---

## 5. User Tutorial

### 5.1 First-Time Setup

Run the quickstart wizard:

```bash
convoai quickstart
```

Expected terminal output:

```
  ─────────────────────────────────────────

   ⚡🐦  C O N V O A I

   Voice AI in 2 minutes
   Powered by Agora ConvoAI Engine

  ─────────────────────────────────────────

  [1/6] Agora Credentials
  ──────────────────────────────────────────────
? Where did you sign up? (Use arrow keys)
❯ 声网 Shengwang.cn (中国)
  Agora.io (Global)

  Get your credentials from: https://console.agora.io
  → Project Management → App ID & App Certificate
  → Developer Toolkit → RESTful API → Customer ID & Secret

? App ID: ********************************
? App Certificate: ********************************
? Customer ID (RESTful API): ********************************
? Customer Secret: ********************************
✔ Credentials saved.

  [2/6] LLM (Large Language Model)
  ──────────────────────────────────────────────
  Configure which AI model powers your voice agent

? LLM provider: (Use arrow keys)
❯ Alibaba Qwen — China-optimized, no proxy needed
  DeepSeek — China-optimized, great price-performance
  OpenAI — Requires proxy in China
  ...

? LLM API Key: ********************************
? Model: gpt-4o-mini
? API URL: https://api.openai.com/v1/chat/completions
✔ LLM configured: gpt-4o-mini via OpenAI

  [3/6] TTS (Text-to-Speech)
  ──────────────────────────────────────────────
? TTS vendor: Microsoft Azure
? TTS API Key: ********************************
? Azure TTS Region: eastus
? Voice Name: en-US-AndrewMultilingualNeural
✔ TTS configured: Microsoft Azure

  [4/6] ASR (Speech-to-Text)
  ──────────────────────────────────────────────
? ASR vendor: ARES — Agora built-in, no extra API key needed
? Language: English (US)
✔ ASR configured: ares (en-US)

  [5/6] Start voice agent
  ──────────────────────────────────────────────
⠋ Starting voice agent...
✔ Agent is live!
  Agent ID   abc123def456...
  Channel    quickstart-m1abc2d

  🎙  Voice chat is live!
  Browser opened — allow microphone and start talking.

  Press Enter when done to see results, or Ctrl+C to quit.

  [6/6] Results
  ──────────────────────────────────────────────

  Conversation:
    [assistant] Hello! How can I help you today?
    [user]      What's the weather like?
    [assistant] I'm a voice assistant demo...

  Latency Analytics:
  TYPE    E2E      ASR    LLM    TTS
  voice   1200ms   150ms  800ms  250ms

  Agent ID   abc123def456...
  Status     STOPPED
✔ Agent stopped. Quickstart complete!

  What's next?
  ─────────────────────────────────────
  convoai go                      Instant voice chat (zero params)
  convoai go --model gpt-4o       Override the model
  convoai agent start -c room1    Start agent (API only)
  convoai preset list             See built-in presets
  convoai template save mybot     Save config as template
  convoai --help                  See all commands
```

### 5.2 Starting a Voice Chat Session

The `agent join` command starts an agent and opens a browser-based voice client in one step:

```bash
convoai agent join -c room1
```

Expected output:

```
⠋ Starting agent...
✔ Agent started.
  Agent ID   abc123...
  Channel    room1
  Status     RUNNING

  Voice chat: http://localhost:3210?appId=...&channel=room1&token=...&uid=12345

✔ Browser opened. Allow microphone and start talking!
  Press Ctrl+C to stop the agent and exit.
```

The browser opens a dark-themed voice chat page with a microphone icon, volume bar, and event log. Press Ctrl+C in the terminal to stop the agent and shut down the local server.

Options for customization:

```bash
# Use a preset configuration
convoai agent join -c room1 --preset openai-gpt4o

# Override the model
convoai agent join -c room1 --model gpt-4o

# Custom system prompt
convoai agent join -c room1 --system-message "You are a pirate captain"

# Different port, no auto-open
convoai agent join -c room1 --port 8080 --no-open
```

### 5.3 Managing Agents

**List running agents:**

```bash
convoai agent list
```

```
AGENT_ID        STATUS    CHANNEL       CREATED
abc123...       RUNNING   room1         2 minutes ago
def456...       RUNNING   demo-room     5 minutes ago

Showing 2 of 2 agents
```

**Check a specific agent's status:**

```bash
convoai agent status <agent-id>
```

```
  Agent ID   abc123def456...
  Status     RUNNING
  Channel    room1
  Started    2024-01-15 10:30:00
```

**Stop an agent:**

```bash
convoai agent stop <agent-id>
```

```
⠋ Stopping agent abc123...
✔ Agent abc123... stopped.
```

**Stop all running agents:**

```bash
convoai agent stop --all
```

### 5.4 Viewing Conversation History

```bash
convoai agent history <agent-id>
```

```
Agent: abc123... | Status: STOPPED | Since: 2024-01-15 10:30:00

[user]        Hello, can you help me?
[assistant]   Of course! What would you like to know?
[user]        Tell me about Agora.
[assistant]   Agora is a real-time engagement platform...

4 entries total.
```

Use `--limit 10` to show only the last 10 entries, or `--json` for machine-readable output.

**View turn-level latency analytics:**

```bash
convoai agent turns <agent-id>
```

```
TURN_ID     TYPE    END_REASON   E2E_LATENCY   ASR     LLM     TTS
t-abc1...   voice   completed    1200ms         150ms   800ms   250ms
t-def2...   voice   interrupted  900ms          120ms   600ms   180ms

Avg latency: E2E: 1050ms | ASR: 135ms | LLM: 700ms | TTS: 215ms
```

### 5.5 Using Templates

**Save your current configuration as a reusable template:**

```bash
convoai template save mybot --description "Customer support bot"
```

```
✔ Template "mybot" saved.
  Hint: Run `convoai template use mybot --channel <name>` to start an agent from this template.
```

**List saved templates:**

```bash
convoai template list
```

```
NAME     DESCRIPTION             MODEL          TTS         CREATED
mybot    Customer support bot    gpt-4o-mini    microsoft   Jan 15, 2024
pirate   Pirate voice agent      gpt-4o         elevenlabs  Jan 16, 2024
```

**Start an agent from a template:**

```bash
convoai template use mybot --channel support-room
```

### 5.6 Multi-Profile Setup

Create a separate profile for a staging environment:

```bash
convoai auth login --profile staging
```

The wizard prompts for App ID, Customer ID, Customer Secret, and region, then saves them under the `staging` profile.

**Use the profile:**

```bash
convoai agent start -c test-room --profile staging
convoai agent list --profile staging
convoai config show --profile staging
```

**Check authentication status for a profile:**

```bash
convoai auth status --profile staging
```

```
  Profile           staging
  App ID            abcd1234...
  Customer ID       efgh5678...
  Customer Secret   ijkl****
  Region            global
  Status            ✔ Connected
```

---

## 6. Complete CLI Command Reference

### Global Options

| Flag | Description |
|------|-------------|
| `-v, --version` | Print the CLI version |
| `-h, --help` | Show help for any command |

Aliases: `agent` can also be written as `a`, `config` as `c`, `preset` as `p`, `template` as `t`.

> **Retired in v1.4.0:** The `chat`, `repl`, and `watch` commands have been removed. Use `convoai go` for instant voice chat and the runtime panel for live monitoring.

---

### quickstart

Full guided experience: configure credentials, set up LLM/TTS/ASR, start an agent, voice chat in the browser, and review results.

```
convoai quickstart
```

**Alias:** `convoai qs`

**Flags:** None.

**Example:**

```bash
convoai quickstart
```

The wizard walks through 6 steps interactively. All configuration is saved to `~/.config/convoai/config.json`. The quickstart automatically generates tokens, starts an agent, launches a local web server on port 3210, and opens your browser.

---

### go

Zero-params instant voice chat. Launches a voice agent and opens a browser-based voice client using your saved configuration. If no configuration exists, prompts for setup automatically.

```
convoai go [options]
```

| Flag | Description |
|------|-------------|
| `--setup` | Run the guided setup wizard before starting |
| `--model <model>` | Override the LLM model for this session (e.g. `gpt-4o`, `claude-sonnet-4-20250514`) |

**Example:**

```bash
# Instant voice chat -- zero params
convoai go

# Re-run setup, then start
convoai go --setup

# Override model for this session
convoai go --model gpt-4o
```

**Expected output:**

```
⠋ Starting agent...
✔ Agent is live!
  Agent ID   abc123...
  Channel    go-m1abc2d

  🎙  Voice chat is live!
  Browser opened — allow microphone and start talking.

  Press Enter when done to see results, or Ctrl+C to quit.
```

---

### auth login

Authenticate with the Agora ConvoAI platform. Prompts interactively if flags are omitted.

```
convoai auth login [options]
```

| Flag | Description |
|------|-------------|
| `--app-id <id>` | Agora App ID |
| `--customer-id <id>` | Customer ID (RESTful API) |
| `--customer-secret <secret>` | Customer Secret |
| `--profile <name>` | Save credentials under a named profile |

**Example:**

```bash
# Interactive login
convoai auth login

# Non-interactive login
convoai auth login --app-id abc123 --customer-id cust1 --customer-secret s3cret

# Login to a named profile
convoai auth login --profile staging
```

**Expected output:**

```
⠋ Verifying credentials...
✔ Credentials saved to default profile.
```

---

### auth logout

Remove stored credentials.

```
convoai auth logout [options]
```

| Flag | Description |
|------|-------------|
| `--profile <name>` | Remove a specific named profile |
| `--force` | Skip the confirmation prompt |

**Example:**

```bash
convoai auth logout
convoai auth logout --profile staging --force
```

---

### auth status

Show current authentication status, including a live connectivity check.

```
convoai auth status [options]
```

| Flag | Description |
|------|-------------|
| `--profile <name>` | Show status for a named profile |
| `--json` | Output as JSON |

**Example:**

```bash
convoai auth status
convoai auth status --profile staging --json
```

**Expected output:**

```
  Profile           default
  App ID            abcd1234...
  Customer ID       efgh5678...
  Customer Secret   ijkl****
  Region            global
  Status            ✔ Connected
```

---

### agent start

Start a new conversational AI agent. Prompts interactively for missing required fields when running in a TTY.

```
convoai agent start [options]
```

| Flag | Description |
|------|-------------|
| `-c, --channel <name>` | RTC channel name (required) |
| `-n, --name <name>` | Agent name (auto-generated if omitted) |
| `--preset <name>` | Use a built-in preset configuration |
| `--model <model>` | LLM model name (e.g., `gpt-4o-mini`) |
| `--llm-url <url>` | LLM API URL |
| `--llm-key <key>` | LLM API key |
| `--tts <vendor>` | TTS vendor |
| `--asr <vendor>` | ASR vendor |
| `--system-message <msg>` | System prompt for the LLM |
| `--greeting <msg>` | Greeting message spoken on join |
| `--uid <uid>` | Agent RTC UID (default: `"0"` for random) |
| `--remote-uids <uids>` | Comma-separated remote UIDs (default: `"*"`) |
| `--idle-timeout <seconds>` | Idle timeout in seconds (default: 30) |
| `--token <token>` | RTC token (auto-generated if app_certificate is set) |
| `--profile <name>` | Config profile to use |
| `--json` | Output result as JSON |
| `--dry-run` | Print the request payload without sending it |

**Example:**

```bash
convoai agent start -c my-room
convoai agent start -c my-room --preset openai-gpt4o --model gpt-4o
convoai agent start -c my-room --system-message "You are a helpful tutor" --greeting "Hi there!"
convoai agent start -c my-room --dry-run
```

**Expected output:**

```
⠋ Starting agent...
✔ Agent started successfully.
  Agent ID   abc123def456...
  Status     RUNNING
  Channel    my-room
  Created    2024-01-15 10:30:00
```

---

### agent stop

Stop a running agent, or stop all running agents.

```
convoai agent stop [agent-id] [options]
```

| Flag | Description |
|------|-------------|
| `-a, --all` | Stop all running agents |
| `-f, --force` | Skip confirmation when using `--all` |
| `--profile <name>` | Config profile to use |
| `--json` | Output result as JSON |

**Example:**

```bash
convoai agent stop abc123def456
convoai agent stop --all
convoai agent stop --all --force --json
```

---

### agent status

Query the current status of an agent.

```
convoai agent status <agent-id> [options]
```

| Flag | Description |
|------|-------------|
| `--profile <name>` | Config profile to use |
| `--json` | Output result as JSON |

**Example:**

```bash
convoai agent status abc123def456
```

---

### agent list

List agents, optionally filtered by state or channel.

```
convoai agent list [options]
```

**Alias:** `convoai agent ls`

| Flag | Description |
|------|-------------|
| `-s, --state <state>` | Filter by state: `running`, `stopped`, `failed`, `all` (default: `running`) |
| `-c, --channel <name>` | Filter by channel name |
| `-l, --limit <n>` | Maximum agents to return (default: 20) |
| `--profile <name>` | Config profile to use |
| `--json` | Output result as JSON |

**Example:**

```bash
convoai agent list
convoai agent list --state all --limit 50
convoai agent list --channel my-room --json
```

---

### agent update

Update a running agent's configuration on the fly.

```
convoai agent update <agent-id> [options]
```

| Flag | Description |
|------|-------------|
| `--system-message <msg>` | Update the system prompt |
| `--model <model>` | Update the LLM model |
| `--max-tokens <n>` | Update max tokens |
| `--temperature <n>` | Update temperature |
| `--token <token>` | Update the RTC token |
| `--profile <name>` | Config profile to use |
| `--json` | Output result as JSON |

**Example:**

```bash
convoai agent update abc123 --system-message "You are now a French tutor"
convoai agent update abc123 --model gpt-4o --temperature 0.9
```

---

### agent speak

Instruct an agent to speak given text via TTS.

```
convoai agent speak <agent-id> <text> [options]
```

| Flag | Description |
|------|-------------|
| `--priority <priority>` | Message priority: `INTERRUPT`, `APPEND`, or `IGNORE` (default: `INTERRUPT`) |
| `--no-interrupt` | Prevent user from voice-interrupting this message |
| `--profile <name>` | Config profile to use |
| `--json` | Output result as JSON |

**Example:**

```bash
convoai agent speak abc123 "Welcome to our service!"
convoai agent speak abc123 "Please hold" --priority APPEND --no-interrupt
```

---

### agent interrupt

Interrupt an agent that is currently speaking.

```
convoai agent interrupt <agent-id> [options]
```

| Flag | Description |
|------|-------------|
| `--profile <name>` | Config profile to use |
| `--json` | Output result as JSON |

**Example:**

```bash
convoai agent interrupt abc123
```

---

### agent history

View the conversation history (user and assistant messages) for an agent.

```
convoai agent history <agent-id> [options]
```

| Flag | Description |
|------|-------------|
| `--limit <n>` | Show only the last N entries |
| `--profile <name>` | Config profile to use |
| `--json` | Output result as JSON |

**Example:**

```bash
convoai agent history abc123
convoai agent history abc123 --limit 5 --json
```

---

### agent turns

View turn-level latency analytics for an agent. Shows E2E, ASR, LLM, and TTS latency per conversation turn, plus averages.

```
convoai agent turns <agent-id> [options]
```

| Flag | Description |
|------|-------------|
| `--limit <n>` | Number of turns to show (default: 20) |
| `--profile <name>` | Config profile to use |
| `--json` | Output result as JSON |

**Example:**

```bash
convoai agent turns abc123
convoai agent turns abc123 --limit 5
```

---

### agent join

Start an agent and open a browser-based voice chat client in one command. Launches a local HTTP server that serves the Agora Web SDK voice client.

```
convoai agent join [options]
```

| Flag | Description |
|------|-------------|
| `-c, --channel <name>` | Channel name (required) |
| `--preset <name>` | Use a built-in preset |
| `--model <model>` | LLM model name |
| `--tts <vendor>` | TTS vendor (overrides preset) |
| `--asr <vendor>` | ASR vendor (overrides preset) |
| `--system-message <msg>` | System prompt for the LLM |
| `--greeting <msg>` | Greeting message |
| `--idle-timeout <seconds>` | Idle timeout in seconds (default: 300) |
| `--port <port>` | Local server port (default: 3210) |
| `--profile <name>` | Config profile |
| `--no-open` | Do not auto-open the browser |

**Example:**

```bash
convoai agent join -c room1
convoai agent join -c room1 --preset openai-gpt4o
convoai agent join -c room1 --port 8080 --no-open
```

---

### call initiate

Initiate an outbound phone call (telephony).

```
convoai call initiate [options]
```

| Flag | Description |
|------|-------------|
| `--phone <number>` | Phone number in E.164 format, e.g., `+15551234567` (required) |
| `-c, --channel <name>` | Channel name (auto-generated if omitted) |
| `--model <model>` | LLM model name |
| `--system-message <msg>` | System prompt for the LLM |
| `--greeting <msg>` | Greeting message spoken on connect |
| `--profile <name>` | Config profile to use |
| `--json` | Output result as JSON |
| `--dry-run` | Show request payload without sending |

**Example:**

```bash
convoai call initiate --phone +15551234567
convoai call initiate --phone +15551234567 --greeting "Hello, this is your AI assistant"
```

---

### call hangup

Hang up an active phone call.

```
convoai call hangup <agent-id> [options]
```

| Flag | Description |
|------|-------------|
| `--profile <name>` | Config profile to use |
| `--json` | Output result as JSON |

**Example:**

```bash
convoai call hangup abc123
```

---

### call status

Get the status of a phone call, including direction, elapsed time, and duration.

```
convoai call status <agent-id> [options]
```

| Flag | Description |
|------|-------------|
| `--profile <name>` | Config profile to use |
| `--json` | Output result as JSON |

**Example:**

```bash
convoai call status abc123
```

---

### config init

Interactive setup wizard for ConvoAI configuration. Prompts for Agora credentials, LLM provider, and TTS vendor.

```
convoai config init
```

**Flags:** None.

**Example:**

```bash
convoai config init
```

---

### config set

Set a configuration value using dot notation.

```
convoai config set <key> <value> [options]
```

| Flag | Description |
|------|-------------|
| `--profile <name>` | Set the value within a named profile |

**Valid keys:**

- Top-level: `app_id`, `customer_id`, `customer_secret`, `base_url`, `region`, `default_profile`, `app_certificate`
- LLM: `llm.url`, `llm.api_key`, `llm.vendor`, `llm.style`, `llm.model`, `llm.greeting_message`, `llm.failure_message`, `llm.max_history`
- TTS: `tts.vendor`, `tts.params.key`, `tts.params.region`, `tts.params.voice_name`, `tts.params.speed`, `tts.params.volume`
- ASR: `asr.vendor`, `asr.language`, `asr.params.key`, `asr.params.model`, `asr.params.language`

**Example:**

```bash
convoai config set app_id my-app-id
convoai config set llm.model gpt-4o
convoai config set tts.params.voice_name en-US-JennyNeural --profile staging
```

---

### config get

Get a configuration value using dot notation.

```
convoai config get <key> [options]
```

| Flag | Description |
|------|-------------|
| `--profile <name>` | Read value from a named profile |

**Example:**

```bash
convoai config get app_id
convoai config get llm.model
convoai config get tts.vendor --profile staging
```

---

### config show

Display the full configuration with secrets masked.

```
convoai config show [options]
```

| Flag | Description |
|------|-------------|
| `--profile <name>` | Show a specific profile |
| `--json` | Output as JSON |

**Example:**

```bash
convoai config show
convoai config show --profile staging --json
```

---

### config path

Print the configuration file path.

```
convoai config path [options]
```

| Flag | Description |
|------|-------------|
| `--dir` | Print only the config directory |

**Example:**

```bash
convoai config path       # /Users/you/.config/convoai/config.json
convoai config path --dir # /Users/you/.config/convoai
```

---

### preset list

List all available built-in agent presets.

```
convoai preset list [options]
```

| Flag | Description |
|------|-------------|
| `--json` | Output result as JSON |

**Example:**

```bash
convoai preset list
```

**Expected output:**

```
NAME               DESCRIPTION                                        LLM                 TTS               ASR
openai-gpt4o       OpenAI GPT-4o with Microsoft TTS and Deepgram ASR  OpenAI GPT-4o       Microsoft TTS     Deepgram
openai-mini        OpenAI GPT-4o-mini with Microsoft TTS and ...      OpenAI GPT-4o-mini  Microsoft TTS     Deepgram
anthropic-claude   Anthropic Claude with Microsoft TTS and ...        Anthropic Claude    Microsoft TTS     Deepgram
gemini             Google Gemini with Microsoft TTS and ...           Google Gemini       Microsoft TTS     Deepgram
realtime-openai    OpenAI Realtime API (multimodal LLM mode)          OpenAI Realtime     Built-in (MLLM)   Built-in (MLLM)
```

---

### preset use

Apply a preset to your profile as default settings. Saves the preset's LLM, TTS, and ASR configuration into your profile.

```
convoai preset use <name> [options]
```

| Flag | Description |
|------|-------------|
| `--profile <name>` | Save preset settings into a named profile |

**Example:**

```bash
convoai preset use openai-gpt4o
convoai preset use anthropic-claude --profile staging
```

---

### template save

Save the current resolved configuration as a reusable agent template.

```
convoai template save <name> [options]
```

| Flag | Description |
|------|-------------|
| `--from-agent <id>` | Reference a running agent (uses resolved config defaults) |
| `--description <desc>` | Description for the template |
| `-c, --channel <name>` | Default channel name |
| `--model <model>` | LLM model name |
| `--tts <vendor>` | TTS vendor |
| `--asr <vendor>` | ASR vendor |
| `--system-message <msg>` | System prompt for the LLM |
| `--greeting <msg>` | Greeting message |
| `--force` | Overwrite an existing template with the same name |
| `--profile <name>` | Config profile to use |

**Example:**

```bash
convoai template save mybot --description "Customer support bot"
convoai template save pirate --model gpt-4o --system-message "You are a pirate" --force
```

---

### template list

List all saved agent templates.

```
convoai template list [options]
```

| Flag | Description |
|------|-------------|
| `--json` | Output result as JSON |

**Example:**

```bash
convoai template list
```

---

### template show

Show full details of a saved template.

```
convoai template show <name> [options]
```

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON (full template) |
| `--raw` | Output only the properties object as raw JSON (useful for piping) |

**Example:**

```bash
convoai template show mybot
convoai template show mybot --raw | jq .
```

---

### template delete

Delete a saved template.

```
convoai template delete <name> [options]
```

| Flag | Description |
|------|-------------|
| `--force` | Skip confirmation prompt |
| `--json` | Output result as JSON |

**Example:**

```bash
convoai template delete mybot
convoai template delete mybot --force
```

---

### template use

Start an agent using a saved template.

```
convoai template use <name> [options]
```

| Flag | Description |
|------|-------------|
| `-c, --channel <name>` | RTC channel name |
| `--profile <name>` | Config profile to use |
| `--json` | Output result as JSON |
| `--dry-run` | Show the request payload without sending it |

**Example:**

```bash
convoai template use mybot --channel support-room
convoai template use mybot --channel test --dry-run
```

---

### token

Generate an RTC token for agent authentication. Uses the `agora-token` library locally.

```
convoai token [options]
```

| Flag | Description |
|------|-------------|
| `-c, --channel <name>` | Channel name (required) |
| `--uid <uid>` | UID for the token (default: `0`) |
| `--expire <seconds>` | Token expiry in seconds (default: `86400`) |
| `--certificate <cert>` | App Certificate (or set via config/env) |
| `--profile <name>` | Config profile to use |
| `--json` | Output as JSON |

**Example:**

```bash
convoai token -c my-room
convoai token -c my-room --uid 12345 --expire 3600 --json
```

**Expected output:**

```
✔ Token generated.
  Token      007eJx...
  Channel    my-room
  UID        0
  Expires    2024-01-16 10:30:00
```

---

### completion bash

Output a bash completion script to stdout.

```
convoai completion bash
```

**Usage:** Add to your `.bashrc`:

```bash
eval "$(convoai completion bash)"
```

---

### completion zsh

Output a zsh completion script to stdout.

```
convoai completion zsh
```

**Usage:** Add to your `.zshrc`:

```bash
eval "$(convoai completion zsh)"
```

---

### completion fish

Output a fish completion script to stdout.

```
convoai completion fish
```

**Usage:** Save to fish completions directory:

```bash
convoai completion fish > ~/.config/fish/completions/convoai.fish
```

---

### completion install

Auto-detect your shell and install completions to the appropriate rc file.

```
convoai completion install
```

Detects bash, zsh, or fish from the `$SHELL` environment variable and appends the appropriate `eval` line or writes the completion file. Idempotent — will not add duplicates.

**Example:**

```bash
convoai completion install
```

```
✔ Zsh completions installed to ~/.zshrc
  Hint: Restart your shell or run `source ~/.zshrc` to activate.
```

---

## 7. Configuration

### Config File Location

The global config file is located at:

```
~/.config/convoai/config.json
```

The directory follows XDG conventions. If `$XDG_CONFIG_HOME` is set, the config is stored at `$XDG_CONFIG_HOME/convoai/config.json`. The directory is created with mode `0700` and the file with mode `0600` for security.

Print the path programmatically:

```bash
convoai config path       # Full file path
convoai config path --dir # Directory only
```

### Config File Format

```json
{
  "app_id": "your-app-id",
  "app_certificate": "your-app-certificate",
  "customer_id": "your-customer-id",
  "customer_secret": "your-customer-secret",
  "region": "global",
  "base_url": null,
  "default_profile": "default",
  "profiles": {
    "default": {
      "llm": {
        "url": "https://api.openai.com/v1/chat/completions",
        "api_key": "sk-...",
        "model": "gpt-4o-mini",
        "system_messages": [
          { "role": "system", "content": "You are a friendly AI voice assistant." }
        ],
        "params": {
          "model": "gpt-4o-mini",
          "max_tokens": 512,
          "temperature": 0.7
        }
      },
      "tts": {
        "vendor": "microsoft",
        "params": {
          "key": "your-tts-key",
          "region": "eastus",
          "voice_name": "en-US-AndrewMultilingualNeural"
        }
      },
      "asr": {
        "vendor": "ares",
        "language": "en-US"
      }
    },
    "staging": {
      "app_id": "staging-app-id",
      "customer_id": "staging-cust-id",
      "customer_secret": "staging-secret",
      "region": "cn",
      "llm": { ... },
      "tts": { ... },
      "asr": { ... }
    }
  }
}
```

### Config Hierarchy

Configuration is resolved in this order (highest priority wins):

```
CLI flags  >  Environment variables  >  Project .convoai.json  >  Named profile  >  Base config
```

1. **CLI flags** — e.g., `--model gpt-4o`, `--channel room1`
2. **Environment variables** — `CONVOAI_APP_ID`, `CONVOAI_CUSTOMER_ID`, `CONVOAI_CUSTOMER_SECRET`, `CONVOAI_BASE_URL`, `CONVOAI_REGION`
3. **Project config** — `.convoai.json` in the current working directory
4. **Named profile** — the profile specified by `--profile <name>` or the `default_profile` in config
5. **Base config** — top-level fields in `~/.config/convoai/config.json`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CONVOAI_APP_ID` | Override the Agora App ID |
| `CONVOAI_CUSTOMER_ID` | Override the Customer ID |
| `CONVOAI_CUSTOMER_SECRET` | Override the Customer Secret |
| `CONVOAI_BASE_URL` | Override the API base URL |
| `CONVOAI_REGION` | Override the region (`global` or `cn`) |
| `AGORA_APP_CERTIFICATE` | App Certificate for token generation (fallback for `convoai token`) |
| `XDG_CONFIG_HOME` | Override the config directory base path |

### Profile Management

Create a profile:

```bash
convoai auth login --profile production
```

Set a profile as default:

```bash
convoai config set default_profile production
```

Set profile-specific values:

```bash
convoai config set llm.model gpt-4o --profile production
convoai config set tts.vendor elevenlabs --profile production
```

Use a profile for a single command:

```bash
convoai agent start -c room1 --profile production
```

Remove a profile:

```bash
convoai auth logout --profile production
```

### Project-Level .convoai.json

Place a `.convoai.json` file in your project root to set project-specific defaults. This is useful when different projects use different LLM providers or channels.

```json
{
  "llm": {
    "model": "gpt-4o",
    "system_messages": [
      { "role": "system", "content": "You are a customer support agent for ACME Corp." }
    ]
  },
  "tts": {
    "vendor": "elevenlabs"
  },
  "asr": {
    "vendor": "deepgram",
    "language": "en-US"
  }
}
```

This merges with your profile config. Project values override profile values for matching keys, but credentials still come from the global config or environment.

---

## 8. Troubleshooting

### "RTC connection failed"

**Cause:** Missing or invalid `app_certificate`. The CLI cannot generate valid RTC tokens without it.

**Fix:**

```bash
convoai config set app_certificate <your-certificate>
```

Or set it during `convoai quickstart` or `convoai config init`. You can find the App Certificate in the Agora Console under Project Management.

---

### "edge failed" or agent fails to join channel

**Cause:** Incorrect `agent_rtc_uid` or the LLM endpoint URL is missing/invalid.

**Fix:**
- Verify the LLM URL is correct: `convoai config get llm.url`
- When using custom LLM endpoints, ensure the URL is accessible from the Agora ConvoAI Engine (not just from your local machine).
- Check that the agent UID does not conflict with another participant in the channel.

---

### "request failed" error when starting agent

**Cause:** Wrong `vendor` or `style` fields in the LLM configuration, typically when using a custom LLM endpoint.

**Fix:**
- If using a **custom LLM** with an OpenAI-compatible API, do NOT set `vendor` or `style` fields. Only provide `url`, `api_key`, `model`, and `params`.
- If using Anthropic, ensure `style` is set to `"anthropic"` and the `anthropic-version` header is included.
- If using Gemini, ensure `style` is set to `"gemini"` and the API key is embedded in the URL template.

```bash
# Correct: custom LLM without vendor/style
convoai config set llm.url https://my-llm.example.com/v1/chat/completions --profile default
convoai config set llm.api_key my-key --profile default
convoai config set llm.model my-model --profile default
```

---

### LLM not responding

**Cause:** Custom LLM configurations should NOT include `vendor` or `style` fields. The ConvoAI Engine uses these to determine the request format, and incorrect values cause silent failures.

**Fix:** Remove `vendor` and `style` from your LLM config. The engine defaults to OpenAI-compatible format when these fields are absent.

---

### readline crash on install script

**Cause:** When piping `curl | bash`, stdin is consumed by curl and is not available for interactive prompts.

**Fix:** The install script handles this by redirecting stdin: `exec convoai quickstart </dev/tty`. If you still encounter issues:

```bash
# Download first, then run
curl -fsSL https://convobench.org/install.sh -o install.sh
bash install.sh
```

Or install manually and run quickstart separately:

```bash
npm install -g convoai
convoai quickstart
```

---

### China network issues

**Cause:** OpenAI, Anthropic, and other global LLM providers are not directly accessible from mainland China.

**Fix:** Use China-optimized providers that do not require a proxy:

```bash
# Alibaba Qwen (DashScope)
convoai config set llm.url https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
convoai config set llm.model qwen-plus

# DeepSeek
convoai config set llm.url https://api.deepseek.com/v1/chat/completions
convoai config set llm.model deepseek-chat
```

Set the region to `cn` for the correct API endpoints:

```bash
convoai config set region cn
```

---

### "App ID not configured" or "Missing required credentials"

**Cause:** Credentials have not been saved to the config file.

**Fix:**

```bash
convoai auth login
# or
convoai quickstart
```

---

### Agent starts but no audio in browser

**Cause:** Browser microphone permissions not granted, or the web client failed to join the RTC channel.

**Fix:**
1. Ensure you click "Allow" on the browser microphone permission prompt.
2. Check the event log in the browser voice client for errors.
3. Verify the App ID matches the one used to generate the token.
4. Try a different browser (Chrome recommended).

---

### Token generation fails

**Cause:** Missing `app_certificate` in config.

**Fix:**

```bash
convoai config set app_certificate <your-certificate>
# Or pass it directly:
convoai token -c my-room --certificate <your-certificate>
# Or use an environment variable:
export AGORA_APP_CERTIFICATE=<your-certificate>
```

---

### Port 3210 already in use

**Cause:** Another process or a previous `agent join` session is using port 3210.

**Fix:**

```bash
# Use a different port
convoai agent join -c room1 --port 3211

# Or find and kill the process using the port
lsof -ti:3210 | xargs kill
```
