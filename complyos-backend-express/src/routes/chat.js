import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { handleEvent } from '../orchestrator/handleEvent.js';

const router = express.Router();

router.post('/event', authenticate, async (req, res) => {
  const result = await handleEvent({
    ...req.body,
    userId: req.user.id,
    channel: 'web',
  });
  res.json(result);
});

router.get('/stream', authenticate, async (req, res) => {
  let supplied = {};
  if (typeof req.query.event === 'string') {
    try {
      supplied = JSON.parse(req.query.event);
    } catch {
      return res.status(400).json({ error: 'event query must contain valid JSON' });
    }
  }
  const event = {
    ...supplied,
    type: String(req.query.type || supplied.type || 'TEXT'),
    ...(typeof req.query.text === 'string' ? { text: req.query.text } : {}),
    ...(typeof req.query.externalId === 'string' ? { externalId: req.query.externalId } : {}),
    ...(typeof req.query.language === 'string' ? { language: req.query.language } : {}),
    userId: req.user.id,
    channel: 'web',
  };
  const result = await handleEvent(event);
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  for (const message of result.messages || []) {
    res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
  }
  res.write(`event: complete\ndata: ${JSON.stringify({
    status: result.status,
    claims: result.claims || [],
    trace: result.trace || [],
    duplicate: Boolean(result.duplicate),
  })}\n\n`);
  res.end();
});

export default router;
