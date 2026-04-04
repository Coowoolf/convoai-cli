// Webhook endpoint for ConvoAI Engine callbacks.
// Customize: add your webhook handling logic here.

import { Router } from 'express';

const router = Router();

router.post('/callback', (req, res) => {
  console.log('[callback] Received webhook:', JSON.stringify(req.body, null, 2));
  res.json({ received: true });
});

export default router;
