# ConvoAI Starter — Python Server

Alternative to the Node.js server. Same API routes, works with the same frontend.

## Quick Start

```bash
npm install              # in the parent directory (for Agora RTC SDK)
cd python-server
pip install -r requirements.txt
cp .env.example .env     # fill in your Agora credentials
uvicorn app:app --port 3000
```

Then open http://localhost:3000 — the frontend is served from `../frontend/`.

Note: `npm install` in the parent directory is required to provide the Agora RTC SDK (`agora-sdk.js`) to the frontend.

## Why Python?

If your backend is Python-based (Django, Flask, FastAPI), use this as your starting point instead of the Node.js server. The frontend doesn't care which server it talks to — same routes, same JSON format.

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | /session/start | Start ConvoAI agent, return RTC join params |
| POST | /session/stop | Stop ConvoAI agent |
| GET | /token | Generate RTC token |
| GET | /history | Get conversation history |
| GET | /health | Health check |
| GET | /agora-sdk.js | Serve Agora RTC SDK from node_modules |

## Customize

- `app.py` — add your business logic, authentication, database
- `token_builder.py` — pure Python AccessToken2 implementation (no external SDK)
