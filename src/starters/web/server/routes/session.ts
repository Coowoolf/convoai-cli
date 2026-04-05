import { Router } from 'express';
import { startAgent, stopAgent, interruptAgent, type StartAgentConfig } from '../convoai-api.js';

const router = Router();

// In-memory session store (single session for simplicity)
// Customize: replace with database or Redis for production
let currentSession: { agentId: string; channel: string } | null = null;

router.post('/session/start', async (req, res) => {
  try {
    if (currentSession) {
      res.status(409).json({ error: 'Session already active. Stop it first.' });
      return;
    }

    // Validate required credentials before attempting API calls
    const required = ['AGORA_APP_ID', 'AGORA_APP_CERTIFICATE', 'AGORA_CUSTOMER_ID', 'AGORA_CUSTOMER_SECRET'];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
      res.status(503).json({
        error: `Missing credentials: ${missing.join(', ')}. Edit .env and restart the server.`,
      });
      return;
    }

    const appId = process.env.AGORA_APP_ID!;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE!;
    const customerId = process.env.AGORA_CUSTOMER_ID!;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET!;
    const region = process.env.AGORA_REGION || 'global';

    const channel = `session-${Date.now().toString(36)}`;
    const clientUid = Math.floor(Math.random() * 90000) + 10000;

    const config: StartAgentConfig = {
      appId,
      appCertificate,
      customerId,
      customerSecret,
      region,
      channel,
      clientUid,
      llm: {
        vendor: process.env.LLM_VENDOR,
        model: process.env.LLM_MODEL,
        apiKey: process.env.LLM_API_KEY,
        url: process.env.LLM_URL,
        style: process.env.LLM_STYLE,
      },
      tts: {
        vendor: process.env.TTS_VENDOR,
        params: process.env.TTS_PARAMS ? JSON.parse(process.env.TTS_PARAMS) : {},
      },
      asr: {
        vendor: process.env.ASR_VENDOR,
        language: process.env.ASR_LANGUAGE,
      },
    };

    const result = await startAgent(config);
    currentSession = { agentId: result.agentId, channel: result.channel };

    res.json({
      appId: result.appId,
      channel: result.channel,
      token: result.token,
      uid: result.uid,
      agentId: result.agentId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[session/start]', message);
    res.status(500).json({ error: message });
  }
});

router.post('/session/stop', async (req, res) => {
  try {
    if (!currentSession) {
      res.status(404).json({ error: 'No active session' });
      return;
    }

    const appId = process.env.AGORA_APP_ID!;
    const customerId = process.env.AGORA_CUSTOMER_ID!;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET!;
    const region = process.env.AGORA_REGION || 'global';

    await stopAgent(appId, currentSession.agentId, customerId, customerSecret, region);
    currentSession = null;

    res.json({ status: 'stopped' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[session/stop]', message);
    currentSession = null;
    res.status(500).json({ error: message });
  }
});

router.post('/session/interrupt', async (req, res) => {
  try {
    if (!currentSession) {
      res.status(404).json({ error: 'No active session' });
      return;
    }

    const appId = process.env.AGORA_APP_ID!;
    const customerId = process.env.AGORA_CUSTOMER_ID!;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET!;
    const region = process.env.AGORA_REGION || 'global';

    await interruptAgent(appId, currentSession.agentId, customerId, customerSecret, region);
    res.json({ status: 'interrupted' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
