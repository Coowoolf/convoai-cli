# ConvoAI One-Liner Install Experience

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `curl -fsSL https://convoai.dev/install.sh | bash` takes a developer from zero to voice-chatting with an AI agent in under 3 minutes.

**Architecture:** A shell install script handles Node.js detection/installation and npm global install. After install, it auto-runs `convoai quickstart` which is a rewritten 6-step wizard with full provider catalogs for LLM (9 vendors), TTS (12 vendors), and ASR (9 vendors). The wizard ends with a live voice chat session in the browser, followed by conversation history and latency analytics display.

**Tech Stack:** Bash (install.sh), TypeScript/Node.js (CLI), Agora Web SDK (browser client), inquirer (prompts)

---

### Task 1: Create install.sh

**Files:**
- Create: `install.sh`

- [ ] **Step 1: Write install.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; DIM='\033[2m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}▸${RESET} $*"; }
success() { echo -e "${GREEN}✔${RESET} $*"; }
error()   { echo -e "${RED}✖${RESET} $*" >&2; }

# ── Banner ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}  ╔══════════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}  ║${RESET}${BOLD}   ConvoAI Installer                         ${CYAN}${BOLD}║${RESET}"
echo -e "${CYAN}${BOLD}  ║${RESET}${DIM}   Voice AI agents in one command              ${CYAN}${BOLD}║${RESET}"
echo -e "${CYAN}${BOLD}  ╚══════════════════════════════════════════════╝${RESET}"
echo ""

# ── Check Node.js ───────────────────────────────────────────────────────────
REQUIRED_NODE_MAJOR=18

check_node() {
  if command -v node &>/dev/null; then
    local ver
    ver=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$ver" -ge "$REQUIRED_NODE_MAJOR" ]; then
      success "Node.js $(node -v) detected"
      return 0
    fi
  fi
  return 1
}

install_node() {
  info "Node.js >= $REQUIRED_NODE_MAJOR not found. Installing..."

  if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &>/dev/null; then
      brew install node
    else
      info "Installing Homebrew first..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      brew install node
    fi
  elif [[ "$OSTYPE" == "linux"* ]]; then
    if command -v apt-get &>/dev/null; then
      curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
      sudo apt-get install -y nodejs
    elif command -v yum &>/dev/null; then
      curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
      sudo yum install -y nodejs
    else
      error "Unsupported Linux distribution. Please install Node.js >= $REQUIRED_NODE_MAJOR manually."
      exit 1
    fi
  else
    error "Unsupported OS: $OSTYPE. Please install Node.js >= $REQUIRED_NODE_MAJOR manually."
    exit 1
  fi

  if check_node; then
    success "Node.js installed successfully"
  else
    error "Node.js installation failed. Please install manually: https://nodejs.org"
    exit 1
  fi
}

if ! check_node; then
  install_node
fi

# ── Install convoai CLI ─────────────────────────────────────────────────────
info "Installing convoai CLI..."

npm install -g convoai@latest 2>/dev/null || {
  info "Retrying with sudo..."
  sudo npm install -g convoai@latest
}

if command -v convoai &>/dev/null; then
  success "convoai $(convoai --version) installed"
else
  error "Installation failed. Try manually: npm install -g convoai"
  exit 1
fi

# ── Launch quickstart ───────────────────────────────────────────────────────
echo ""
info "Launching quickstart wizard..."
echo ""

exec convoai quickstart
```

- [ ] **Step 2: Make executable and test locally**

Run: `chmod +x install.sh && bash install.sh`
Expected: Script detects Node.js, skips install, installs convoai (or confirms it's installed), launches quickstart.

- [ ] **Step 3: Commit**

```bash
git add install.sh
git commit -m "feat: add install.sh one-liner installer"
```

---

### Task 2: Create provider catalog data file

**Files:**
- Create: `src/providers/catalog.ts`

This is the single source of truth for all LLM, TTS, and ASR providers with their configs.

- [ ] **Step 1: Write provider catalog**

```typescript
// ─── LLM Providers ─────────────────────────────────────────────────────────

export interface LLMProvider {
  name: string;
  value: string;
  url: string;
  defaultModel: string;
  models: string[];
  style?: 'anthropic' | 'gemini';
  headers?: string;
  note?: string;
  urlHasKey?: boolean; // Gemini puts key in URL
}

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    name: 'Alibaba Qwen (通义千问)',
    value: 'dashscope',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-plus',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'],
    note: 'China-optimized, no proxy needed',
  },
  {
    name: 'DeepSeek',
    value: 'deepseek',
    url: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    note: 'China-optimized, great price-performance',
  },
  {
    name: 'OpenAI',
    value: 'openai',
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
    note: 'Requires proxy in China',
  },
  {
    name: 'Groq (free tier available)',
    value: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    note: 'Fast inference, free tier available',
  },
  {
    name: 'Anthropic Claude',
    value: 'anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-5-haiku-latest',
    models: ['claude-3-5-haiku-latest', 'claude-sonnet-4-20250514'],
    style: 'anthropic',
    headers: '{"anthropic-version":"2023-06-01"}',
  },
  {
    name: 'Google Gemini',
    value: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    style: 'gemini',
    urlHasKey: true,
  },
  {
    name: 'Azure OpenAI',
    value: 'azure',
    url: '',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o'],
    note: 'Enter your Azure endpoint URL',
  },
  {
    name: 'Amazon Bedrock',
    value: 'bedrock',
    url: '',
    defaultModel: '',
    models: [],
    note: 'Enter your Bedrock endpoint URL',
  },
  {
    name: 'Dify',
    value: 'dify',
    url: '',
    defaultModel: '',
    models: [],
    note: 'Enter your Dify endpoint URL',
  },
  {
    name: 'Custom (any OpenAI-compatible)',
    value: 'custom',
    url: '',
    defaultModel: '',
    models: [],
    note: 'Any service with OpenAI-compatible API',
  },
];

// ─── TTS Providers ──────────────────────────────────────────────────────────

export interface TTSProvider {
  name: string;
  vendor: string;
  requiresKey: boolean;
  requiresRegion?: boolean;
  defaultVoice?: string;
  beta?: boolean;
  note?: string;
}

export const TTS_PROVIDERS: TTSProvider[] = [
  { name: 'ElevenLabs', vendor: 'elevenlabs', requiresKey: true, note: 'High quality, multilingual' },
  { name: 'Microsoft Azure', vendor: 'microsoft', requiresKey: true, requiresRegion: true, defaultVoice: 'en-US-AndrewMultilingualNeural', note: 'Wide language support' },
  { name: 'MiniMax', vendor: 'minimax', requiresKey: true },
  { name: 'OpenAI TTS', vendor: 'openai', requiresKey: true, beta: true },
  { name: 'Cartesia', vendor: 'cartesia', requiresKey: true, beta: true },
  { name: 'Hume AI', vendor: 'humeai', requiresKey: true, beta: true },
  { name: 'Rime', vendor: 'rime', requiresKey: true, beta: true },
  { name: 'Fish Audio', vendor: 'fishaudio', requiresKey: true, beta: true },
  { name: 'Google TTS', vendor: 'google', requiresKey: true, beta: true },
  { name: 'Amazon Polly', vendor: 'amazon', requiresKey: true, beta: true },
  { name: 'Murf', vendor: 'murf', requiresKey: true, beta: true },
  { name: 'Sarvam', vendor: 'sarvam', requiresKey: true, beta: true },
];

// ─── ASR Providers ──────────────────────────────────────────────────────────

export interface ASRProvider {
  name: string;
  vendor: string;
  requiresKey: boolean;
  beta?: boolean;
  note?: string;
}

export const ASR_PROVIDERS: ASRProvider[] = [
  { name: 'ARES (Agora built-in, recommended)', vendor: 'ares', requiresKey: false, note: 'No extra API key needed' },
  { name: 'Microsoft Azure', vendor: 'microsoft', requiresKey: true },
  { name: 'Deepgram', vendor: 'deepgram', requiresKey: true },
  { name: 'OpenAI Whisper', vendor: 'openai', requiresKey: true, beta: true },
  { name: 'Speechmatics', vendor: 'speechmatics', requiresKey: true },
  { name: 'AssemblyAI', vendor: 'assemblyai', requiresKey: true, beta: true },
  { name: 'Amazon Transcribe', vendor: 'amazon', requiresKey: true, beta: true },
  { name: 'Google STT', vendor: 'google', requiresKey: true, beta: true },
  { name: 'Sarvam', vendor: 'sarvam', requiresKey: true, beta: true },
];

// ─── ASR Languages ──────────────────────────────────────────────────────────

export const ASR_LANGUAGES = [
  { name: 'Chinese (中文)', value: 'zh-CN' },
  { name: 'English (US)', value: 'en-US' },
  { name: 'Japanese (日本語)', value: 'ja-JP' },
  { name: 'Korean (한국어)', value: 'ko-KR' },
  { name: 'French', value: 'fr-FR' },
  { name: 'German', value: 'de-DE' },
  { name: 'Spanish', value: 'es-ES' },
  { name: 'Russian', value: 'ru-RU' },
  { name: 'Hindi', value: 'hi-IN' },
  { name: 'Arabic', value: 'ar-SA' },
  { name: 'Portuguese', value: 'pt-PT' },
  { name: 'Italian', value: 'it-IT' },
  { name: 'Thai', value: 'th-TH' },
  { name: 'Turkish', value: 'tr-TR' },
  { name: 'Vietnamese', value: 'vi-VN' },
  { name: 'Indonesian', value: 'id-ID' },
  { name: 'Malay', value: 'ms-MY' },
  { name: 'Dutch', value: 'nl-NL' },
  { name: 'Filipino', value: 'fil-PH' },
  { name: 'Chinese (HK)', value: 'zh-HK' },
  { name: 'Chinese (TW)', value: 'zh-TW' },
  { name: 'English (IN)', value: 'en-IN' },
  { name: 'Persian', value: 'fa-IR' },
  { name: 'Hebrew', value: 'he-IL' },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/providers/catalog.ts
git commit -m "feat: add complete provider catalog (9 LLM, 12 TTS, 9 ASR)"
```

---

### Task 3: Rewrite quickstart.ts with full provider catalogs

**Files:**
- Modify: `src/commands/quickstart.ts` (full rewrite)

- [ ] **Step 1: Rewrite quickstart with full provider wizards**

The rewritten quickstart must:
1. Import from `src/providers/catalog.ts` for all provider choices
2. **Step 1 (Agora Credentials):** same as current
3. **Step 2 (LLM):** list all 10 providers from `LLM_PROVIDERS`, auto-fill URL/model based on selection, handle Gemini URL-has-key pattern, handle Anthropic style+headers
4. **Step 3 (TTS):** list all 12 providers from `TTS_PROVIDERS`, show (Beta) tag, ask for region if Microsoft, ask for key
5. **Step 4 (ASR):** list all 9 providers from `ASR_PROVIDERS`, default to ARES, skip key prompt if ARES, ask language from `ASR_LANGUAGES`
6. **Step 5 (Voice chat):** same as current — generate tokens, start agent, open browser
7. **Step 6 (Results):** same as current — history, turns, stop

Key changes from current quickstart:
- LLM: add Groq, Anthropic (needs style+headers), Gemini (needs style, URL-has-key), Azure, Bedrock, Dify
- LLM: when style is needed, set it in the config; when headers are needed, set them
- LLM: for Gemini, construct URL with `{model}` and `{api_key}` substituted
- TTS: add all 12 vendors, show beta tags, ask region for Microsoft
- ASR: add all 9 vendors, default ARES, add language picker
- ASR config in the agent request uses the selected vendor + key + language

Full code is provided in the step (this is the main implementation task — the complete rewritten file).

- [ ] **Step 2: Build and test**

Run: `npx tsc && node dist/bin/convoai.js quickstart --help`
Expected: Shows quickstart command

- [ ] **Step 3: Commit**

```bash
git add src/commands/quickstart.ts
git commit -m "feat: rewrite quickstart with full provider catalogs"
```

---

### Task 4: Update agent join to use provider catalog for defaults

**Files:**
- Modify: `src/commands/agent/join.ts`

- [ ] **Step 1: Remove hardcoded ASR default, use config ASR**

In `join.ts`, the agent request currently hardcodes `asr: { vendor: 'ares', language: 'zh-CN' }`. Change it to read from the config profile's ASR settings, falling back to ares/zh-CN:

```typescript
asr: profile.asr?.vendor
  ? profile.asr
  : { vendor: 'ares', language: 'zh-CN' },
```

- [ ] **Step 2: Build and verify**

Run: `npx tsc`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/commands/agent/join.ts
git commit -m "fix: agent join uses config ASR instead of hardcoded ares"
```

---

### Task 5: Add tests for provider catalog

**Files:**
- Create: `tests/providers/catalog.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import { LLM_PROVIDERS, TTS_PROVIDERS, ASR_PROVIDERS, ASR_LANGUAGES } from '../../src/providers/catalog.js';

describe('LLM_PROVIDERS', () => {
  it('has 10 providers', () => {
    expect(LLM_PROVIDERS).toHaveLength(10);
  });

  it('each has name, value, url (except custom/azure/bedrock/dify), defaultModel', () => {
    const noUrlRequired = ['azure', 'bedrock', 'dify', 'custom'];
    for (const p of LLM_PROVIDERS) {
      expect(p.name).toBeTruthy();
      expect(p.value).toBeTruthy();
      if (!noUrlRequired.includes(p.value)) {
        expect(p.url, `${p.value} missing url`).toBeTruthy();
      }
    }
  });

  it('anthropic has style and headers', () => {
    const claude = LLM_PROVIDERS.find(p => p.value === 'anthropic');
    expect(claude?.style).toBe('anthropic');
    expect(claude?.headers).toContain('anthropic-version');
  });

  it('gemini has style and urlHasKey', () => {
    const gemini = LLM_PROVIDERS.find(p => p.value === 'gemini');
    expect(gemini?.style).toBe('gemini');
    expect(gemini?.urlHasKey).toBe(true);
  });
});

describe('TTS_PROVIDERS', () => {
  it('has 12 providers', () => {
    expect(TTS_PROVIDERS).toHaveLength(12);
  });

  it('each has name and vendor', () => {
    for (const p of TTS_PROVIDERS) {
      expect(p.name).toBeTruthy();
      expect(p.vendor).toBeTruthy();
    }
  });

  it('microsoft requires region', () => {
    const ms = TTS_PROVIDERS.find(p => p.vendor === 'microsoft');
    expect(ms?.requiresRegion).toBe(true);
  });
});

describe('ASR_PROVIDERS', () => {
  it('has 9 providers', () => {
    expect(ASR_PROVIDERS).toHaveLength(9);
  });

  it('ares does not require key', () => {
    const ares = ASR_PROVIDERS.find(p => p.vendor === 'ares');
    expect(ares?.requiresKey).toBe(false);
  });

  it('all others require key', () => {
    for (const p of ASR_PROVIDERS.filter(p => p.vendor !== 'ares')) {
      expect(p.requiresKey, `${p.vendor} should require key`).toBe(true);
    }
  });
});

describe('ASR_LANGUAGES', () => {
  it('has 24+ languages', () => {
    expect(ASR_LANGUAGES.length).toBeGreaterThanOrEqual(24);
  });

  it('includes zh-CN and en-US', () => {
    expect(ASR_LANGUAGES.find(l => l.value === 'zh-CN')).toBeDefined();
    expect(ASR_LANGUAGES.find(l => l.value === 'en-US')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/providers/catalog.test.ts`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add tests/providers/catalog.test.ts
git commit -m "test: add provider catalog tests"
```

---

### Task 6: Final build, full test suite, and commit

**Files:**
- No new files

- [ ] **Step 1: Build**

Run: `npx tsc`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All 252+ tests pass

- [ ] **Step 3: Verify CLI end-to-end**

Run: `node dist/bin/convoai.js --help`
Expected: Shows all commands including `quickstart|qs`

Run: `node dist/bin/convoai.js quickstart --help`
Expected: Shows quickstart description

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: one-liner install experience with full provider catalogs

curl -fsSL https://convoai.dev/install.sh | bash

- install.sh: detects/installs Node.js, installs convoai CLI, launches quickstart
- quickstart: 6-step wizard with 10 LLM + 12 TTS + 9 ASR providers
- Provider catalog: single source of truth for all vendor configs
- ASR language picker with 24 languages
- Full voice chat session with results display"
```
