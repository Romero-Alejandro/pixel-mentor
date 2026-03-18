// apps/api/src/routes/tts.ts
import type { Request, Response } from 'express';
import { Router } from 'express';

import { TTSStreamService } from '../services/ttsStream';

const ttsRouter = Router();

ttsRouter.get('/stream', async (req: Request, res: Response) => {
  const { text, lang, slow } = req.query;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ message: 'Text is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*'); // Consider more restrictive CORS in production
  res.flushHeaders(); // Flush headers to client

  const ttsStream = new TTSStreamService(text, {
    lang: typeof lang === 'string' ? lang : undefined,
    slow: slow === 'true' ? true : slow === 'false' ? false : undefined,
  });

  ttsStream.on('data', (chunk: string) => {
    res.write(chunk);
  });

  ttsStream.on('end', () => {
    res.end();
  });

  ttsStream.on('error', (error: any) => {
    console.error('SSE Stream Error:', error);
    // It's important to send an SSE error message before closing the connection
    const errorMessage = `event: error\ndata: ${JSON.stringify({
      message: error.message || 'Internal Server Error',
      code: error.code || 'SSE_STREAM_ERROR',
    })}\n\n`;
    res.write(errorMessage);
    res.end();
  });

  // Handle client disconnect
  req.on('close', () => {
    console.log('Client disconnected from TTS stream.');
    ttsStream.destroy(); // Clean up the stream
  });
});

export default ttsRouter;
