import { Router } from 'express';
import { generateToken } from '../convoai-api.js';

const router = Router();

router.get('/token', (req, res) => {
  try {
    const appId = process.env.AGORA_APP_ID!;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE!;
    const channel = (req.query.channel as string) || `ch-${Date.now().toString(36)}`;
    const uid = parseInt(req.query.uid as string, 10) || 0;

    const token = generateToken(appId, appCertificate, channel, uid);

    res.json({ token, channel, uid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
