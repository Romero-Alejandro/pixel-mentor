import { Router, type Response } from 'express';

import type { AppRequest } from '@/shared/types/express.d.js';
import type { TTSService } from '@/features/tts/domain/ports/tts-service.port.js';
import { TTSStreamService } from '@/features/tts/infrastructure/persistence/tts-factory.js';

/**
 * Mapea códigos de idioma largos a formatos cortos aceptados por Google TTS
 */
function mapLanguageCode(code?: string): string {
  const langMap: Record<string, string> = {
    'es-ES': 'es',
    'es-MX': 'es-419',
    'es-AR': 'es',
    'es-US': 'es',
    'en-US': 'en',
    'en-GB': 'en-gb',
  };

  if (code && langMap[code]) {
    return langMap[code];
  }

  // Si no está en el mapa, tomar primeros 2 caracteres
  if (code && code.length >= 2) {
    return code.split('-')[0];
  }

  return 'es'; // Default
}

export function createTTSRouter(_ttsService: TTSService): Router {
  const router = Router();

  // @ts-expect-error - Express 5 compatibility
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
      lang: mapLanguageCode(typeof lang === 'string' ? lang : undefined),
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
