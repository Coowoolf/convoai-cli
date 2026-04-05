# ConvoAI Developer Platform — Web Starter Design Spec

> **Goal:** Transform ConvoAI from a CLI tool into a Web-first Developer Platform entry point, by adding `convoai init` and `convoai dev` commands that scaffold and launch a three-layer (Frontend / Customer Server / ConvoAI Engine) starter project.

> **Scope:** 8-hour delivery. Web path only. Telephony / IoT / Text as architectural placeholders.

> **Architecture:** Embedded template in CLI npm package. `convoai init` copies template to user's directory with credentials injected. Starter is a fully independent project — runs without CLI after init.

---

## 1. CLI Command Changes

### 1.1 New: `convoai init [project-name]`

**Signature:** `convoai init [project-name]`

- `project-name` optional, defaults to `my-convoai-app`
- If target directory exists and is non-empty, error and exit
- Future extension point: `convoai init --template telephony` (not this round)

**Execution flow:**

1. Validate target directory is available (does not exist, or exists and is empty)
2. Copy `src/starters/web/` from the CLI package to `./<project-name>/`
3. Read `~/.config/convoai/.convoai.json`:
   - Has credentials: generate `.env` with `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`, `AGORA_CUSTOMER_ID`, `AGORA_CUSTOMER_SECRET`, plus LLM/TTS/ASR config from default profile
   - No credentials: generate empty `.env`, print hint to run `convoai quickstart` first
4. Print next steps:

```
  Project created: my-convoai-app/

  Next steps:
    cd my-convoai-app
    npm install
    convoai dev

  Project structure:
    frontend/      <- customize your UI here
    server/        <- add your business logic here
    python-server/ <- alternative Python server
```

### 1.2 New: `convoai dev`

**Signature:** `convoai dev`

**Execution flow:**

1. Check current directory's `package.json` for `"convoai-starter": true`
   - Not found: error `"This is not a ConvoAI starter project. Run: convoai init"`
2. Check `node_modules/` exists
   - Not found: error `"Dependencies not installed. Run: npm install"`
3. `spawn('npm', ['run', 'dev'], { stdio: 'inherit', cwd: process.cwd() })`

The CLI does not own the dev server — it delegates to the starter's own npm script.

### 1.3 Unchanged Commands

All existing commands remain untouched:

- `convoai go` — zero-config instant voice experience (demo / sales)
- `convoai quickstart` — first-time guided setup
- `convoai openclaw` — OpenClaw voice integration
- All `agent *`, `config *`, `auth *`, `preset *`, `template *`, `call *`, `token`, `completion`

### 1.4 Command Positioning

```
First-time user:     convoai quickstart  ->  configure credentials
Quick experience:    convoai go          ->  instant voice chat (demo/sales)
Start development:   convoai init        ->  scaffold starter project
Daily development:   convoai dev         ->  launch starter dev environment
```

### 1.5 Help Text Update

Add `init` and `dev` to the "Start" group in `src/index.ts` custom help renderer. Display them between `go` and `quickstart`.

---

## 2. Starter Project Structure

`convoai init my-app` generates:

```
my-app/
  frontend/
    index.html              <- main page (voice conversation UI)
    style.css               <- styles (dark geek theme)
    app.js                  <- Agora RTC connection + UI logic
  server/
    index.ts                <- Express entry point
    routes/
      session.ts            <- POST /session/start, POST /session/stop
      token.ts              <- GET /token
      callback.ts           <- POST /callback (webhook placeholder)
      knowledge.ts          <- POST /knowledge (placeholder)
    convoai-api.ts          <- Direct Agora REST API wrapper (~150 lines)
    tsconfig.json
  python-server/
    app.py                  <- FastAPI: health + session + token
    token_builder.py        <- RTC AccessToken2 generation
    requirements.txt        <- fastapi, uvicorn, requests, python-dotenv
    .env.example
    README.md
  connectors/
    README.md               <- Architecture extension guide
  package.json              <- unified: frontend serve + server start
  .env                      <- credentials injected from CLI config (gitignored)
  .env.example              <- empty template (committable)
  .gitignore                <- .env, node_modules/, dist/
  README.md                 <- quickstart + customization guide
```

### 2.1 Template Location in CLI

```
convoai-cli/
  src/
    starters/
      web/                  <- entire directory copied on init
        frontend/
        server/
        python-server/
        connectors/
        package.json
        .env.example
        .gitignore
        README.md
```

`package.json` `"files"` field must include `src/starters/` so npm publish includes the template.

---

## 3. Frontend Design

### 3.1 Page Structure

Single page `index.html`:

1. **Top status bar** — connection status (Disconnected / Connecting / Connected), channel name
2. **Center conversation area** — real-time subtitles / message history (user / agent bubbles)
3. **Bottom control area** — "Start Conversation" button (toggles to "End"), microphone volume indicator
4. **Collapsible side config panel** — server endpoint (default `http://localhost:3000`), optional session parameters

### 3.2 Color Palette

Dark geek theme from Happy Hues Palette 4:

| Role | Hex |
|------|-----|
| Background | `#16161a` |
| Card / secondary background | `#242629` |
| Headline text | `#fffffe` |
| Paragraph / secondary text | `#94a1b2` |
| Primary accent (buttons, links) | `#7f5af0` |
| Success / online status | `#2cb67d` |
| Gray auxiliary | `#72757e` |

### 3.3 Interaction Flow

```
User clicks "Start Conversation"
  -> frontend POST /session/start to local server
  -> server calls Agora ConvoAI REST API, starts agent
  -> server returns { appId, channel, token, uid, agentId }
  -> frontend initializes Agora RTC SDK, joins channel
  -> voice conversation begins
  -> subtitles via DataStream or history API polling
  -> User clicks "End"
  -> frontend POST /session/stop
  -> server calls agent leave API
```

### 3.4 Agora RTC SDK Loading

`<script src="/agora-sdk.js">` — served by the local Express server from `node_modules/agora-rtc-sdk-ng/AgoraRTC_N-production.js`. Same pattern as existing `createWebHandler` in CLI. Starter's `package.json` lists `agora-rtc-sdk-ng` as a dependency.

### 3.5 Customization Markers

HTML comments mark extensible areas:
- `<!-- Customize: change theme colors in style.css -->`
- `<!-- Customize: add your logo here -->`
- `<!-- Customize: modify conversation UI layout -->`

### 3.6 Not In Scope

No PTT, no OpenClaw integration, no gradient animations, no CSS framework. Clean and minimal.

---

## 4. Server Design

### 4.1 Technology

Express + TypeScript, run via `tsx` (no build step needed for development).

### 4.2 Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Serve `frontend/` static files |
| GET | `/agora-sdk.js` | Serve Agora RTC SDK from node_modules |
| POST | `/session/start` | Start ConvoAI agent, return RTC join params |
| POST | `/session/stop` | Stop ConvoAI agent |
| GET | `/token` | Generate RTC token |
| GET | `/health` | `{ status: 'ok' }` |
| POST | `/callback` | Webhook placeholder (log + return 200) |
| POST | `/knowledge` | Knowledge base placeholder (return mock) |

### 4.3 `POST /session/start` Logic

```
1. Read credentials from process.env (loaded from .env via dotenv)
2. Generate channel name: "session-" + timestamp
3. Generate RTC tokens (agent UID: 0, client UID: random)
   using agora-token package (AccessToken2)
4. POST to https://api.agora.io/api/conversational-ai-agent/v2/projects/{appId}/join
   with Basic Auth (customer_id:customer_secret)
5. Return { appId, channel, token, uid, agentId } to frontend
```

### 4.4 `convoai-api.ts`

~150 lines, standalone file wrapping three Agora REST endpoints:

- `startAgent(config): Promise<{ agent_id, channel }>` — POST /join
- `stopAgent(agentId): Promise<void>` — POST /agents/{id}/leave
- `getHistory(agentId): Promise<HistoryEntry[]>` — GET /agents/{id}/history

Plus a `generateToken(appId, cert, channel, uid)` helper using the `agora-token` package.

No dependency on the convoai CLI package. Pure REST + token generation.

### 4.5 Starter `package.json`

```json
{
  "name": "my-convoai-app",
  "private": true,
  "convoai-starter": true,
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "tsc",
    "start": "node dist/server/index.js"
  },
  "dependencies": {
    "agora-rtc-sdk-ng": "^4.24.0",
    "agora-token": "^2.0.5",
    "express": "^4.21.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "@types/express": "^5.0.0"
  }
}
```

### 4.6 Customization Markers

Code comments in route files:
- `// Customize: connect your knowledge base here`
- `// Customize: add authentication middleware here`
- `// Customize: add your webhook handling logic here`

### 4.7 Not In Scope

No user auth system, no database, no session persistence, no complex error handling. Developer adds these.

---

## 5. Python Server Sample

### 5.1 Files

```
python-server/
  app.py              <- FastAPI: health + session/start + session/stop + token
  token_builder.py    <- RTC AccessToken2 generation (~80 lines)
  requirements.txt    <- fastapi, uvicorn, requests, python-dotenv
  .env.example        <- same credential template as parent
  README.md           <- setup + how to replace Node server
```

### 5.2 `app.py` (~100 lines)

Endpoints:
- `GET /health` — `{ "status": "ok" }`
- `POST /session/start` — call Agora REST API, return RTC join params (with token)
- `POST /session/stop` — call agent leave API
- `GET /token` — generate RTC token

### 5.3 `token_builder.py` (~80 lines)

Implements AccessToken2 generation using HMAC-SHA256. Only depends on Python stdlib (`hmac`, `hashlib`, `struct`, `base64`, `time`). No external Agora SDK dependency.

### 5.4 Usage

```bash
cd python-server
pip install -r requirements.txt
cp .env.example .env   # fill credentials
uvicorn app:app --port 3000
```

Frontend works unchanged — same `localhost:3000`, same API routes.

---

## 6. Connector Extension Architecture

### 6.1 Design Principle

New communication capabilities extend through the Connector layer, not by modifying Customer Server or ConvoAI Engine.

```
Web is not an exception — it is the first connector.

[Web Frontend]      -> [Customer Server] -> [ConvoAI Engine]
[SIP/Telephony]     -> [Customer Server] -> [ConvoAI Engine]  (Phase 2)
[IoT/Device Edge]   -> [Customer Server] -> [ConvoAI Engine]  (Phase 3)
[IM/Text Chat]      -> [Customer Server] -> [ConvoAI Engine]  (Phase 3)
```

### 6.2 This Round

`connectors/README.md` documents:
- The three-layer architecture model
- How each connector type plugs in
- What stays the same (server + engine) vs what changes (connector layer)
- Roadmap: which connectors are planned

No code, no empty directories. One well-written README.

---

## 7. NPM Download Growth

### 7.1 Download Events

| User Action | NPM Downloads Triggered |
|-------------|------------------------|
| `npm install -g convoai` | convoai + agora-rtc-sdk-ng + agora-token |
| `convoai init` + `npm install` in starter | agora-rtc-sdk-ng + agora-token + express + dotenv + tsx |
| Teammate clones starter + `npm install` | agora-rtc-sdk-ng + agora-token + express + dotenv + tsx |

Each developer trial = minimum 2x agora-rtc-sdk-ng downloads. Starter propagation multiplies further.

### 7.2 Integrity

All downloads are functionally required dependencies. No artificial inflation.

---

## 8. Documentation

### 8.1 Starter README.md

Covers:
- Quick Start (3 commands to running)
- Project Structure (what each directory is for)
- How to Customize (UI / business logic / knowledge base)
- Switch to Python Server
- From Local to Production (deploy guide — same architecture, no rewrite)
- Architecture diagram (three-layer + future connectors)

### 8.2 CLI README Update

Add `init` and `dev` to the "Start" command group table. One line each.

### 8.3 python-server/README.md

Setup instructions + how it replaces the Node server.

### 8.4 connectors/README.md

Architecture extension model + planned connector types.

---

## 9. Files Changed in CLI Codebase

### New Files

| File | Purpose |
|------|---------|
| `src/commands/init.ts` | `convoai init` command (~120 lines) |
| `src/commands/dev.ts` | `convoai dev` command (~40 lines) |
| `src/starters/web/frontend/index.html` | Starter frontend page |
| `src/starters/web/frontend/style.css` | Starter styles (dark geek theme) |
| `src/starters/web/frontend/app.js` | Starter frontend logic (Agora RTC) |
| `src/starters/web/server/index.ts` | Starter Express entry |
| `src/starters/web/server/routes/session.ts` | Session start/stop routes |
| `src/starters/web/server/routes/token.ts` | Token generation route |
| `src/starters/web/server/routes/callback.ts` | Webhook placeholder |
| `src/starters/web/server/routes/knowledge.ts` | Knowledge base placeholder |
| `src/starters/web/server/convoai-api.ts` | Direct Agora REST API wrapper |
| `src/starters/web/server/tsconfig.json` | TypeScript config for starter server |
| `src/starters/web/python-server/app.py` | FastAPI server |
| `src/starters/web/python-server/token_builder.py` | Python token generation |
| `src/starters/web/python-server/requirements.txt` | Python dependencies |
| `src/starters/web/python-server/.env.example` | Python env template |
| `src/starters/web/python-server/README.md` | Python server docs |
| `src/starters/web/connectors/README.md` | Connector architecture docs |
| `src/starters/web/package.json` | Starter package manifest |
| `src/starters/web/.env.example` | Credential template |
| `src/starters/web/.gitignore` | Git ignore rules |
| `src/starters/web/README.md` | Starter quickstart + guide |

### Modified Files

| File | Change |
|------|--------|
| `src/index.ts` | Register `init` and `dev` commands, update help text |
| `package.json` | Add `src/starters/` to `"files"` array |

### Not Modified

All existing command files (go.ts, quickstart.ts, openclaw.ts, agent/*, config/*, etc.) remain untouched.

---

## 10. Acceptance Criteria

### Product

- [ ] `convoai init my-app` creates a runnable starter project
- [ ] `cd my-app && npm install && convoai dev` starts frontend + server
- [ ] User can have a voice conversation through the starter's web UI
- [ ] Directory structure clearly shows frontend / server / connectors / python-server
- [ ] README explains where to customize frontend vs server

### Architecture

- [ ] Web path works end-to-end (init -> dev -> voice conversation)
- [ ] text / telephony / device-edge have clear extension points in connectors/README.md
- [ ] Python server path is visible and documented
- [ ] Existing `convoai go` path is not broken

### Growth

- [ ] `npm install` of starter triggers agora-rtc-sdk-ng download
- [ ] Starter is a standalone project (works without CLI after init)
- [ ] Python sample path is discoverable

---

## 11. Out of Scope

- Full Telephony / SIP implementation
- Full IoT / Edge implementation
- Complete Python runtime with all features
- Platform-level developer server
- Multi-tenant / permission system
- Observability / telemetry platform
- CSS framework or React/Vue/Next.js frontend
- Database or session persistence in starter
- User authentication system in starter
