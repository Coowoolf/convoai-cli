# ConvoAI Web Starter

A three-layer starter project for building voice AI applications with Agora ConvoAI Engine.

## Quick Start

```bash
npm install
convoai dev          # or: npm run dev
```

Open http://localhost:3000 and click **Start Conversation**.

## Project Structure

```
frontend/            <- Your UI (HTML / JS / CSS — no build step)
server/              <- Your backend (Express + TypeScript)
python-server/       <- Alternative Python backend (FastAPI)
connectors/          <- Future: telephony, text, IoT extensions
```

## How to Customize

### Change the UI
Edit files in `frontend/`:
- `index.html` — page structure
- `style.css` — colors, layout, theme
- `app.js` — interaction logic, Agora RTC handling

### Add business logic
Edit files in `server/routes/`:
- `session.ts` — session start/stop (add auth, rate limiting, logging)
- `callback.ts` — handle ConvoAI webhooks
- `knowledge.ts` — connect your knowledge base or RAG pipeline

### Add authentication
Edit `server/index.ts` — add Express middleware before the API routes.

### Switch to Python
See `python-server/README.md`. Same API routes, same frontend.

## Architecture

```
[Your Frontend]  -->  [Your Server]  -->  [ConvoAI Engine]
     HTML/JS          Express/FastAPI      Agora Cloud
     Agora RTC SDK    Token generation     ASR + LLM + TTS
     Voice capture    Business logic       Voice AI pipeline
```

Future connectors plug in at the same server layer:
```
[Phone / SIP]    -->  [Your Server]  -->  [ConvoAI Engine]
[IoT Device]     -->  [Your Server]  -->  [ConvoAI Engine]
[IM / Chat App]  -->  [Your Server]  -->  [ConvoAI Engine]
```

## From Local to Production

1. **Local** — `npm run dev` (you are here)
2. **Deploy server** — push `server/` to your cloud (Railway, Render, AWS, etc.)
3. **Deploy frontend** — push `frontend/` to CDN or same server
4. **Update .env** — swap local credentials for production ones

No code changes needed. Same architecture scales from laptop to production.

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| AGORA_APP_ID | Yes | From Agora Console |
| AGORA_APP_CERTIFICATE | Yes | From project settings |
| AGORA_CUSTOMER_ID | Yes | REST API credentials |
| AGORA_CUSTOMER_SECRET | Yes | REST API credentials |
| LLM_VENDOR | Yes | LLM provider (openai, anthropic, etc.) |
| LLM_API_KEY | Yes | LLM API key |
| TTS_VENDOR | Yes | TTS provider (microsoft, elevenlabs, etc.) |
| TTS_API_KEY | Yes | TTS API key |
