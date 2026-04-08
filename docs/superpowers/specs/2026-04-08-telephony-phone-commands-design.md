# ConvoAI CLI — Telephony Phone Commands Design Spec

> **Goal:** Add production-ready telephony commands to ConvoAI CLI, enabling developers to make outbound phone calls with one command and manage phone numbers via CLI.

> **Scope:** `convoai phone *` command group (9 subcommands), `convoai go --call`, quickstart Step 5 phone option. Outbound only. No inbound, no batch, no recording.

> **Reference:** Bland CLI's `bland call send --wait` and `bland number *` as UX benchmark. Agora ConvoAI telephony REST API as backend.

---

## 1. New Commands

### 1.1 Phone Commands

| Command | Description |
|---------|-------------|
| `phone send` | Make an outbound phone call |
| `phone numbers` | List imported phone numbers |
| `phone import` | Import a new phone number (interactive SIP config) |
| `phone number <num>` | View number details |
| `phone update <num>` | Update number configuration |
| `phone remove <num>` | Delete a phone number |
| `phone hangup <id>` | End an active call |
| `phone status <id>` | Check call status |
| `phone history` | List recent calls |

### 1.2 Existing Command Changes

| Command | Change |
|---------|--------|
| `convoai go --call` | New flag, enters phone call mode |
| `convoai quickstart` Step 5 | New choice: "Make a phone call" |
| `convoai call initiate` | Hidden alias → `phone send` + deprecation warning |
| `convoai call hangup` | Hidden alias → `phone hangup` + deprecation warning |
| `convoai call status` | Hidden alias → `phone status` + deprecation warning |

---

## 2. `phone send` — Core Command

### 2.1 Interactive Mode (zero params)

```
convoai phone send

→ Check for imported numbers
  → None found:
    ⚠ No phone numbers found. Let's import one.
    → (runs phone import flow inline)
    → Number imported. Continuing...
  → Numbers found:
    From number:
      ❯ +15551234567 (my-twilio)
        +86138xxxx (china-sip)

→ To number (E.164): +15559876543
→ Task/prompt: Ask if they're interested in a demo of our product
→ Confirm: Call +15559876543 from +15551234567? (Y/n)

✓ Call initiated (agent_id: A42xxx)
  Run: convoai phone status A42xxx
```

### 2.2 Flag Mode

```bash
convoai phone send --from +15551234567 --to +15559876543 --task "Ask about demo"
convoai phone send --from +15551234567 --to +15559876543 --task "Ask about demo" --wait
convoai phone send --from +15551234567 --to +15559876543 --task "Ask about demo" --json
```

### 2.3 `--wait` Mode

```
✓ Call initiated
  ⠋ Ringing...
  ⠋ Connected (0:05)
  ⠋ In conversation (0:32)
  ✓ Call ended (duration: 0:47)
```

Default timeout: 10 minutes. Override with `--max-duration <mins>`.

Ctrl+C exits the wait but does NOT hang up. Prints: `Call still active. Run: convoai phone hangup <id>`

### 2.4 Flags

| Flag | Description |
|------|-------------|
| `--from <number>` | Caller ID (E.164) |
| `--to <number>` | Target number (E.164) |
| `--task <prompt>` | What the AI should do |
| `--greeting <text>` | First sentence spoken on connect |
| `--model <model>` | LLM model override |
| `--wait` | Wait and show status until call ends |
| `--max-duration <mins>` | Max call length (default: 10) |
| `--profile <name>` | Config profile |
| `--json` | JSON output |
| `--dry-run` | Show request payload without sending |

### 2.5 Internal Flow

```
1. Resolve config (LLM / TTS / ASR from profile)
2. Validate --from number exists in phone numbers list
3. Validate --to number is E.164 format
4. Generate channel name: call-{timestamp36}
5. Generate RTC tokens (agent + SIP gateway)
6. Build request body:
   {
     name: "call-xxx",
     sip: {
       to_number: "--to",
       from_number: "--from",
       rtc_uid: "1",
       rtc_token: "<generated>"
     },
     properties: {
       channel: "<generated>",
       token: "<agent token>",
       agent_rtc_uid: "0",
       remote_rtc_uids: ["1"],
       llm: { ...from config + --task as system_message },
       tts: { ...from config },
       asr: { ...from config }
     }
   }
7. POST /call
8. If --wait: poll GET /agents/{id} every 2s until terminal state
```

---

## 3. Phone Number Commands

### 3.1 `phone numbers`

```bash
convoai phone numbers
# +15551234567  outbound  my-twilio    twilio
# +86138xxxx    in+out    china-sip    byo

convoai phone numbers --json
```

### 3.2 `phone import`

Interactive mode:

```
convoai phone import
→ Provider: (twilio / byo)
→ Phone number (E.164): +15551234567
→ Label: my-twilio
→ Supports outbound? (Y/n)
→ Supports inbound? (y/N)
→ SIP address: sip.twilio.com
→ Transport: (tls / tcp / udp)
→ SIP username: xxx
→ SIP password: ***
✓ Number imported: +15551234567
```

Flag mode:

```bash
convoai phone import \
  --number +15551234567 \
  --provider twilio \
  --label my-twilio \
  --sip-address sip.twilio.com \
  --sip-transport tls \
  --sip-user xxx \
  --sip-password xxx
```

### 3.3 `phone number <num>`

```bash
convoai phone number +15551234567
# Phone:     +15551234567
# Label:     my-twilio
# Provider:  twilio
# Outbound:  yes
# Inbound:   no
# SIP:       sip.twilio.com (tls)
# Pipeline:  (none)
```

### 3.4 `phone update <num>`

```bash
convoai phone update +15551234567 --label new-label
convoai phone update +15551234567 --sip-address new.sip.com
```

### 3.5 `phone remove <num>`

```bash
convoai phone remove +15551234567
# Remove +15551234567 (my-twilio)? (y/N) y
# ✓ Number removed

convoai phone remove +15551234567 --force  # skip confirmation
```

### 3.6 `phone history`

```bash
convoai phone history
# A42xxx  +1555→+1559  completed  0:47  2 min ago
# A41xxx  +1555→+8613  failed     -     1 hour ago

convoai phone history --limit 5 --json
```

### 3.7 `phone status <id>`

```bash
convoai phone status A42xxx
# Agent ID:  A42xxx
# Status:    RUNNING
# From:      +15551234567
# To:        +15559876543
# Duration:  0:32
```

### 3.8 `phone hangup <id>`

```bash
convoai phone hangup A42xxx
# ✓ Call ended
```

---

## 4. Quickstart Integration

Step 5 adds a phone call option:

```
Step 5: How to experience?
  ❯ 🎙 Voice chat (browser)
    📞 Make a phone call
    🦞 OpenClaw voice mode        ← only if openclaw detected

→ Voice chat: existing flow (unchanged)
→ Phone call:
    → Check for numbers → import if needed
    → Select from number
    → Input to number
    → Initiate call with --wait
    → Show status until call ends
```

Steps 1-4 unchanged. OpenClaw option only shows when detected (existing behavior).

---

## 5. `convoai go --call`

```bash
convoai go --call
```

Same as `phone send` interactive mode, but uses the saved config profile (LLM/TTS/ASR) like `go` does for voice chat. If last call config exists (from/to), offers to reuse:

```
convoai go --call
→ Last call: +15551234567 → +15559876543
  Redial? (Y/n)
→ ✓ Call initiated...
```

---

## 6. Help Text

```
Start:
  go                Start a voice conversation (uses last config)
  go --call         Make a phone call instead
  init              Create a new starter project
  dev               Start starter dev server
  quickstart        First-time setup wizard
  openclaw          Voice-enable your local OpenClaw

Phone:
  phone send        Make an outbound phone call
  phone numbers     List imported phone numbers
  phone import      Import a new number
  phone hangup      End an active call
  phone status      Check call status
  phone history     Recent calls

Agent:
  ...（unchanged）

Config:
  ...（unchanged）

More:
  phone number      View number details
  phone update      Update number configuration
  phone remove      Remove a number
  ...（rest unchanged）
```

High-frequency phone commands in the Phone group, low-frequency in More.

---

## 7. API Layer

### 7.1 `src/api/numbers.ts` (new)

**Requires a separate HTTP client** — phone-numbers API is NOT under `/projects/{appId}`.

Base URL: `https://api.agora.io/api/conversational-ai-agent/v2`
Auth: same Basic auth (customer_id:customer_secret).

| Method | Endpoint (relative to base) | Purpose |
|--------|----------|---------|
| GET | `/phone-numbers` | List all numbers |
| POST | `/phone-numbers` | Import number |
| GET | `/phone-numbers/{number}` | Get number details |
| PATCH | `/phone-numbers/{number}` | Update number |
| DELETE | `/phone-numbers/{number}` | Delete number |

Implementation: create a `createNumbersClient(config)` factory in `_helpers.ts` that uses base URL without `/projects/{appId}`.

### 7.2 `src/api/calls.ts` (rewrite)

Uses the existing project-scoped client (baseURL = `.../projects/{appId}`). All paths are **relative to that base**.

| Method | Endpoint (relative) | Purpose |
|--------|----------|---------|
| POST | `/call` | Initiate outbound call (with SIP config) |
| GET | `/agents/{id}` | Call status (reuse agent status endpoint) |
| POST | `/agents/{id}/leave` | Hangup (reuse agent leave endpoint) |
| GET | `/agents` | List calls (filter by telephony type) |

Key: `POST /call` requires `sip` object with `to_number`, `from_number`, `rtc_uid`, `rtc_token`. Tokens auto-generated by CLI.

---

## 8. Error Handling

| Scenario | Behavior |
|----------|----------|
| `phone send` no numbers | Auto-trigger `phone import` flow |
| `--from` number not found | Error + list available outbound numbers |
| `--from` is inbound-only | Error: "This number does not support outbound calls" + list outbound numbers |
| Interactive picker | Only show numbers with `outbound: true` |
| `--to` bad format | Local E.164 validation, show correct format |
| `phone import` duplicate | Show API 409 + "number already exists" |
| `phone remove` confirmation | Interactive: require y/N. `--force` skips. |
| SIP connection failed | Show API error + "check SIP configuration" |
| `--wait` timeout | Default 10min, `--max-duration` override |
| `--wait` Ctrl+C | Exit wait, don't hangup, print hangup hint |
| Invalid credentials | Reuse v1.6.1 validation logic |

---

## 9. Deprecation

| Old Command | New Command | Behavior |
|-------------|-------------|----------|
| `call initiate` | `phone send` | Hidden alias with flag mapping + deprecation warning |
| `call hangup` | `phone hangup` | Hidden alias, prints deprecation warning |
| `call status` | `phone status` | Hidden alias, prints deprecation warning |

Old commands work but show: `⚠ "call initiate" is deprecated. Use "phone send" instead.`

**Flag mapping for `call initiate`:**
| Old Flag | Maps To |
|----------|---------|
| `--phone <number>` | `--to <number>` |
| `--system-message <msg>` | `--task <msg>` |
| `--channel <name>` | (ignored, auto-generated) |
| `--greeting <msg>` | `--greeting <msg>` (unchanged) |
| `--model <model>` | `--model <model>` (unchanged) |

The deprecated command reads old flags, maps them, and delegates to `phone send` logic internally.

---

## 10. Files Changed

### New Files

| File | Purpose |
|------|---------|
| `src/api/numbers.ts` | Phone number API client (5 methods) |
| `src/commands/phone/send.ts` | phone send command |
| `src/commands/phone/numbers.ts` | phone numbers (list) |
| `src/commands/phone/import.ts` | phone import |
| `src/commands/phone/get.ts` | phone number (details) |
| `src/commands/phone/update.ts` | phone update |
| `src/commands/phone/remove.ts` | phone remove |
| `src/commands/phone/hangup.ts` | phone hangup |
| `src/commands/phone/status.ts` | phone status |
| `src/commands/phone/history.ts` | phone history |
| `tests/commands/phone.test.ts` | Tests for phone commands |

### Modified Files

| File | Change |
|------|--------|
| `src/api/calls.ts` | Rewrite: add SIP config, align with actual API |
| `src/index.ts` | Register phone group, update help text, deprecate old call commands |
| `src/commands/quickstart.ts` | Step 5: add phone call option |
| `src/commands/go.ts` | Add `--call` flag |
| `src/commands/completion.ts` | Add phone * commands |

### Not Modified

Starter template, frontend, python-server, openclaw, panel — all untouched.

---

## 11. Out of Scope

- Inbound call handling / routing
- Batch calling (CSV upload)
- Call recording download
- Real-time call transcript (needs RTM)
- SIP discovery (`bland sip discover`)
- Voice cloning
- Pathway / conversational flow definition
