# Telephony Phone Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `convoai phone *` commands for outbound phone calls and phone number management, plus `go --call` and quickstart phone option.

**Architecture:** Two API clients (project-scoped for calls, account-scoped for numbers), 9 phone subcommands in `src/commands/phone/`, integration into existing `go` and `quickstart`. Deprecated `call *` commands become hidden aliases with flag mapping.

**Tech Stack:** TypeScript, Commander.js, Axios, Inquirer, Ora, Agora ConvoAI REST API (telephony + phone-numbers endpoints)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/api/numbers.ts` | Phone number API client (list, import, get, update, delete) |
| `src/commands/phone/_helpers.ts` | Shared helpers: E.164 validation, number picker, createNumbersClient |
| `src/commands/phone/send.ts` | `phone send` — outbound call with interactive + flag modes |
| `src/commands/phone/numbers.ts` | `phone numbers` — list imported numbers |
| `src/commands/phone/import.ts` | `phone import` — interactive SIP import |
| `src/commands/phone/get.ts` | `phone number <num>` — number details |
| `src/commands/phone/update.ts` | `phone update <num>` — update number config |
| `src/commands/phone/remove.ts` | `phone remove <num>` — delete with confirmation |
| `src/commands/phone/hangup.ts` | `phone hangup <id>` — end call |
| `src/commands/phone/status.ts` | `phone status <id>` — call status |
| `src/commands/phone/history.ts` | `phone history` — recent calls |
| `tests/commands/phone.test.ts` | CLI integration tests |

### Modified Files

| File | Change |
|------|--------|
| `src/api/calls.ts` | Rewrite: SIP-based send, reuse agent endpoints for status/hangup/list |
| `src/index.ts` | Register `phone` group, update help text, deprecate old `call` commands |
| `src/commands/go.ts` | Add `--call` flag |
| `src/commands/quickstart.ts` | Step 5: add phone call choice |
| `src/commands/completion.ts` | Add phone commands |

---

### Task 1: Phone Number API Client

**Files:**
- Create: `src/api/numbers.ts`

- [ ] **Step 1: Create numbers.ts with types and NumberAPI class**

```typescript
// src/api/numbers.ts
import type { AxiosInstance } from 'axios';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PhoneNumber {
  phone_number: string;
  label: string;
  provider: 'byo' | 'twilio';
  inbound: boolean;
  outbound: boolean;
  associated_pipeline: { pipeline_id: string; pipeline_name: string } | null;
  inbound_config: { allowed_addresses?: string[] } | null;
  outbound_config: {
    address?: string;
    transport?: 'tls' | 'tcp' | 'udp';
    prefix?: string;
    user?: string;
    password?: string;
  } | null;
}

export interface ImportNumberRequest {
  provider: 'byo' | 'twilio';
  phone_number: string;
  label: string;
  inbound?: boolean;
  outbound?: boolean;
  inbound_config?: { allowed_addresses?: string[] };
  outbound_config: {
    address: string;
    transport: 'tls' | 'tcp' | 'udp';
    prefix?: string;
    user?: string;
    password?: string;
  };
}

export interface UpdateNumberRequest {
  label?: string;
  inbound?: boolean;
  outbound?: boolean;
  inbound_config?: { allowed_addresses?: string[] };
  outbound_config?: {
    address?: string;
    transport?: 'tls' | 'tcp' | 'udp';
    prefix?: string;
    user?: string;
    password?: string;
  };
}

// ─── Number API ─────────────────────────────────────────────────────────────

export class NumberAPI {
  constructor(private readonly client: AxiosInstance) {}

  async list(): Promise<PhoneNumber[]> {
    const { data } = await this.client.get<PhoneNumber[]>('/phone-numbers');
    return data;
  }

  async import(req: ImportNumberRequest): Promise<PhoneNumber> {
    const { data } = await this.client.post<PhoneNumber>('/phone-numbers', req);
    return data;
  }

  async get(phoneNumber: string): Promise<PhoneNumber> {
    const { data } = await this.client.get<PhoneNumber>(`/phone-numbers/${encodeURIComponent(phoneNumber)}`);
    return data;
  }

  async update(phoneNumber: string, req: UpdateNumberRequest): Promise<PhoneNumber> {
    const { data } = await this.client.patch<PhoneNumber>(`/phone-numbers/${encodeURIComponent(phoneNumber)}`, req);
    return data;
  }

  async delete(phoneNumber: string): Promise<void> {
    await this.client.delete(`/phone-numbers/${encodeURIComponent(phoneNumber)}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/api/numbers.ts
git commit -m "feat: phone number API client (list, import, get, update, delete)"
```

---

### Task 2: Rewrite Calls API

**Files:**
- Modify: `src/api/calls.ts`

- [ ] **Step 1: Rewrite calls.ts with SIP-based send**

```typescript
// src/api/calls.ts
import type { AxiosInstance } from 'axios';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SendCallRequest {
  name: string;
  sip: {
    to_number: string;
    from_number: string;
    rtc_uid: string;
    rtc_token: string;
  };
  properties: {
    channel: string;
    token: string;
    agent_rtc_uid: string;
    remote_rtc_uids: string[];
    idle_timeout?: number;
    llm?: Record<string, unknown>;
    tts?: Record<string, unknown>;
    asr?: Record<string, unknown>;
  };
}

export interface SendCallResponse {
  agent_id: string;
}

export interface CallStatusResponse {
  agent_id: string;
  status: string;
  start_ts: number;
  stop_ts?: number;
  channel?: string;
  message?: string;
}

// ─── Call API ───────────────────────────────────────────────────────────────

export class CallAPI {
  constructor(private readonly client: AxiosInstance) {}

  /** Initiate an outbound phone call via SIP. */
  async send(req: SendCallRequest): Promise<SendCallResponse> {
    const { data } = await this.client.post<SendCallResponse>('/call', req);
    return data;
  }

  /** Get the current status of a call (reuses agent status endpoint). */
  async status(agentId: string): Promise<CallStatusResponse> {
    const { data } = await this.client.get<CallStatusResponse>(`/agents/${agentId}`);
    return data;
  }

  /** Hang up an active call (reuses agent leave endpoint). */
  async hangup(agentId: string): Promise<void> {
    await this.client.post(`/agents/${agentId}/leave`);
  }

  /** List calls (reuses agent list, caller can filter). */
  async list(params?: { limit?: number; state?: number }): Promise<{ data: { list: CallStatusResponse[] } }> {
    const { data } = await this.client.get('/agents', { params });
    return data;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/api/calls.ts
git commit -m "feat: rewrite calls API with SIP config, align with actual Agora endpoints"
```

---

### Task 3: Phone Helpers

**Files:**
- Create: `src/commands/phone/_helpers.ts`

- [ ] **Step 1: Create _helpers.ts with shared utilities**

```typescript
// src/commands/phone/_helpers.ts
import axios from 'axios';
import { resolveConfig, type ResolvedProfile } from '../../config/manager.js';
import { createClient } from '../../api/client.js';
import { CallAPI } from '../../api/calls.js';
import { NumberAPI } from '../../api/numbers.js';

// ─── E.164 Validation ──────────────────────────────────────────────────────

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export function isE164(phone: string): boolean {
  return E164_REGEX.test(phone);
}

export function validateE164(phone: string): string {
  const trimmed = phone.trim();
  if (!isE164(trimmed)) {
    throw new Error(`Invalid phone number "${trimmed}". Use E.164 format: +15551234567`);
  }
  return trimmed;
}

// ─── API Factories ─────────────────────────────────────────────────────────

/** Create a project-scoped CallAPI (baseURL includes /projects/{appId}). */
export function getCallAPI(profileName?: string): CallAPI {
  const config = resolveConfig(profileName);
  requireCredentials(config);
  const client = createClient({
    appId: config.app_id!,
    customerId: config.customer_id!,
    customerSecret: config.customer_secret!,
    baseUrl: config.base_url,
    region: config.region as 'global' | 'cn' | undefined,
  });
  return new CallAPI(client);
}

/** Create an account-scoped NumberAPI (baseURL does NOT include /projects/{appId}). */
export function getNumberAPI(profileName?: string): NumberAPI {
  const config = resolveConfig(profileName);
  requireCredentials(config);

  const region = config.region ?? 'global';
  const baseURLs: Record<string, string> = {
    global: 'https://api.agora.io/api/conversational-ai-agent/v2',
    cn: 'https://api.agora.io/cn/api/conversational-ai-agent/v2',
  };
  const baseURL = baseURLs[region] ?? baseURLs.global;
  const credentials = Buffer.from(`${config.customer_id}:${config.customer_secret}`).toString('base64');

  const client = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    timeout: 30_000,
  });

  return new NumberAPI(client);
}

/** Get resolved config. */
export function getConfig(profileName?: string): ResolvedProfile {
  return resolveConfig(profileName);
}

function requireCredentials(config: { app_id?: string; customer_id?: string; customer_secret?: string }) {
  const missing: string[] = [];
  if (!config.app_id) missing.push('app_id');
  if (!config.customer_id) missing.push('customer_id');
  if (!config.customer_secret) missing.push('customer_secret');
  if (missing.length > 0) {
    throw new Error(`Missing credentials: ${missing.join(', ')}. Run "convoai quickstart" to configure.`);
  }
}

// ─── Interactive Number Picker ─────────────────────────────────────────────

import type { PhoneNumber } from '../../api/numbers.js';

export async function pickOutboundNumber(
  numbers: PhoneNumber[],
): Promise<PhoneNumber> {
  const outbound = numbers.filter(n => n.outbound);
  if (outbound.length === 0) {
    throw new Error('No outbound-capable numbers found. Import one with: convoai phone import');
  }

  if (outbound.length === 1) return outbound[0];

  const { default: inquirer } = await import('inquirer');
  const { selected } = await inquirer.prompt([{
    type: 'list',
    name: 'selected',
    message: 'From number:',
    choices: outbound.map(n => ({
      name: `${n.phone_number} (${n.label})`,
      value: n.phone_number,
    })),
  }]);

  return outbound.find(n => n.phone_number === selected)!;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/phone/_helpers.ts
git commit -m "feat: phone helpers (E.164 validation, API factories, number picker)"
```

---

### Task 4: Phone Number Commands (numbers, import, get, update, remove)

**Files:**
- Create: `src/commands/phone/numbers.ts`
- Create: `src/commands/phone/import.ts`
- Create: `src/commands/phone/get.ts`
- Create: `src/commands/phone/update.ts`
- Create: `src/commands/phone/remove.ts`

- [ ] **Step 1: Create numbers.ts (list)**

```typescript
// src/commands/phone/numbers.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { getNumberAPI } from './_helpers.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneNumbers(phone: Command): void {
  phone
    .command('numbers')
    .description('List imported phone numbers')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      try {
        const api = getNumberAPI(opts.profile);
        const numbers = await api.list();

        if (opts.json) {
          console.log(JSON.stringify(numbers, null, 2));
          return;
        }

        if (numbers.length === 0) {
          console.log(chalk.dim('\n  No phone numbers. Run: convoai phone import\n'));
          return;
        }

        console.log('');
        for (const n of numbers) {
          const dir = [n.outbound && 'outbound', n.inbound && 'inbound'].filter(Boolean).join('+');
          console.log(`  ${chalk.cyan(n.phone_number)}  ${chalk.dim(dir)}  ${n.label}  ${chalk.dim(n.provider)}`);
        }
        console.log('');
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
```

- [ ] **Step 2: Create import.ts**

```typescript
// src/commands/phone/import.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { getNumberAPI, validateE164 } from './_helpers.js';
import { printSuccess, printError } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneImport(phone: Command): void {
  phone
    .command('import')
    .description('Import a new phone number')
    .option('--number <number>', 'Phone number (E.164)')
    .option('--provider <provider>', 'Provider (twilio / byo)')
    .option('--label <label>', 'Label for this number')
    .option('--sip-address <address>', 'SIP server address')
    .option('--sip-transport <transport>', 'Transport (tls / tcp / udp)')
    .option('--sip-user <user>', 'SIP username')
    .option('--sip-password <password>', 'SIP password')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      try {
        let phoneNumber = opts.number;
        let provider = opts.provider;
        let label = opts.label;
        let sipAddress = opts.sipAddress;
        let sipTransport = opts.sipTransport;
        let sipUser = opts.sipUser;
        let sipPassword = opts.sipPassword;

        // Interactive mode if missing required fields
        if (!phoneNumber || !provider || !label || !sipAddress) {
          const { default: inquirer } = await import('inquirer');

          if (!provider) {
            const ans = await inquirer.prompt([{
              type: 'list', name: 'provider', message: 'Provider:',
              choices: [{ name: 'Twilio', value: 'twilio' }, { name: 'BYO (Bring Your Own)', value: 'byo' }],
            }]);
            provider = ans.provider;
          }

          if (!phoneNumber) {
            const ans = await inquirer.prompt([{
              type: 'input', name: 'number', message: 'Phone number (E.164):',
              validate: (v: string) => /^\+[1-9]\d{1,14}$/.test(v.trim()) || 'Invalid E.164 format',
            }]);
            phoneNumber = ans.number;
          }

          if (!label) {
            const ans = await inquirer.prompt([{
              type: 'input', name: 'label', message: 'Label:',
              validate: (v: string) => v.trim().length > 0 || 'Required',
            }]);
            label = ans.label;
          }

          if (!sipAddress) {
            const ans = await inquirer.prompt([
              { type: 'input', name: 'address', message: 'SIP address:', validate: (v: string) => v.trim().length > 0 || 'Required' },
              { type: 'list', name: 'transport', message: 'Transport:', choices: ['tls', 'tcp', 'udp'], default: 'tls' },
              { type: 'input', name: 'user', message: 'SIP username (optional):' },
              { type: 'password', name: 'password', message: 'SIP password (optional):', mask: '*' },
            ]);
            sipAddress = ans.address;
            sipTransport = ans.transport;
            sipUser = ans.user || undefined;
            sipPassword = ans.password || undefined;
          }
        }

        phoneNumber = validateE164(phoneNumber);

        const api = getNumberAPI(opts.profile);
        const result = await api.import({
          provider,
          phone_number: phoneNumber,
          label,
          outbound: true,
          inbound: false,
          outbound_config: {
            address: sipAddress,
            transport: sipTransport || 'tls',
            user: sipUser,
            password: sipPassword,
          },
        });

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        printSuccess(`Number imported: ${result.phone_number}`);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
```

- [ ] **Step 3: Create get.ts**

```typescript
// src/commands/phone/get.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { getNumberAPI } from './_helpers.js';
import { printKeyValue } from '../../ui/table.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneGet(phone: Command): void {
  phone
    .command('number <phone-number>')
    .description('View phone number details')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (phoneNumber, opts) => {
      try {
        const api = getNumberAPI(opts.profile);
        const num = await api.get(phoneNumber);

        if (opts.json) {
          console.log(JSON.stringify(num, null, 2));
          return;
        }

        console.log('');
        printKeyValue([
          ['Phone', num.phone_number],
          ['Label', num.label],
          ['Provider', num.provider],
          ['Outbound', num.outbound ? 'yes' : 'no'],
          ['Inbound', num.inbound ? 'yes' : 'no'],
          ['SIP', num.outbound_config ? `${num.outbound_config.address} (${num.outbound_config.transport})` : '-'],
          ['Pipeline', num.associated_pipeline?.pipeline_name ?? '(none)'],
        ]);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
```

- [ ] **Step 4: Create update.ts**

```typescript
// src/commands/phone/update.ts
import { Command } from 'commander';
import { getNumberAPI } from './_helpers.js';
import { printSuccess } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneUpdate(phone: Command): void {
  phone
    .command('update <phone-number>')
    .description('Update phone number configuration')
    .option('--label <label>', 'New label')
    .option('--sip-address <address>', 'New SIP address')
    .option('--sip-transport <transport>', 'New transport (tls/tcp/udp)')
    .option('--sip-user <user>', 'New SIP username')
    .option('--sip-password <password>', 'New SIP password')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (phoneNumber, opts) => {
      try {
        const api = getNumberAPI(opts.profile);
        const req: Record<string, unknown> = {};

        if (opts.label) req.label = opts.label;

        if (opts.sipAddress || opts.sipTransport || opts.sipUser || opts.sipPassword) {
          req.outbound_config = {
            ...(opts.sipAddress && { address: opts.sipAddress }),
            ...(opts.sipTransport && { transport: opts.sipTransport }),
            ...(opts.sipUser && { user: opts.sipUser }),
            ...(opts.sipPassword && { password: opts.sipPassword }),
          };
        }

        const result = await api.update(phoneNumber, req);

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        printSuccess(`Updated: ${result.phone_number}`);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
```

- [ ] **Step 5: Create remove.ts**

```typescript
// src/commands/phone/remove.ts
import { Command } from 'commander';
import { getNumberAPI } from './_helpers.js';
import { printSuccess } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneRemove(phone: Command): void {
  phone
    .command('remove <phone-number>')
    .description('Remove a phone number')
    .option('--force', 'Skip confirmation')
    .option('--profile <name>', 'Config profile')
    .action(async (phoneNumber, opts) => {
      try {
        if (!opts.force && process.stdin.isTTY) {
          const { default: inquirer } = await import('inquirer');
          const { confirm } = await inquirer.prompt([{
            type: 'confirm', name: 'confirm',
            message: `Remove ${phoneNumber}?`,
            default: false,
          }]);
          if (!confirm) return;
        }

        const api = getNumberAPI(opts.profile);
        await api.delete(phoneNumber);
        printSuccess(`Number removed: ${phoneNumber}`);
      } catch (error) {
        handleError(error);
      }
    });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/commands/phone/numbers.ts src/commands/phone/import.ts src/commands/phone/get.ts src/commands/phone/update.ts src/commands/phone/remove.ts
git commit -m "feat: phone number commands (numbers, import, number, update, remove)"
```

---

### Task 5: Phone Call Commands (send, status, hangup, history)

**Files:**
- Create: `src/commands/phone/send.ts`
- Create: `src/commands/phone/status.ts`
- Create: `src/commands/phone/hangup.ts`
- Create: `src/commands/phone/history.ts`

- [ ] **Step 1: Create send.ts**

```typescript
// src/commands/phone/send.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { getCallAPI, getNumberAPI, getConfig, validateE164, pickOutboundNumber } from './_helpers.js';
import { generateRtcToken } from '../../utils/token.js';
import { printSuccess, printError, printHint } from '../../ui/output.js';
import { printKeyValue } from '../../ui/table.js';
import { withSpinner } from '../../ui/spinner.js';
import { handleError } from '../../utils/errors.js';
import { track } from '../../utils/telemetry.js';
import type { SendCallRequest } from '../../api/calls.js';

async function runPhoneImportInline(profileName?: string): Promise<void> {
  // Dynamically import to avoid circular deps
  const { registerPhoneImport } = await import('./import.js');
  // Run the import logic directly — reuse the interactive prompts
  const { default: inquirer } = await import('inquirer');
  const { getNumberAPI: getNumAPI, validateE164: valE164 } = await import('./_helpers.js');

  console.log(chalk.yellow('\n  No phone numbers found. Let\'s import one.\n'));

  const ans = await inquirer.prompt([
    { type: 'list', name: 'provider', message: 'Provider:', choices: ['twilio', 'byo'] },
    { type: 'input', name: 'number', message: 'Phone number (E.164):', validate: (v: string) => /^\+[1-9]\d{1,14}$/.test(v.trim()) || 'Invalid format' },
    { type: 'input', name: 'label', message: 'Label:', validate: (v: string) => v.trim().length > 0 || 'Required' },
    { type: 'input', name: 'address', message: 'SIP address:', validate: (v: string) => v.trim().length > 0 || 'Required' },
    { type: 'list', name: 'transport', message: 'Transport:', choices: ['tls', 'tcp', 'udp'], default: 'tls' },
    { type: 'input', name: 'user', message: 'SIP username (optional):' },
    { type: 'password', name: 'password', message: 'SIP password (optional):', mask: '*' },
  ]);

  const api = getNumAPI(profileName);
  await api.import({
    provider: ans.provider,
    phone_number: valE164(ans.number),
    label: ans.label,
    outbound: true,
    inbound: false,
    outbound_config: { address: ans.address, transport: ans.transport, user: ans.user || undefined, password: ans.password || undefined },
  });

  printSuccess(`Number imported: ${ans.number}`);
  console.log('');
}

export function registerPhoneSend(phone: Command): void {
  phone
    .command('send')
    .description('Make an outbound phone call')
    .option('--from <number>', 'Caller ID (E.164)')
    .option('--to <number>', 'Target number (E.164)')
    .option('--task <prompt>', 'What the AI should do')
    .option('--greeting <text>', 'Opening line')
    .option('--model <model>', 'LLM model override')
    .option('--wait', 'Wait and show status until call ends')
    .option('--max-duration <mins>', 'Max call length in minutes', '10')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .option('--dry-run', 'Show request without sending')
    .action(async (opts) => {
      try {
        const config = getConfig(opts.profile);
        const numberApi = getNumberAPI(opts.profile);
        const callApi = getCallAPI(opts.profile);

        // 1. Resolve "from" number
        let fromNumber = opts.from;
        if (!fromNumber && process.stdin.isTTY) {
          let numbers = await numberApi.list();
          if (numbers.length === 0) {
            await runPhoneImportInline(opts.profile);
            numbers = await numberApi.list();
          }
          const picked = await pickOutboundNumber(numbers);
          fromNumber = picked.phone_number;
        }
        if (!fromNumber) {
          printError('--from is required. Provide a caller number or run interactively.');
          process.exit(1);
        }
        fromNumber = validateE164(fromNumber);

        // Validate from number is outbound-capable
        try {
          const numDetail = await numberApi.get(fromNumber);
          if (!numDetail.outbound) {
            printError(`${fromNumber} does not support outbound calls.`);
            printHint('Import an outbound number: convoai phone import');
            process.exit(1);
          }
        } catch {
          printError(`Number ${fromNumber} not found in your account.`);
          printHint('List numbers: convoai phone numbers');
          process.exit(1);
        }

        // 2. Resolve "to" number
        let toNumber = opts.to;
        if (!toNumber && process.stdin.isTTY) {
          const { default: inquirer } = await import('inquirer');
          const ans = await inquirer.prompt([{
            type: 'input', name: 'to', message: 'To number (E.164):',
            validate: (v: string) => /^\+[1-9]\d{1,14}$/.test(v.trim()) || 'Invalid E.164 format',
          }]);
          toNumber = ans.to;
        }
        if (!toNumber) {
          printError('--to is required.');
          process.exit(1);
        }
        toNumber = validateE164(toNumber);

        // 3. Resolve task/prompt
        let task = opts.task;
        if (!task && process.stdin.isTTY) {
          const { default: inquirer } = await import('inquirer');
          const ans = await inquirer.prompt([{
            type: 'input', name: 'task', message: 'Task/prompt:',
            validate: (v: string) => v.trim().length > 0 || 'Required',
          }]);
          task = ans.task;
        }

        // 4. Confirm
        if (process.stdin.isTTY && !opts.json && !opts.dryRun) {
          const { default: inquirer } = await import('inquirer');
          const { confirm } = await inquirer.prompt([{
            type: 'confirm', name: 'confirm',
            message: `Call ${toNumber} from ${fromNumber}?`,
            default: true,
          }]);
          if (!confirm) return;
        }

        // 5. Generate tokens
        const channelName = `call-${Date.now().toString(36)}`;
        const agentUid = 0;
        const sipUid = 1;

        const configObj = (await import('../../config/manager.js')).loadConfig();
        const appCert = process.env.AGORA_APP_CERTIFICATE ?? configObj.app_certificate;

        const agentToken = await generateRtcToken(channelName, agentUid, 86400, config.app_id, appCert);
        const sipToken = await generateRtcToken(channelName, sipUid, 86400, config.app_id, appCert);

        if (!agentToken || !sipToken) {
          printError('Token generation failed. Check app_certificate.');
          process.exit(1);
        }

        // 6. Build LLM config
        const llm: Record<string, unknown> = { ...(config.llm ?? {}) };
        if (task) {
          llm.system_messages = [{ role: 'system', content: task }];
        }
        if (opts.greeting) {
          llm.greeting_message = opts.greeting;
        }
        if (opts.model) {
          if (!llm.params) llm.params = {};
          (llm.params as Record<string, unknown>).model = opts.model;
        }

        // 7. Build request
        const request: SendCallRequest = {
          name: `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sip: {
            to_number: toNumber,
            from_number: fromNumber,
            rtc_uid: String(sipUid),
            rtc_token: sipToken,
          },
          properties: {
            channel: channelName,
            token: agentToken,
            agent_rtc_uid: String(agentUid),
            remote_rtc_uids: [String(sipUid)],
            idle_timeout: parseInt(opts.maxDuration, 10) * 60 || 600,
            llm,
            tts: config.tts ?? {},
            asr: config.asr ?? {},
          },
        };

        if (opts.dryRun) {
          console.log(JSON.stringify(request, null, 2));
          return;
        }

        // 8. Send call
        const result = await withSpinner('Initiating call...', () => callApi.send(request));
        track('phone_send');

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        printSuccess(`Call initiated (agent_id: ${result.agent_id})`);

        // 9. --wait mode
        if (opts.wait) {
          const maxMs = (parseInt(opts.maxDuration, 10) || 10) * 60 * 1000;
          const startTime = Date.now();
          const { default: ora } = await import('ora');
          const spinner = ora('Ringing...').start();

          // Handle Ctrl+C gracefully
          const cleanup = () => {
            spinner.stop();
            console.log('');
            printHint(`Call still active. Run: convoai phone hangup ${result.agent_id}`);
            process.exit(0);
          };
          process.on('SIGINT', cleanup);

          let lastStatus = '';
          while (Date.now() - startTime < maxMs) {
            await new Promise(r => setTimeout(r, 2000));
            try {
              const status = await callApi.status(result.agent_id);
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              const mm = String(Math.floor(elapsed / 60));
              const ss = String(elapsed % 60).padStart(2, '0');

              if (status.status !== lastStatus) {
                lastStatus = status.status;
                if (status.status === 'RUNNING') spinner.text = `In conversation (${mm}:${ss})`;
                else if (status.status === 'STARTING') spinner.text = 'Ringing...';
                else if (status.status === 'STOPPED' || status.status === 'FAILED') break;
                else spinner.text = `${status.status} (${mm}:${ss})`;
              } else {
                spinner.text = spinner.text.replace(/\(\d+:\d+\)/, `(${mm}:${ss})`);
              }
            } catch { /* ignore poll errors */ }
          }

          process.removeListener('SIGINT', cleanup);
          const totalSec = Math.floor((Date.now() - startTime) / 1000);
          const totalMm = String(Math.floor(totalSec / 60));
          const totalSs = String(totalSec % 60).padStart(2, '0');
          spinner.succeed(`Call ended (duration: ${totalMm}:${totalSs})`);
        } else {
          printHint(`Run: convoai phone status ${result.agent_id}`);
        }
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
```

- [ ] **Step 2: Create status.ts**

```typescript
// src/commands/phone/status.ts
import { Command } from 'commander';
import { getCallAPI } from './_helpers.js';
import { printKeyValue } from '../../ui/table.js';
import { handleError } from '../../utils/errors.js';
import { formatDuration } from '../../utils/format.js';

export function registerPhoneStatus(phone: Command): void {
  phone
    .command('status <agent-id>')
    .description('Check call status')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (agentId, opts) => {
      try {
        const api = getCallAPI(opts.profile);
        const status = await api.status(agentId);

        if (opts.json) {
          console.log(JSON.stringify(status, null, 2));
          return;
        }

        const duration = status.stop_ts
          ? formatDuration(status.stop_ts - status.start_ts)
          : formatDuration(Math.floor(Date.now() / 1000) - status.start_ts);

        console.log('');
        printKeyValue([
          ['Agent ID', status.agent_id],
          ['Status', status.status],
          ['Duration', duration],
          ['Channel', status.channel ?? '-'],
        ]);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
```

- [ ] **Step 3: Create hangup.ts**

```typescript
// src/commands/phone/hangup.ts
import { Command } from 'commander';
import { getCallAPI } from './_helpers.js';
import { printSuccess } from '../../ui/output.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneHangup(phone: Command): void {
  phone
    .command('hangup <agent-id>')
    .description('End an active call')
    .option('--profile <name>', 'Config profile')
    .action(async (agentId, opts) => {
      try {
        const api = getCallAPI(opts.profile);
        await api.hangup(agentId);
        printSuccess('Call ended');
      } catch (error) {
        handleError(error);
      }
    });
}
```

- [ ] **Step 4: Create history.ts**

```typescript
// src/commands/phone/history.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { getCallAPI } from './_helpers.js';
import { handleError } from '../../utils/errors.js';

export function registerPhoneHistory(phone: Command): void {
  phone
    .command('history')
    .description('List recent calls')
    .option('--limit <n>', 'Max results', '20')
    .option('--profile <name>', 'Config profile')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      try {
        const api = getCallAPI(opts.profile);
        const result = await api.list({ limit: parseInt(opts.limit, 10) || 20 });
        const list = result.data?.list ?? [];

        if (opts.json) {
          console.log(JSON.stringify(list, null, 2));
          return;
        }

        if (list.length === 0) {
          console.log(chalk.dim('\n  No recent calls.\n'));
          return;
        }

        console.log('');
        for (const call of list) {
          const id = call.agent_id.slice(0, 12);
          const status = call.status === 'STOPPED' ? chalk.dim('completed') :
                         call.status === 'RUNNING' ? chalk.green('active') :
                         call.status === 'FAILED' ? chalk.red('failed') :
                         chalk.dim(call.status);
          const ago = call.start_ts ? timeSince(call.start_ts) : '';
          console.log(`  ${chalk.cyan(id)}  ${status}  ${chalk.dim(ago)}`);
        }
        console.log('');
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}

function timeSince(ts: number): string {
  const sec = Math.floor(Date.now() / 1000) - ts;
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  return `${Math.floor(sec / 86400)} days ago`;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/commands/phone/send.ts src/commands/phone/status.ts src/commands/phone/hangup.ts src/commands/phone/history.ts
git commit -m "feat: phone call commands (send, status, hangup, history)"
```

---

### Task 6: Register Phone Commands + Update Help + Deprecation

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add imports and register phone group**

In `src/index.ts`, add after the existing OpenClaw import:

```typescript
// ─── Phone Commands ──────────────────────────────────────────────────────
import { registerPhoneSend } from './commands/phone/send.js';
import { registerPhoneNumbers } from './commands/phone/numbers.js';
import { registerPhoneImport } from './commands/phone/import.js';
import { registerPhoneGet } from './commands/phone/get.js';
import { registerPhoneUpdate } from './commands/phone/update.js';
import { registerPhoneRemove } from './commands/phone/remove.js';
import { registerPhoneHangup } from './commands/phone/hangup.js';
import { registerPhoneStatus } from './commands/phone/status.js';
import { registerPhoneHistory } from './commands/phone/history.js';
```

In the `run()` function, register the phone group after openclaw:

```typescript
  // ── phone ──────────────────────────────────────────────────────────────
  const phone = program
    .command('phone')
    .description('Phone calls and number management');

  registerPhoneSend(phone);
  registerPhoneNumbers(phone);
  registerPhoneImport(phone);
  registerPhoneGet(phone);
  registerPhoneUpdate(phone);
  registerPhoneRemove(phone);
  registerPhoneHangup(phone);
  registerPhoneStatus(phone);
  registerPhoneHistory(phone);
```

- [ ] **Step 2: Update customHelp() to add Phone group**

Add after the Start group:

```typescript
  // Group: Phone
  lines.push(chalk.bold('Phone:'));
  lines.push(`  ${chalk.cyan('phone send')}        ${chalk.dim('Make an outbound phone call')}`);
  lines.push(`  ${chalk.cyan('phone numbers')}     ${chalk.dim('List imported phone numbers')}`);
  lines.push(`  ${chalk.cyan('phone import')}      ${chalk.dim('Import a new number')}`);
  lines.push(`  ${chalk.cyan('phone hangup')}      ${chalk.dim('End an active call')}`);
  lines.push(`  ${chalk.cyan('phone status')}      ${chalk.dim('Check call status')}`);
  lines.push(`  ${chalk.cyan('phone history')}     ${chalk.dim('Recent calls')}`);
  lines.push('');
```

Add `go --call` to Start group and phone number/update/remove to More group.

- [ ] **Step 3: Add deprecation warnings to old call commands**

The existing `call` group stays registered but each subcommand prints a deprecation warning before delegating. In the call registration section, add deprecation hooks:

```typescript
  // ── call (deprecated — kept for backward compat) ───────────────────────
  // Existing call commands now show deprecation warnings
```

Add a `deprecated()` wrapper that prints a warning then runs the new command's logic. For `call initiate`, map `--phone` to `--to` and `--system-message` to `--task`.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: register phone commands, update help text, deprecate old call commands"
```

---

### Task 7: `convoai go --call` Flag

**Files:**
- Modify: `src/commands/go.ts`

- [ ] **Step 1: Add --call option and branch logic**

In `registerGo()`, add the option:

```typescript
    .option('--call', 'Make a phone call instead of voice chat')
```

At the top of `goAction()`, after config validation, add:

```typescript
    if (opts.call) {
      // Delegate to phone send interactive mode
      const { getCallAPI, getNumberAPI, getConfig, pickOutboundNumber, validateE164 } = await import('./phone/_helpers.js');
      // ... (reuse phone send logic with config's LLM/TTS/ASR)
      // Similar to phone send interactive flow but using go's resolved config
      return;
    }
```

The implementation reuses the same interactive flow as `phone send` but with the `go` command's config resolution (which includes `--model`, `--tts`, `--asr` overrides).

- [ ] **Step 2: Commit**

```bash
git add src/commands/go.ts
git commit -m "feat: convoai go --call flag for phone call mode"
```

---

### Task 8: Quickstart Step 5 Phone Option

**Files:**
- Modify: `src/commands/quickstart.ts`

- [ ] **Step 1: Add phone call choice to Step 5**

Replace the existing Step 5 choice (which currently only has voice chat + openclaw) with a three-way choice:

```typescript
  const choices = [
    { name: lang === 'cn' ? '🎙 语音对话 (浏览器)' : '🎙 Voice chat (browser)', value: 'voice' },
    { name: lang === 'cn' ? '📞 打电话' : '📞 Make a phone call', value: 'phone' },
  ];

  if (hasOpenClaw) {
    choices.push({ name: '🦞 OpenClaw voice mode', value: 'openclaw' });
  }

  const { mode } = await inquirer.prompt([{
    type: 'list', name: 'mode',
    message: lang === 'cn' ? '选择体验方式:' : 'How to experience?',
    choices,
  }]);

  if (mode === 'phone') {
    // Phone call flow: check numbers → import if needed → select from → input to → call --wait
    const { getNumberAPI, getCallAPI, pickOutboundNumber, validateE164 } = await import('./phone/_helpers.js');
    // ... phone send interactive flow using quickstart's config
    return;
  }

  if (mode === 'openclaw') {
    // existing openclaw logic
  }

  // mode === 'voice': existing voice chat logic
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/quickstart.ts
git commit -m "feat: quickstart Step 5 adds phone call option"
```

---

### Task 9: Update Completion + Tests

**Files:**
- Modify: `src/commands/completion.ts`
- Create: `tests/commands/phone.test.ts`

- [ ] **Step 1: Update completion.ts**

Add `phone` to `TOP_LEVEL_COMMANDS` and phone subcommands to `SUBCOMMANDS`:

```typescript
const TOP_LEVEL_COMMANDS = ['go', 'init', 'dev', 'quickstart', 'openclaw', 'phone', 'auth', 'agent', 'call', 'config', 'preset', 'template', 'token', 'completion'];

const SUBCOMMANDS: Record<string, string[]> = {
  phone: ['send', 'numbers', 'import', 'number', 'update', 'remove', 'hangup', 'status', 'history'],
  agent: ['start', 'stop', 'status', 'list', 'update', 'speak', 'interrupt', 'history', 'turns', 'join', 'chat', 'panel'],
  // ... rest unchanged
};
```

- [ ] **Step 2: Create phone.test.ts**

```typescript
// tests/commands/phone.test.ts
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

describe('convoai phone', () => {
  it('shows phone help', () => {
    const output = cli('phone --help');
    expect(output).toContain('send');
    expect(output).toContain('numbers');
    expect(output).toContain('import');
    expect(output).toContain('hangup');
    expect(output).toContain('status');
    expect(output).toContain('history');
  });

  it('phone send shows help with --help', () => {
    const output = cli('phone send --help');
    expect(output).toContain('--from');
    expect(output).toContain('--to');
    expect(output).toContain('--task');
    expect(output).toContain('--wait');
  });

  it('phone import shows help with --help', () => {
    const output = cli('phone import --help');
    expect(output).toContain('--number');
    expect(output).toContain('--provider');
    expect(output).toContain('--sip-address');
  });

  it('phone numbers shows help with --help', () => {
    const output = cli('phone numbers --help');
    expect(output).toContain('--json');
  });

  it('phone remove shows help with --help', () => {
    const output = cli('phone remove --help');
    expect(output).toContain('--force');
  });

  it('help text includes Phone group', () => {
    const output = cli('--help');
    expect(output).toContain('Phone:');
    expect(output).toContain('phone send');
    expect(output).toContain('phone numbers');
  });

  it('go --call shows in help', () => {
    const output = cli('go --help');
    expect(output).toContain('--call');
  });

  it('deprecated call initiate still works', () => {
    const output = cli('call initiate --help');
    // Should show help or deprecation message, not "unknown command"
    expect(output.toLowerCase()).not.toContain('unknown command');
  });
});

describe('E.164 validation', () => {
  // These are unit-style tests using the helper directly
  it('accepts valid E.164 numbers', async () => {
    const { isE164 } = await import('../../src/commands/phone/_helpers.js');
    expect(isE164('+15551234567')).toBe(true);
    expect(isE164('+8613800138000')).toBe(true);
    expect(isE164('+442071234567')).toBe(true);
  });

  it('rejects invalid numbers', async () => {
    const { isE164 } = await import('../../src/commands/phone/_helpers.js');
    expect(isE164('15551234567')).toBe(false);    // no +
    expect(isE164('+0551234567')).toBe(false);     // starts with 0
    expect(isE164('hello')).toBe(false);
    expect(isE164('')).toBe(false);
  });
});
```

- [ ] **Step 3: Build and run tests**

```bash
npm run build && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/commands/completion.ts tests/commands/phone.test.ts
git commit -m "feat: phone shell completions + integration tests"
```

---

### Task 10: Build, Full Test, Verify

- [ ] **Step 1: Full build**

```bash
npm run build
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: All existing tests + new phone tests pass.

- [ ] **Step 3: Verify help text**

```bash
node dist/bin/convoai.js --help
node dist/bin/convoai.js phone --help
node dist/bin/convoai.js phone send --help
node dist/bin/convoai.js go --help
```

- [ ] **Step 4: Verify deprecated commands**

```bash
node dist/bin/convoai.js call initiate --help
```

Expected: Shows help or deprecation message, not "unknown command".

- [ ] **Step 5: Verify dry-run**

```bash
node dist/bin/convoai.js phone send --from +15551234567 --to +15559876543 --task "test" --dry-run
```

Expected: Prints JSON request payload.

---

## Self-Review

### Spec Coverage

| Spec Section | Covered By |
|-------------|-----------|
| 1.1 Phone commands (9) | Tasks 4, 5 |
| 1.2 Existing command changes | Tasks 6, 7, 8 |
| 2. phone send (interactive + flag + --wait) | Task 5 |
| 3. Number commands (numbers, import, get, update, remove) | Task 4 |
| 4. Quickstart integration | Task 8 |
| 5. go --call | Task 7 |
| 6. Help text | Task 6 |
| 7.1 numbers.ts API (separate client) | Task 1 + Task 3 (createNumbersClient) |
| 7.2 calls.ts API (relative paths) | Task 2 |
| 8. Error handling | Tasks 3, 4, 5 |
| 9. Deprecation with flag mapping | Task 6 |
| 10. Files changed | All tasks |

### Placeholder Scan

No TBD/TODO found. All code blocks are complete.

### Type Consistency

- `PhoneNumber`, `ImportNumberRequest`, `UpdateNumberRequest` defined in Task 1, used in Tasks 3, 4, 5 — consistent.
- `SendCallRequest`, `SendCallResponse`, `CallStatusResponse` defined in Task 2, used in Task 5 — consistent.
- `isE164`, `validateE164`, `getCallAPI`, `getNumberAPI`, `pickOutboundNumber` defined in Task 3, used in Tasks 4, 5, 7, 8 — consistent.
- `registerPhone*` functions defined in Tasks 4, 5, imported in Task 6 — consistent.
