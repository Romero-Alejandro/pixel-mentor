import { Router, type Request, type Response } from 'express';

import type { AppRequest } from '@/types/express.js';
import type { TTSService } from '@/domain/ports/tts-service.js';

export function createTTSRouter(ttsService: TTSService): Router {
  const router = Router();

  router.get('/stream', (req: Request, res: Response) => {
    const appReq = req as AppRequest;
    const { text, lang, slow } = appReq.query;

    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ message: 'Text is required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    try {
      const ttsStream = ttsService.createStream(text, {
        languageCode: typeof lang === 'string' ? lang : undefined,
        speakingRate: slow === 'true' ? 0.5 : 1.0,
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

        appReq.logger?.error({ err: error }, 'SSE Stream Error');

        if (!res.writableEnded) {
          const errorMessage = `event: error\ndata: ${JSON.stringify({ message, code })}\n\n`;
          res.write(errorMessage);
          res.end();
        }
      });

      appReq.on('close', () => {
        appReq.logger?.info('Client disconnected from TTS stream.');
        ttsStream.destroy();
      });
    } catch (error: unknown) {
      appReq.logger?.error({ err: error }, 'Failed to initialize TTS stream');
      if (!res.writableEnded) {
        res.write(
          `event: error\ndata: ${JSON.stringify({ message: 'Stream initialization failed', code: 'INIT_ERROR' })}\n\n`,
        );
        res.end();
      }
    }
  });

  return router;
}
