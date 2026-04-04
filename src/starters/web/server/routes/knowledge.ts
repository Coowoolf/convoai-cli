// Knowledge base query endpoint.
// Customize: connect your knowledge base, RAG pipeline, or vector DB here.

import { Router } from 'express';

const router = Router();

router.post('/knowledge', (req, res) => {
  const { query } = req.body || {};
  console.log('[knowledge] Query:', query);

  // Customize: replace with your knowledge base integration
  res.json({
    results: [],
    message: 'Knowledge base not configured. Edit server/routes/knowledge.ts to connect yours.',
  });
});

export default router;
