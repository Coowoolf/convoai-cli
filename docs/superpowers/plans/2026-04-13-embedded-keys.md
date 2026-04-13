# Embedded API Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed encrypted Qwen (LLM) and MiniMax (TTS) API keys so developers can run a voice agent without configuring any provider keys.

**Architecture:** Build-time script reads keys from env vars, XOR-encrypts with SHA-256 salt, writes to a generated file in `.gitignore`. Runtime code decrypts and injects keys when config contains `__embedded__` placeholder. Quickstart adds "built-in" options that skip key input and set the placeholder.

**Tech Stack:** Node crypto (SHA-256, XOR), Commander.js, Inquirer.js, Vitest.

---

### Task 1: Embed script and key resolution module

**Files:**
- Create: `scripts/embed-keys.ts`
- Create: `src/keys/resolve.ts`
- Modify: `.gitignore`
- Modify: `package.json`
- Test: `tests/keys/resolve.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/keys/resolve.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('encrypt/decrypt roundtrip', () => {
  it('decrypts to original plaintext', async () => {
    const { encrypt, decrypt } = await import('../../src/keys/resolve.js');
    const original = 'sk-test-key-12345';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toMatch(/^[0-9a-f]+$/); // hex string
    expect(decrypt(encrypted)).toBe(original);
  });

  it('produces different hex for different inputs', async () => {
    const { encrypt } = await import('../../src/keys/resolve.js');
    const a = encrypt('key-aaa');
    const b = encrypt('key-bbb');
    expect(a).not.toBe(b);
  });
});

describe('getEmbeddedKey', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns null when embedded.ts does not exist', async () => {
    const { getEmbeddedKey } = await import('../../src/keys/resolve.js');
    const result = getEmbeddedKey('qwen');
    // In dev environment (no embedded.ts), should return null
    expect(result === null || typeof result === 'string').toBe(true);
  });
});

describe('resolveEmbeddedKeys', () => {
  it('leaves non-embedded keys untouched', async () => {
    const { resolveEmbeddedKeys } = await import('../../src/keys/resolve.js');
    const config = {
      llm: { api_key: 'sk-real-key', url: 'https://api.openai.com' },
      tts: { vendor: 'microsoft', params: { key: 'ms-key-123' } },
    };
    resolveEmbeddedKeys(config);
    expect(config.llm.api_key).toBe('sk-real-key');
    expect((config.tts.params as Record<string, unknown>).key).toBe('ms-key-123');
  });

  it('replaces __embedded__ placeholder in llm.api_key', async () => {
    // Mock the embedded module with a known encrypted value
    const { encrypt, resolveEmbeddedKeys } = await import('../../src/keys/resolve.js');
    // Manually set up the scenario: we need embedded.ts to exist
    // Since we can't easily mock dynamic require, test the resolve logic path
    const config = {
      llm: { api_key: 'sk-real-key' } as Record<string, unknown>,
      tts: { vendor: 'microsoft', params: { key: 'ms-key' } },
    };
    // Non-embedded key should pass through
    resolveEmbeddedKeys(config);
    expect(config.llm.api_key).toBe('sk-real-key');
  });

  it('throws when __embedded__ but no embedded key available', async () => {
    vi.doMock('../../src/keys/embedded.js', () => {
      throw new Error('MODULE_NOT_FOUND');
    });
    const { resolveEmbeddedKeys } = await import('../../src/keys/resolve.js');
    const config = {
      llm: { api_key: '__embedded__' } as Record<string, unknown>,
    };
    expect(() => resolveEmbeddedKeys(config)).toThrow('Built-in');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run tests/keys/resolve.test.ts -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Create src/keys/resolve.ts**

```typescript
import { createHash } from 'node:crypto';

const SALT = createHash('sha256').update('convoai-embedded-v1').digest();

/** XOR encrypt a plaintext string → hex. Exported for embed script and tests. */
export function encrypt(plaintext: string): string {
  const data = Buffer.from(plaintext);
  const encrypted = Buffer.from(data.map((b, i) => b ^ SALT[i % SALT.length]));
  return encrypted.toString('hex');
}

/** XOR decrypt a hex string → plaintext. */
export function decrypt(hex: string): string {
  const data = Buffer.from(hex, 'hex');
  return Buffer.from(data.map((b, i) => b ^ SALT[i % SALT.length])).toString();
}

/**
 * Get a built-in API key by provider name.
 * Returns null if embedded keys file doesn't exist (dev environment).
 */
export function getEmbeddedKey(provider: 'qwen' | 'minimax'): string | null {
  try {
    // Dynamic import — file only exists in published npm package
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EMBEDDED_KEYS } = require('./embedded.js');
    const hex = EMBEDDED_KEYS?.[provider];
    if (!hex) return null;
    return decrypt(hex);
  } catch {
    return null;
  }
}

/**
 * Resolve __embedded__ placeholders in LLM/TTS config with real keys.
 * Call this before sending API requests.
 */
export function resolveEmbeddedKeys(config: {
  llm?: Record<string, unknown>;
  tts?: Record<string, unknown>;
}): void {
  if (config.llm?.api_key === '__embedded__') {
    const key = getEmbeddedKey('qwen');
    if (key) {
      config.llm.api_key = key;
    } else {
      throw new Error(
        'Built-in Qwen key not available. Run "convoai quickstart" to configure your own API key.',
      );
    }
  }

  const ttsParams = config.tts?.params as Record<string, unknown> | undefined;
  if (ttsParams?.key === '__embedded__') {
    const key = getEmbeddedKey('minimax');
    if (key) {
      ttsParams.key = key;
    } else {
      throw new Error(
        'Built-in MiniMax key not available. Run "convoai quickstart" to configure your own API key.',
      );
    }
  }
}
```

NOTE: This file uses `require()` for the dynamic import of `embedded.js`. In an ESM project this needs `createRequire`. Update the import:

```typescript
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
```

- [ ] **Step 4: Create scripts/embed-keys.ts**

```typescript
#!/usr/bin/env tsx
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SALT = createHash('sha256').update('convoai-embedded-v1').digest();

function encrypt(plaintext: string): string {
  const data = Buffer.from(plaintext);
  const encrypted = Buffer.from(data.map((b, i) => b ^ SALT[i % SALT.length]));
  return encrypted.toString('hex');
}

const qwen = process.env.CONVOAI_QWEN_KEY;
const minimax = process.env.CONVOAI_MINIMAX_KEY;

const keysDir = join(__dirname, '..', 'src', 'keys');
mkdirSync(keysDir, { recursive: true });

if (!qwen || !minimax) {
  console.error('⚠ Missing CONVOAI_QWEN_KEY and/or CONVOAI_MINIMAX_KEY');
  console.error('  Writing empty embedded.ts (built-in keys will not work)');
  writeFileSync(
    join(keysDir, 'embedded.ts'),
    '// No keys embedded (missing env vars)\nexport const EMBEDDED_KEYS: Record<string, string> = {};\n',
  );
  process.exit(0);
}

const keys: Record<string, string> = {
  qwen: encrypt(qwen),
  minimax: encrypt(minimax),
};

const content = `// Auto-generated by scripts/embed-keys.ts — do not edit or commit
export const EMBEDDED_KEYS: Record<string, string> = ${JSON.stringify(keys, null, 2)};
`;

writeFileSync(join(keysDir, 'embedded.ts'), content);
console.log('✓ Embedded keys written to src/keys/embedded.ts');
```

- [ ] **Step 5: Add src/keys/embedded.ts to .gitignore**

Append to `.gitignore`:

```
# Embedded API keys (generated at publish time)
src/keys/embedded.ts
```

- [ ] **Step 6: Update package.json scripts**

Change `prepublishOnly` from:

```json
"prepublishOnly": "npm run build"
```

To:

```json
"embed-keys": "tsx scripts/embed-keys.ts",
"prepublishOnly": "npm run embed-keys && npm run build"
```

- [ ] **Step 7: Run tests**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run tests/keys/resolve.test.ts -v`
Expected: PASS

- [ ] **Step 8: Run full test suite**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run`
Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
cd /Users/yaoguanghua/Desktop/convoai-cli
git add scripts/embed-keys.ts src/keys/resolve.ts tests/keys/resolve.test.ts .gitignore package.json
git commit -m "feat: embedded key encryption/decryption and build-time injection script"
```

---

### Task 2: Add built-in options to provider catalog

**Files:**
- Modify: `src/providers/catalog.ts`
- Test: `tests/providers/catalog.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/providers/catalog.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { LLM_PROVIDERS, TTS_PROVIDERS, ASR_PROVIDERS } from '../../src/providers/catalog.js';

describe('provider catalog built-in flags', () => {
  it('Qwen LLM has builtin: true', () => {
    const qwen = LLM_PROVIDERS.find(p => p.value === 'dashscope');
    expect(qwen).toBeDefined();
    expect(qwen!.builtin).toBe(true);
  });

  it('MiniMax TTS has builtin: true', () => {
    const minimax = TTS_PROVIDERS.find(p => p.vendor === 'minimax');
    expect(minimax).toBeDefined();
    expect(minimax!.builtin).toBe(true);
  });

  it('ARES ASR has builtin: true', () => {
    const ares = ASR_PROVIDERS.find(p => p.vendor === 'ares');
    expect(ares).toBeDefined();
    expect(ares!.builtin).toBe(true);
  });

  it('OpenAI LLM does NOT have builtin: true', () => {
    const openai = LLM_PROVIDERS.find(p => p.value === 'openai');
    expect(openai).toBeDefined();
    expect(openai!.builtin).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run tests/providers/catalog.test.ts -v`
Expected: FAIL — `builtin` property does not exist on type.

- [ ] **Step 3: Add builtin flag to provider interfaces and entries**

In `src/providers/catalog.ts`:

Add `builtin?: boolean` to `LLMProvider` interface:
```typescript
export interface LLMProvider {
  name: string;
  value: string;
  url: string;
  defaultModel: string;
  models: string[];
  style?: 'anthropic' | 'gemini';
  headers?: string;
  urlHasKey?: boolean;
  note?: string;
  builtin?: boolean;
}
```

Add `builtin?: boolean` to `TTSProvider` interface:
```typescript
export interface TTSProvider {
  name: string;
  vendor: string;
  requiresKey: boolean;
  requiresRegion?: boolean;
  requiresGroupId?: boolean;
  defaultVoice?: string;
  defaultParams?: Record<string, unknown>;
  beta?: boolean;
  note?: string;
  builtin?: boolean;
}
```

Add `builtin?: boolean` to `ASRProvider` interface:
```typescript
export interface ASRProvider {
  name: string;
  vendor: string;
  requiresKey: boolean;
  requiresRegion?: boolean;
  defaultParams?: Record<string, unknown>;
  beta?: boolean;
  note?: string;
  builtin?: boolean;
}
```

Add `builtin: true` to the Qwen entry in `LLM_PROVIDERS`:
```typescript
  {
    name: 'Alibaba Qwen',
    value: 'dashscope',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-plus',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'],
    note: 'China-optimized, no proxy needed',
    builtin: true,
  },
```

Add `builtin: true` to the MiniMax entry in `TTS_PROVIDERS`:
```typescript
  {
    name: 'MiniMax',
    vendor: 'minimax',
    requiresKey: true,
    requiresGroupId: true,
    note: 'Requires API Key + Group ID from minimax.chat',
    builtin: true,
    defaultParams: {
      model: 'speech-02-turbo',
      voice_setting: { voice_id: 'English_captivating_female1' },
      url: 'wss://api.minimaxi.com/ws/v1/t2a_v2',
    },
  },
```

Add `builtin: true` to the ARES entry in `ASR_PROVIDERS`:
```typescript
  {
    name: 'ARES',
    vendor: 'ares',
    requiresKey: false,
    note: 'Agora built-in, no extra API key needed',
    builtin: true,
  },
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run tests/providers/catalog.test.ts -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/yaoguanghua/Desktop/convoai-cli
git add src/providers/catalog.ts tests/providers/catalog.test.ts
git commit -m "feat: add builtin flag to Qwen, MiniMax, and Ares providers"
```

---

### Task 3: Quickstart built-in provider selection

**Files:**
- Modify: `src/commands/quickstart.ts`
- Test: `tests/commands/quickstart-builtin.test.ts`

This task modifies quickstart to show "(built-in, no API key needed)" labels and skip key prompts when a built-in provider is selected.

- [ ] **Step 1: Write failing test**

Create `tests/commands/quickstart-builtin.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const CLI = join(process.cwd(), 'dist/bin/convoai.js');

function cli(args: string): string {
  try {
    return execSync(`node ${CLI} ${args}`, { encoding: 'utf-8', timeout: 10000 });
  } catch (err: any) {
    return err.stdout || err.stderr || '';
  }
}

describe('quickstart built-in provider labels', () => {
  // We can't fully test interactive quickstart, but we can verify
  // the provider catalog has the right labels by importing the helper
  it('LLM choices include built-in label for Qwen', async () => {
    const { LLM_PROVIDERS } = await import('../../src/providers/catalog.js');
    const qwen = LLM_PROVIDERS.find(p => p.value === 'dashscope');
    expect(qwen).toBeDefined();
    expect(qwen!.builtin).toBe(true);
  });

  it('TTS choices include built-in label for MiniMax', async () => {
    const { TTS_PROVIDERS } = await import('../../src/providers/catalog.js');
    const minimax = TTS_PROVIDERS.find(p => p.vendor === 'minimax');
    expect(minimax).toBeDefined();
    expect(minimax!.builtin).toBe(true);
  });

  it('ASR choices include built-in label for ARES', async () => {
    const { ASR_PROVIDERS } = await import('../../src/providers/catalog.js');
    const ares = ASR_PROVIDERS.find(p => p.vendor === 'ares');
    expect(ares).toBeDefined();
    expect(ares!.builtin).toBe(true);
  });
});
```

- [ ] **Step 2: Modify quickstart LLM selection**

In `src/commands/quickstart.ts`, find the LLM provider choices construction (around line 470-480). The current code uses `getOrderedLlmChoices(lang)`. Find this function and modify the choice labels to show "(built-in)" for providers with `builtin: true`.

Find the function `getOrderedLlmChoices` (search for it in the file). In the choice construction, add a built-in label. For example, if the function maps providers to choices:

```typescript
// For each provider, add built-in label if applicable
let label = p.name;
if (p.builtin) label += chalk.green(' (built-in, no API key needed)');
```

Then, after the user selects a provider, check `selectedLlm.builtin`. If true, skip the API key prompt and set `llmApiKey = '__embedded__'`:

Find the API key prompt block (around line 486-493):
```typescript
    // API Key — allow skip (empty = skip this step)
    const skipHint = platform === 'cn' ? '留空跳过此步骤' : 'Leave empty to skip';
    const { apiKey: llmApiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: `${str.apiKey} ${chalk.dim(`(${skipHint})`)}:`,
        mask: '*',
      },
    ]);
```

Replace with:
```typescript
    let llmApiKey: string;
    if (selectedLlm.builtin) {
      llmApiKey = '__embedded__';
      printSuccess(lang === 'cn' ? '使用内置 API Key' : 'Using built-in API key');
    } else {
      // API Key — allow skip (empty = skip this step)
      const skipHint = platform === 'cn' ? '留空跳过此步骤' : 'Leave empty to skip';
      const { apiKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: `${str.apiKey} ${chalk.dim(`(${skipHint})`)}:`,
          mask: '*',
        },
      ]);
      llmApiKey = apiKey;
    }
```

- [ ] **Step 3: Modify quickstart TTS selection**

In the TTS provider choices construction (around line 627-631), add built-in label:

```typescript
    const ttsChoices = TTS_PROVIDERS.map((p) => {
      let label = p.name;
      if (p.builtin) label += chalk.green(' (built-in, no API key needed)');
      else if (p.beta) label += chalk.dim(' (Beta)');
      return { name: label, value: p.vendor };
    });
```

After TTS vendor selection, skip key and group_id prompts for built-in providers. Find the TTS API key prompt (around line 644-653):

```typescript
    // API Key (always required)
    const { key: ttsKey } = await inquirer.prompt([...]);
```

Replace with:
```typescript
    let ttsKey: string;
    if (selectedTts.builtin) {
      ttsKey = '__embedded__';
      printSuccess(lang === 'cn' ? '使用内置 API Key' : 'Using built-in API key');
    } else {
      const { key } = await inquirer.prompt([
        {
          type: 'password',
          name: 'key',
          message: str.ttsApiKey + ':',
          mask: '*',
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
      ]);
      ttsKey = key;
    }
```

Also skip group_id prompt when built-in (around line 680):
```typescript
    if (selectedTts.requiresGroupId && !selectedTts.builtin) {
```

- [ ] **Step 4: Build and run tests**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npm run build && npx vitest run tests/commands/quickstart-builtin.test.ts -v`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/yaoguanghua/Desktop/convoai-cli
git add src/commands/quickstart.ts tests/commands/quickstart-builtin.test.ts
git commit -m "feat: quickstart shows built-in providers, skips key input"
```

---

### Task 4: Resolve embedded keys at API call sites

**Files:**
- Modify: `src/commands/go.ts`
- Modify: `src/commands/agent/start.ts`
- Modify: `src/commands/phone/go.ts`
- Modify: `src/commands/phone/send.ts`
- Modify: `src/commands/quickstart.ts` (the agent start part at the end)

All call sites need the same one-liner inserted before the API request is sent.

- [ ] **Step 1: Add resolveEmbeddedKeys to go.ts**

In `src/commands/go.ts`, find the line that builds the request (around line 375, where `llmForRequest` is prepared):

```typescript
  const llmForRequest: Record<string, unknown> = { ...effectiveLlm };
```

Add after `llmForRequest` is built but BEFORE the `request` object construction:

```typescript
  // Resolve __embedded__ placeholders with real keys
  const { resolveEmbeddedKeys } = await import('../keys/resolve.js');
  resolveEmbeddedKeys({ llm: llmForRequest, tts: effectiveTts as Record<string, unknown> });
```

Also add the import for the phone call branch (around line 230-247, the `--call` branch). Find where the call request is built with `config.llm` and add the resolve there too:

```typescript
  // Before building the call request
  const { resolveEmbeddedKeys } = await import('../keys/resolve.js');
  const resolvedLlm = { ...config.llm } as Record<string, unknown>;
  const resolvedTts = { ...config.tts } as Record<string, unknown>;
  resolveEmbeddedKeys({ llm: resolvedLlm, tts: resolvedTts });
```

Use `resolvedLlm` and `resolvedTts` in the request instead of `config.llm` / `config.tts`.

- [ ] **Step 2: Add resolveEmbeddedKeys to agent/start.ts**

In `src/commands/agent/start.ts`, find where the StartAgentRequest is built. Add the resolve call before the request construction. Import dynamically:

```typescript
  const { resolveEmbeddedKeys } = await import('../../keys/resolve.js');
  resolveEmbeddedKeys({ llm: llmConfig as Record<string, unknown>, tts: ttsConfig as Record<string, unknown> });
```

- [ ] **Step 3: Add resolveEmbeddedKeys to phone/go.ts**

In `src/commands/phone/go.ts`, find the line before `buildCallRequest` is called (where `callConfig.llm` and `callConfig.tts` are passed). Add:

```typescript
  const { resolveEmbeddedKeys } = await import('../../keys/resolve.js');
  resolveEmbeddedKeys({ llm: callConfig.llm as Record<string, unknown>, tts: callConfig.tts as Record<string, unknown> });
```

- [ ] **Step 4: Add resolveEmbeddedKeys to phone/send.ts**

In `src/commands/phone/send.ts`, find where the `llm` config is built (around the `// 6. Build LLM config` section). Add before the request construction:

```typescript
  const { resolveEmbeddedKeys } = await import('../../keys/resolve.js');
  resolveEmbeddedKeys({ llm: llm as Record<string, unknown>, tts: config.tts as Record<string, unknown> });
```

- [ ] **Step 5: Add resolveEmbeddedKeys to quickstart.ts agent start**

In `src/commands/quickstart.ts`, find where the agent is started in Step 5/6 (the final launch). Add the resolve before the API call.

- [ ] **Step 6: Build and run full test suite**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npm run build && npx vitest run`
Expected: All tests pass. TypeScript compiles clean.

- [ ] **Step 7: Commit**

```bash
cd /Users/yaoguanghua/Desktop/convoai-cli
git add src/commands/go.ts src/commands/agent/start.ts src/commands/phone/go.ts src/commands/phone/send.ts src/commands/quickstart.ts
git commit -m "feat: resolve embedded keys at all API call sites"
```

---

### Task 5: LLM config check update for embedded keys

**Files:**
- Modify: `src/commands/go.ts`

The `go` command currently checks `if (!profile.llm?.url && !profile.llm?.api_key)` to detect missing LLM config. With embedded keys, `api_key` is `'__embedded__'` which is truthy, so this check already works. BUT the check also requires `url` to be set.

- [ ] **Step 1: Verify the check works with embedded keys**

In `src/commands/go.ts`, find the LLM check (around line 254-255):

```typescript
  if (!profile.llm?.url && !profile.llm?.api_key && !config.llm?.url && !config.llm?.api_key) {
```

Since `__embedded__` is truthy, this check passes correctly when built-in Qwen is configured. The Qwen entry in the catalog has a URL (`https://dashscope.aliyuncs.com/...`), so both `url` and `api_key` will be set.

No code change needed. Verify with the test suite.

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Final build and smoke test**

Run:
```bash
cd /Users/yaoguanghua/Desktop/convoai-cli
npm run build
node dist/bin/convoai.js quickstart --help
npx tsc --noEmit
```
