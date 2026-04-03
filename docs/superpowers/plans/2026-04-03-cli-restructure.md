# CLI Restructure + `convoai go` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `convoai go` as the primary user command (zero-params, instant voice chat), restructure help into scenario-based groups, retire `chat`/`repl`/`watch`.

**Architecture:** New `src/commands/go.ts` handles config validation, Chrome detection, agent lifecycle, and panel launch. `src/index.ts` gets a custom help renderer replacing Commander's default. Retired commands are unregistered but files kept.

**Tech Stack:** Existing stack — Commander, chalk, inquirer, puppeteer-core, panel.ts, gradient.ts, i18n.ts.

---

## File Structure

```
src/commands/go.ts         — NEW: convoai go command
src/index.ts               — REWRITE: custom help, register go, unregister chat/repl/watch
tests/commands/go.test.ts  — NEW: tests for go command
```

---

### Task 1: Create `convoai go` command

**Files:**
- Create: `src/commands/go.ts`

This is the core task. `go` must handle every corner case robustly.

- [ ] **Step 1: Create go.ts**

The command:
1. Validates config (app_id, app_certificate, customer_id, customer_secret, LLM, TTS, ASR)
2. If `--setup` flag: run ASR → LLM → TTS config flow (reuse quickstart step logic), then continue
3. Clean up leftover agents + ports
4. Generate channel name + RTC tokens
5. Detect Chrome → terminal mode or browser mode
6. Build agent request (with `--model`/`--tts`/`--asr` overrides if provided)
7. Start agent
8. Launch voice client (headless Chrome or browser)
9. Enter runtime control panel
10. Panel handles exit + session report

Key imports to reuse:
- `resolveConfig`, `loadConfig` from `config/manager.js`
- `generateRtcToken` from `utils/token.js`
- `findChrome` from `utils/find-chrome.js`
- `AgentAPI`, `createClient` from `api/`
- `runPanel` from `commands/agent/panel.js`
- `getStrings` from `ui/i18n.js`
- `gradientBox`, `gradientProgress` from `ui/gradient.js`
- Quickstart setup steps can be imported or inlined (ASR/LLM/TTS prompts)

Flags:
```
-c, --channel <name>     Override channel name
--setup                  Re-configure ASR/LLM/TTS before starting
--model <model>          One-time model override (not saved to config)
--tts <vendor>           One-time TTS override
--asr <vendor>           One-time ASR override
--browser                Force browser mode
--profile <name>         Config profile
```

Config validation errors should be specific:
- Missing app_id → "No Agora credentials. Run: convoai quickstart"
- Missing LLM → "No LLM configured. Run: convoai go --setup"
- Missing TTS → "No TTS configured. Run: convoai go --setup"

Register as top-level command on the program (not under agent).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/commands/go.ts
git commit -m "feat: convoai go — zero-params instant voice chat"
```

---

### Task 2: Restructure index.ts — custom help + unregister retired commands

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Rewrite index.ts**

Changes:
1. Add import for `registerGo` from `./commands/go.js`
2. Remove imports for: `registerAgentChat`, `registerAgentWatch`, `registerRepl`
3. Remove their registration calls
4. Remove the top-level `registerAgentChat(program)` call
5. Register `go` as top-level: `registerGo(program)`
6. Override Commander's default help with custom renderer:
   - Detect if user has config → show "💡 Quick: convoai go" or "💡 Get started: convoai quickstart"
   - CN region → Chinese hint
   - Group commands: Start → Agent → Config → More → Examples → Docs link
7. Use `program.addHelpText('beforeAll', customHelp)` or override `program.helpInformation()`

Custom help output (the exact text from the spec):
```
  [mascot]  ConvoAI CLI vX.X.X
            Voice AI Engine ⚡🐦

  💡 Quick: convoai go

Start:
  go                Start a voice conversation (uses last config)
  quickstart        First-time setup wizard
  openclaw          Voice-enable your local OpenClaw 🦞

Agent:
  agent join        Join a channel with full control
  agent list        List running agents
  agent stop        Stop agent(s)
  agent status      Check agent status
  agent history     View conversation history
  agent turns       View latency analytics

Config:
  config show       Show current config
  config set        Change a setting
  config init       Re-run setup wizard

More:
  agent speak       Make agent say something
  agent interrupt   Interrupt agent speech
  agent start       Start agent (API only)
  token             Generate RTC token
  preset list       List built-in presets
  template *        Manage agent templates
  call *            Telephony (Beta)
  completion        Shell completions

Examples:
  convoai go                                 Resume last conversation
  convoai go --setup                         Re-configure then start
  convoai go --model qwen-max               One-time model override
  convoai agent join -c room1               Join a specific channel
  convoai openclaw                          Talk to OpenClaw by voice

Docs: github.com/Coowoolf/convoai-cli
```

Suppress Commander's auto-generated help by using `program.configureHelp()` or `program.helpInformation = () => ''` and using `addHelpText`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && node dist/bin/convoai.js --help`

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: custom help with scenario groups, register go, retire chat/repl/watch"
```

---

### Task 3: Tests for go command + updated CLI integration tests

**Files:**
- Create: `tests/commands/go.test.ts`
- Modify: `tests/commands/integration.test.ts`

- [ ] **Step 1: Write go tests**

Test the CLI surface:
- `convoai go --help` shows all flags
- `convoai --help` shows `go` in Start group
- `convoai --help` does NOT show `chat` or `repl` or `watch`
- `convoai --help` shows Examples section
- `convoai --help` shows 💡 hint

- [ ] **Step 2: Update integration tests**

Remove/update any tests that reference `chat`, `repl`, or `watch` commands.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test: go command + updated integration tests"
```

---

### Task 4: Build + publish

- [ ] **Step 1: Full test suite**

Run: `npx tsc && npx vitest run`

- [ ] **Step 2: Manual test**

```bash
rm -rf ~/.config/convoai
convoai quickstart        # first-time setup
convoai go                # should start conversation
# Ctrl+C to exit
convoai go --model qwen-turbo  # override model
convoai go --setup        # re-configure ASR/LLM/TTS
convoai --help            # verify new help layout
```

- [ ] **Step 3: Publish**

```bash
# bump version in package.json
npx tsc
npm publish
git add -A && git commit && git push
```
