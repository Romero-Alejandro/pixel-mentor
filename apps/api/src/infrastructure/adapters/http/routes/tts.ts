import { Router, type Response } from 'express';

import type { AppRequest } from '@/types/express.js';
import type { TTSService } from '@/domain/ports/tts-service.js';
import { TTSStreamService } from '@/services/ttsStream.js';

export function createTTSRouter(ttsService: TTSService): Router {
  const router = Router();

  router.get('/stream', (req: AppRequest, res: Response) => {
    const { text, lang, slow } = req.query;

    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ message: 'Text is required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

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

    ttsStream.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      const code =
        error instanceof Error && 'code' in error
          ? String((error as Record<string, unknown>).code)
          : 'SSE_STREAM_ERROR';

      req.logger?.error({ err: error }, 'SSE Stream Error');

      if (!res.writableEnded) {
        const errorMessage = `event: error\ndata: ${JSON.stringify({ message, code })}\n\n`;
        res.write(errorMessage);
        res.end();
      }
    });

    req.on('close', () => {
      req.logger?.info('Client disconnected from TTS stream.');
      ttsStream.destroy();
    });
  });

  return router;
}
