```
   ____                       _    ___    ____ _     ___
  / ___|___  _ ____   _____  / \  |_ _|  / ___| |   |_ _|
 | |   / _ \| '_ \ \ / / _ \/ _ \  | |  | |   | |    | |
 | |__| (_) | | | \ V / (_) / ___ \ | |  | |___| |___ | |
  \____\___/|_| |_|\_/ \___/_/   \_\___|  \____|_____|___|
```

# ConvoAI CLI

**The developer-friendly CLI for Agora Conversational AI Engine**

[![npm version](https://img.shields.io/npm/v/convoai.svg)](https://www.npmjs.com/package/convoai)
[![license](https://img.shields.io/npm/l/convoai.svg)](https://github.com/AgoraIO/convoai-cli/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/convoai.svg)](https://nodejs.org)

Start, manage, and monitor conversational AI agents from your terminal. One command to launch a voice agent. Full control over its lifecycle, conversation history, and real-time performance.

---

## Features

- **Developer Platform starter** -- `convoai init` scaffolds a full Web project (frontend + server + Python)
- **Three-layer architecture** -- Frontend / Customer Server / ConvoAI Engine, clear separation
- **Full Agora ConvoAI REST API coverage** -- every endpoint, one CLI
- **Instant voice chat** -- `convoai go` launches a voice agent and browser client with zero params
- **Web starter with real-time subtitles** -- dark geek UI, DataStream transcription, mic/mute/interrupt
- **Real-time agent monitoring** -- live status, latency, and conversation turns in the runtime panel
- **Built-in presets** -- start with OpenAI, Anthropic, Gemini, or Realtime in one flag
- **Profile management** -- switch between dev, staging, and prod with a single option
- **Phone calls** -- `convoai phone send` makes outbound calls with SIP, `--wait` shows live status
- **Number management** -- import, list, update, remove phone numbers (Twilio or BYO SIP)
- **Shell completions** -- tab-complete commands in bash, zsh, and fish

---

## Quick Start

```bash
# Install globally
npm install -g convoai

# Create a Web starter project (auto-configures credentials)
convoai init my-app
cd my-app && npm install
convoai dev

# Or instant voice chat — zero setup
convoai go

# Or make a phone call
convoai phone send

# Override the model on the fly
convoai go --model gpt-4o

# See what's running
convoai agent list

# Check the conversation so far
convoai agent history <agent-id>

# View turn-level latency analytics
convoai agent turns <agent-id>

# Done for now
convoai agent stop <agent-id>
```

---

## Developer Platform (v1.6.0)

Build your own voice AI application with a production-ready starter:

```bash
convoai init my-app    # Scaffold a Web starter project
cd my-app && npm install
convoai dev            # Start dev server + auto-open browser
```

**What you get:**

```
my-app/
  frontend/            <- Your UI (HTML/JS/CSS, dark geek theme)
  server/              <- Your backend (Express + TypeScript)
  python-server/       <- Alternative Python backend (FastAPI)
  connectors/          <- Future: telephony, text, IoT
```

- **Frontend**: Voice conversation UI with real-time subtitles, mic control, interrupt button
- **Server**: Direct Agora REST API calls, token generation, webhook/knowledge placeholders
- **Python server**: Same API routes, drop-in replacement for Node server
- **Auto-credentials**: `convoai init` reads your CLI config or runs inline setup
- **From local to production**: Same architecture scales — no rewrite needed

---

## Phone Calls (v1.7.0)

Make outbound phone calls with AI agents:

```bash
# Interactive — prompts for everything
convoai phone send

# Or with flags
convoai phone send --from +15551234567 --to +15559876543 --task "Ask about demo" --wait

# Quick call from go
convoai go --call
```

**Number management:**

```bash
convoai phone import          # Import a number (Twilio or BYO SIP)
convoai phone numbers         # List your numbers
convoai phone remove <num>    # Remove a number
```

---

## Installation

### npm (recommended)

```bash
npm install -g convoai
```

### npx (no install)

```bash
npx convoai auth login
npx convoai agent start --channel demo --preset openai-mini
```

### From source

```bash
git clone https://github.com/AgoraIO/convoai-cli.git
cd convoai-cli
npm install
npm run build
npm link
```

---

## Authentication

ConvoAI CLI needs three credentials from [Agora Console](https://console.agora.io):

| Credential | Description |
|---|---|
| **App ID** | Your Agora project's application ID |
| **Customer ID** | REST API customer identifier |
| **Customer Secret** | REST API customer secret |

### Interactive login

```bash
convoai auth login
```

The CLI will prompt for each value, verify connectivity, and save credentials to `~/.config/convoai/config.json`.

### Non-interactive login

```bash
convoai auth login \
  --app-id YOUR_APP_ID \
  --customer-id YOUR_CUSTOMER_ID \
  --customer-secret YOUR_CUSTOMER_SECRET
```

### Login to a named profile

```bash
convoai auth login --profile staging
```

### Environment variables

Credentials can also be provided via environment variables. These override any saved config.

```bash
export CONVOAI_APP_ID="your-app-id"
export CONVOAI_CUSTOMER_ID="your-customer-id"
export CONVOAI_CUSTOMER_SECRET="your-customer-secret"
```

### Check auth status

```bash
convoai auth status
```

### Clear credentials

```bash
convoai auth logout
```

---

## Commands Reference

Every command supports `--json` for machine-readable output and `--profile <name>` to target a specific configuration profile.

Commands are organized into scenario groups:

| Group | Commands |
|---|---|
| **Start** | `go`, `quickstart` |
| **Agent** | `agent start`, `agent stop`, `agent status`, `agent list`, `agent update`, `agent speak`, `agent interrupt`, `agent history`, `agent turns`, `agent join` |
| **Config** | `config init`, `config set`, `config get`, `config show`, `config path`, `auth login`, `auth logout`, `auth status` |
| **More** | `preset list`, `preset use`, `template save/list/show/delete/use`, `call initiate/hangup/status`, `token`, `completion` |

---

### `go` -- Instant voice chat

Zero-params command that launches a voice agent and opens a browser-based voice client in one step. Uses your saved configuration (or prompts for setup if unconfigured).

```bash
convoai go [options]
```

| Flag | Description |
|---|---|
| `--setup` | Run the guided setup wizard before starting |
| `--model <model>` | Override the LLM model (e.g. `gpt-4o`, `claude-sonnet-4-20250514`) |

**Examples:**

```bash
# Instant voice chat -- no flags needed
convoai go

# Run setup first, then start
convoai go --setup

# Override the model for this session
convoai go --model gpt-4o

# Use a different model provider
convoai go --model claude-sonnet-4-20250514
```

---

### Agent Management

#### `agent start` -- Start a new conversational AI agent

```bash
convoai agent start --channel <name> [options]
```

| Flag | Description |
|---|---|
| `-c, --channel <name>` | RTC channel name (required) |
| `-n, --name <name>` | Agent name (auto-generated if omitted) |
| `--preset <name>` | Use a built-in preset (e.g. `openai-mini`, `anthropic-claude`) |
| `--model <model>` | LLM model name (e.g. `gpt-4o`, `claude-sonnet-4-20250514`) |
| `--llm-url <url>` | Custom LLM API endpoint |
| `--llm-key <key>` | LLM API key |
| `--tts <vendor>` | TTS vendor (e.g. `microsoft`, `elevenlabs`) |
| `--asr <vendor>` | ASR vendor (e.g. `deepgram`) |
| `--system-message <msg>` | System prompt for the LLM |
| `--greeting <msg>` | Greeting message spoken when the agent joins |
| `--uid <uid>` | Agent RTC UID (default: `"Agent"`) |
| `--remote-uids <uids>` | Comma-separated remote UIDs (default: `"*"`) |
| `--idle-timeout <seconds>` | Idle timeout in seconds (default: `30`) |
| `--dry-run` | Print the request payload without sending it |

**Examples:**

```bash
# Quickest start -- use a preset
convoai agent start --channel demo --preset openai-mini

# Custom model with a system prompt
convoai agent start \
  --channel support-line \
  --model gpt-4o \
  --system-message "You are a customer support agent for Acme Corp." \
  --greeting "Hello! How can I help you today?"

# Use Anthropic Claude
convoai agent start --channel research --preset anthropic-claude

# OpenAI Realtime (multimodal voice-to-voice)
convoai agent start --channel realtime-demo --preset realtime-openai

# Dry run to inspect the request payload
convoai agent start --channel test --preset openai-mini --dry-run

# Interactive mode -- just run without flags and answer the prompts
convoai agent start
```

---

#### `agent stop` -- Stop a running agent

```bash
convoai agent stop <agent-id>
convoai agent stop --all
```

| Flag | Description |
|---|---|
| `-a, --all` | Stop all running agents |
| `-f, --force` | Skip confirmation when using `--all` |

**Examples:**

```bash
# Stop a single agent
convoai agent stop abc123

# Stop everything (with confirmation prompt)
convoai agent stop --all

# Stop everything without confirmation (for scripts)
convoai agent stop --all --force
```

---

#### `agent status` -- Query the status of an agent

```bash
convoai agent status <agent-id>
```

Returns the agent's current status, channel, start time, and stop time (if applicable).

---

#### `agent list` -- List agents

```bash
convoai agent list [options]
```

| Flag | Description |
|---|---|
| `-s, --state <state>` | Filter by state: `running`, `stopped`, `failed`, `all` (default: `running`) |
| `-c, --channel <name>` | Filter by channel name |
| `-l, --limit <n>` | Maximum results (default: `20`) |

Alias: `agent ls`

**Examples:**

```bash
# List running agents (default)
convoai agent list

# List all agents regardless of state
convoai agent list --state all

# List agents on a specific channel
convoai agent list --channel my-channel

# List failed agents
convoai agent list --state failed --limit 50
```

---

#### `agent update` -- Update a running agent's configuration

```bash
convoai agent update <agent-id> [options]
```

| Flag | Description |
|---|---|
| `--system-message <msg>` | Update the system prompt |
| `--model <model>` | Update the LLM model |
| `--max-tokens <n>` | Update max tokens |
| `--temperature <n>` | Update temperature |
| `--token <token>` | Update the RTC token |

**Examples:**

```bash
# Change the system prompt on the fly
convoai agent update abc123 --system-message "You are now a French tutor."

# Adjust generation parameters
convoai agent update abc123 --temperature 0.3 --max-tokens 256
```

---

#### `agent speak` -- Instruct an agent to speak

```bash
convoai agent speak <agent-id> <text> [options]
```

| Flag | Description |
|---|---|
| `--priority <priority>` | `INTERRUPT`, `APPEND`, or `IGNORE` (default: `INTERRUPT`) |
| `--no-interrupt` | Prevent user from voice-interrupting this message |

**Examples:**

```bash
# Interrupt current speech and say something
convoai agent speak abc123 "We'll be closing in 5 minutes."

# Append to the speech queue
convoai agent speak abc123 "One more thing..." --priority APPEND

# Non-interruptible announcement
convoai agent speak abc123 "Important: scheduled maintenance at midnight." --no-interrupt
```

---

#### `agent interrupt` -- Interrupt an agent that is currently speaking

```bash
convoai agent interrupt <agent-id>
```

---

#### `agent history` -- View conversation history

```bash
convoai agent history <agent-id> [options]
```

| Flag | Description |
|---|---|
| `--limit <n>` | Show only the last N entries |

**Examples:**

```bash
# Full conversation history
convoai agent history abc123

# Last 5 messages
convoai agent history abc123 --limit 5

# Export as JSON
convoai agent history abc123 --json > conversation.json
```

---

#### `agent turns` -- View turn-level latency analytics

```bash
convoai agent turns <agent-id> [options]
```

| Flag | Description |
|---|---|
| `--limit <n>` | Number of turns to show (default: `20`) |

Displays a table of each conversation turn with end-to-end latency and per-component breakdown (ASR, LLM, TTS), plus averages. Latency values are color-coded: green (<1s), yellow (1-2s), red (>2s).

**Examples:**

```bash
# See the latest turns
convoai agent turns abc123

# Export turn analytics as JSON for further analysis
convoai agent turns abc123 --json | jq '.turns[] | {turn_id, e2e_latency_ms}'
```

---

### Call Management (Beta)

Telephony integration for initiating and managing phone calls through ConvoAI agents.

#### `call initiate` -- Start a phone call

```bash
convoai call initiate [options]
```

#### `call hangup` -- End a phone call

```bash
convoai call hangup <call-id>
```

#### `call status` -- Check call status

```bash
convoai call status <call-id>
```

> **Note:** Call commands are in beta. The API surface may change in future releases.

---

### Configuration

#### `config init` -- Interactive setup wizard

```bash
convoai config init
```

Walks you through setting up your Agora credentials, LLM provider, and TTS vendor with an interactive wizard. Verifies connectivity when done.

---

#### `config set` -- Set a configuration value

```bash
convoai config set <key> <value> [--profile <name>]
```

Supports dot-notation for nested values.

**Examples:**

```bash
# Set the default LLM model
convoai config set llm.model gpt-4o

# Set ASR language for a profile
convoai config set asr.language en-US --profile production

# Set the TTS voice
convoai config set tts.params.voice_name en-US-AndrewMultilingualNeural

# Set the default region
convoai config set region global
```

**Valid keys:**

| Category | Keys |
|---|---|
| Credentials | `app_id`, `customer_id`, `customer_secret`, `base_url`, `region`, `default_profile` |
| LLM | `llm.url`, `llm.api_key`, `llm.vendor`, `llm.style`, `llm.model`, `llm.greeting_message`, `llm.failure_message`, `llm.max_history` |
| TTS | `tts.vendor`, `tts.params.key`, `tts.params.region`, `tts.params.voice_name`, `tts.params.speed`, `tts.params.volume` |
| ASR | `asr.vendor`, `asr.language`, `asr.params.key`, `asr.params.model`, `asr.params.language` |

---

#### `config get` -- Read a configuration value

```bash
convoai config get <key> [--profile <name>]
```

```bash
convoai config get llm.model
# gpt-4o

convoai config get region --profile staging
# cn
```

---

#### `config show` -- Display the full configuration

```bash
convoai config show [--profile <name>] [--json]
```

Secrets are automatically masked in the output.

---

#### `config path` -- Print the config file path

```bash
convoai config path
# ~/.config/convoai/config.json

convoai config path --dir
# ~/.config/convoai
```

---

### Presets

Presets are built-in configurations that bundle an LLM, TTS, and ASR stack into a single name.

#### Available presets

| Preset | LLM | TTS | ASR |
|---|---|---|---|
| `openai-gpt4o` | OpenAI GPT-4o | Microsoft TTS | Deepgram |
| `openai-mini` | OpenAI GPT-4o-mini | Microsoft TTS | Deepgram |
| `anthropic-claude` | Anthropic Claude | Microsoft TTS | Deepgram |
| `gemini` | Google Gemini 2.0 Flash | Microsoft TTS | Deepgram |
| `realtime-openai` | OpenAI Realtime (multimodal) | Built-in (MLLM) | Built-in (MLLM) |

#### `preset list` -- List all presets

```bash
convoai preset list
```

#### `preset use` -- Apply a preset to your profile

```bash
convoai preset use <name> [--profile <name>]
```

Saves the preset's LLM, TTS, and ASR settings as your profile defaults. After applying, `agent start` will use these settings automatically.

```bash
# Apply to your default profile
convoai preset use openai-mini

# Apply to a named profile
convoai preset use anthropic-claude --profile research
```

---

### Other Commands

#### `auth status` -- Check authentication status

```bash
convoai auth status
```

#### `auth logout` -- Remove saved credentials

```bash
convoai auth logout
```

---

## Configuration

### Precedence

Configuration is resolved in this order (highest priority first):

```
CLI flags  >  Environment variables  >  Project .convoai.json  >  Profile config  >  Base config
```

### Config file

The global configuration lives at `~/.config/convoai/config.json`:

```json
{
  "app_id": "your-app-id",
  "customer_id": "your-customer-id",
  "customer_secret": "your-customer-secret",
  "region": "global",
  "default_profile": "default",
  "profiles": {
    "default": {
      "llm": {
        "vendor": "openai",
        "style": "openai",
        "api_key": "sk-...",
        "model": "gpt-4o-mini"
      },
      "tts": {
        "vendor": "microsoft",
        "params": {
          "voice_name": "en-US-AndrewMultilingualNeural",
          "speed": 1.0
        }
      },
      "asr": {
        "vendor": "deepgram",
        "language": "en-US",
        "params": {
          "model": "nova-2"
        }
      }
    }
  }
}
```

### Project config

Drop a `.convoai.json` in your project root to share settings across your team. Project config overrides profile settings.

```json
{
  "llm": {
    "vendor": "openai",
    "model": "gpt-4o",
    "system_messages": [
      {
        "role": "system",
        "content": "You are the Acme Corp support assistant. Be helpful and concise."
      }
    ]
  },
  "tts": {
    "vendor": "microsoft",
    "params": {
      "voice_name": "en-US-JennyNeural"
    }
  }
}
```

Commit `.convoai.json` to version control. Keep secrets out of it -- use environment variables or your personal config profile for credentials.

---

## Profiles

Profiles let you maintain separate configurations for different environments.

### Setup

```bash
# Create a development profile
convoai auth login --profile dev

# Create a staging profile
convoai auth login --profile staging

# Create a production profile
convoai auth login --profile prod
```

### Usage

```bash
# Start an agent using staging credentials
convoai agent start --channel test --preset openai-mini --profile staging

# List agents in production
convoai agent list --profile prod

# Set the default profile so you don't need --profile every time
convoai config set default_profile staging
```

### Switch via environment variable

```bash
export CONVOAI_PROFILE=prod
convoai agent list   # uses prod profile automatically
```

---

## Scripting and CI/CD

Every command supports `--json` for machine-readable output, making it straightforward to integrate with pipelines.

### Parse output with jq

```bash
# Get the agent ID from a start command
AGENT_ID=$(convoai agent start --channel ci-test --preset openai-mini --json | jq -r '.agent_id')
echo "Started agent: $AGENT_ID"

# Check status
convoai agent status "$AGENT_ID" --json | jq '.status'

# Clean up
convoai agent stop "$AGENT_ID"
```

### List running agents and extract IDs

```bash
convoai agent list --json | jq -r '.data.list[].agent_id'
```

### Export conversation history

```bash
convoai agent history "$AGENT_ID" --json | jq '.contents[] | "\(.role): \(.content)"'
```

### CI/CD pipeline example

```bash
#!/bin/bash
set -euo pipefail

# Credentials from CI secrets
export CONVOAI_APP_ID="$AGORA_APP_ID"
export CONVOAI_CUSTOMER_ID="$AGORA_CUSTOMER_ID"
export CONVOAI_CUSTOMER_SECRET="$AGORA_CUSTOMER_SECRET"

# Start a test agent
AGENT_ID=$(convoai agent start \
  --channel "ci-${CI_BUILD_ID}" \
  --preset openai-mini \
  --json | jq -r '.agent_id')

echo "Agent started: $AGENT_ID"

# Run your integration tests here...

# Tear down
convoai agent stop "$AGENT_ID"

# Stop any orphaned agents from failed runs
convoai agent stop --all --force
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `CONVOAI_APP_ID` | Agora App ID (overrides config) |
| `CONVOAI_CUSTOMER_ID` | Customer ID (overrides config) |
| `CONVOAI_CUSTOMER_SECRET` | Customer Secret (overrides config) |
| `CONVOAI_PROFILE` | Active profile name |
| `CONVOAI_BASE_URL` | Custom API base URL |
| `NO_COLOR` | Disable colored output (any value) |

---

## Template Files

### `.convoai.json` -- project configuration

Place this file in your project root for team-shared agent defaults.

```json
{
  "llm": {
    "vendor": "openai",
    "model": "gpt-4o",
    "system_messages": [
      {
        "role": "system",
        "content": "You are a helpful voice assistant for our application."
      }
    ],
    "greeting_message": "Hi there! How can I help you today?",
    "max_history": 20,
    "params": {
      "temperature": 0.7,
      "max_tokens": 512
    }
  },
  "tts": {
    "vendor": "microsoft",
    "params": {
      "voice_name": "en-US-AndrewMultilingualNeural",
      "speed": 1.0
    }
  },
  "asr": {
    "vendor": "deepgram",
    "language": "en-US",
    "params": {
      "model": "nova-2"
    }
  }
}
```

---

## Troubleshooting

### `Missing required credentials: app_id, customer_id, customer_secret`

You haven't authenticated yet. Run:

```bash
convoai auth login
```

Or set the environment variables `CONVOAI_APP_ID`, `CONVOAI_CUSTOMER_ID`, and `CONVOAI_CUSTOMER_SECRET`.

### `--channel is required`

The `agent start` command requires a channel name. Provide it as a flag:

```bash
convoai agent start --channel my-channel --preset openai-mini
```

Or run `convoai agent start` without flags in an interactive terminal to get prompted.

### Agent starts but immediately shows `FAILED` status

Check your LLM API key and TTS credentials. Use `config show` to inspect:

```bash
convoai config show
```

Verify the LLM key is set in your profile:

```bash
convoai config get llm.api_key
```

### Connection errors or timeouts

- Confirm your region is correct: `convoai config get region`
- Check if you need a custom base URL for your deployment
- Verify your network can reach the Agora ConvoAI API

### Agent stops after `idle_timeout` seconds

By default, agents time out after 30 seconds of inactivity. Increase it:

```bash
convoai agent start --channel demo --preset openai-mini --idle-timeout 300
```

### How do I see the raw API request?

Use `--dry-run` to print the request payload without sending it:

```bash
convoai agent start --channel test --preset openai-mini --dry-run
```

### Colors not showing / garbled output

If your terminal doesn't support ANSI colors, disable them:

```bash
NO_COLOR=1 convoai agent list
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b my-feature`
3. Install dependencies: `npm install`
4. Run in dev mode: `npm run dev -- agent list`
5. Check types: `npm run lint`
6. Build: `npm run build`
7. Submit a pull request

The project uses TypeScript with strict mode, Commander.js for command parsing, and Zod for config validation.

---

## License

[MIT](LICENSE)
